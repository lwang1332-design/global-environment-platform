// V2.7 demand fusion: primary + secondary scene customer requirements
(function installDemandFusion(){
  function topTwoSceneContext(){
    let ranked=Array.isArray(lastSceneRanking)&&lastSceneRanking.length?lastSceneRanking:[];
    if(!ranked.length&&Object.keys(env||{}).length)ranked=sceneScores();
    return ranked.slice(0,2).map((s,i)=>({
      name:s.name,
      role:i===0?'主场景':'次场景',
      score:Number(s.score||0),
      data:getScenario(s.name)
    })).filter(x=>x.data);
  }

  function selectedDemandDetails(includeUnchecked=false){
    const out=[];
    topTwoSceneContext().forEach(ctx=>{
      (ctx.data.demands||[]).forEach((x,i)=>{
        const key=ctx.name+'#'+i;
        if(!(key in demandManual))demandManual[key]=true;
        if(includeUnchecked||demandManual[key])out.push({
          scene:ctx.name,role:ctx.role,score:ctx.score,index:i,key,demand:x,data:ctx.data
        });
      });
    });
    return out;
  }

  selectedDemands=function(){
    return selectedDemandDetails(false).map(o=>[
      o.demand[0],o.demand[1],o.demand[2],o.scene,o.role
    ]);
  };

  renderDemands=function(){
    const contexts=topTwoSceneContext();
    if(!contexts.length){
      $('demandCount').textContent='0 条核心诉求';
      $('demandGrid').innerHTML='<div class="empty">完成项目环境分析后，系统将叠加主场景与次场景的客户核心诉求。</div>';
      return;
    }
    let selectedCount=0,totalCount=0,html='';
    contexts.forEach(ctx=>{
      const rows=ctx.data.demands||[];
      totalCount+=rows.length;
      html+=`<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;margin:${html?'5px':'0'} 0 1px;padding:7px 9px;border-radius:8px;background:${ctx.role==='主场景'?'#eef5ff':'#f6f8fb'}"><b style="color:#0b2548">${ctx.role} · ${ctx.name}</b><span class="pill">置信度 ${ctx.score}%</span></div>`;
      html+=rows.map((x,i)=>{
        const key=ctx.name+'#'+i;
        if(!(key in demandManual))demandManual[key]=true;
        if(demandManual[key])selectedCount++;
        return `<label class="demand"><input type="checkbox" ${demandManual[key]?'checked':''} onchange="demandManual['${key}']=this.checked;renderDemands();renderRequirements();renderPackages();renderGap();renderResult()"><span><small style="display:block;color:#1557d6;font-weight:700;margin-bottom:2px">${ctx.role} · ${ctx.name}</small><b>${x[0]}</b><br>${x[1]}<span class="evidence">环境依据：${evidenceFor(x[2])}</span></span></label>`;
      }).join('');
    });
    $('demandCount').textContent=`已选 ${selectedCount}/${totalCount} 条核心诉求`;
    $('demandGrid').innerHTML=html;
  };

  buildRequirements=function(){
    const details=selectedDemandDetails(false),merged=new Map();
    details.forEach(o=>{
      const x=o.demand,reqs=o.data.reqs?.[x[2]]||[];
      reqs.forEach((req,j)=>{
        const source=`${o.role} · ${o.scene}｜${x[0]}`;
        const evidence=evidenceFor(x[2]);
        const verify=j===0?'设计计算/项目技术规范校核':j===1?'专项试验或环境验证':'设计评审 + 验证';
        if(!merged.has(req))merged.set(req,{sources:new Set(),evidences:new Set(),req,verify});
        const row=merged.get(req);row.sources.add(source);row.evidences.add(evidence);
      });
    });
    return [...merged.values()].map(r=>[
      [...r.sources].join('；'),
      [...r.evidences].join('；'),
      r.req,
      r.verify
    ]);
  };

  renderRequirements=function(){
    const rows=buildRequirements();
    $('reqCount').textContent=rows.length+' 条设计需求';
    $('reqBody').innerHTML=rows.length?rows.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">请在主场景或次场景中至少勾选一条客户核心诉求。</td></tr>';
  };

  // Upgrade package triggers also consume the fused customer-demand set.
  packageTrigger=function(p){
    const types=p[3]||[];let s=0;
    for(const t of types){
      if(t==='heat')s=Math.max(s,riskLevel('t99'),riskLevel('rad95'));
      if(t==='humidity')s=Math.max(s,riskLevel('rh90'),riskLevel('rhAvg'));
      if(t==='rain')s=Math.max(s,riskLevel('rainYear'),riskLevel('rain1h'));
      if(t==='dust')s=Math.max(s,riskLevel('pm10'),riskLevel('dust'));
      if(t==='salt')s=Math.max(s,riskLevel('salt'));
      if(t==='mist')s=Math.max(s,riskLevel('rh90'),riskLevel('rhAvg'));
      if(t==='altitude')s=Math.max(s,riskLevel('alt'));
      if(t==='cold')s=Math.max(s,riskLevel('tmin'));
      if(t==='snow')s=Math.max(s,riskLevel('snowHours'));
      if(t==='marine')s=Math.max(s,riskLevel('salt'),riskLevel('rh90'),riskLevel('rain1h'));
      if(t==='industry')s=Math.max(s,riskLevel('so2'),riskLevel('pm10'),riskLevel('dust'));
    }
    const chosenTypes=new Set(selectedDemands().map(x=>x[2]));
    if(types.some(t=>chosenTypes.has(t)))s=Math.max(s,2);
    const topNames=new Set(topTwoSceneContext().map(x=>x.name));
    if(p[0]==='海洋强化包'&&topNames.has('海洋气候'))s=3;
    if(p[0]==='工矿污染包'&&topNames.has('工矿腐蚀环境'))s=3;
    return s;
  };

  // Report snapshot: retain source scene/role for each selected customer demand.
  const previousSave=saveReportSnapshot;
  saveReportSnapshot=function(){
    const ok=previousSave();if(!ok)return false;
    try{
      const snap=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');
      if(snap){
        const details=selectedDemandDetails(false);
        snap.demands=details.map(o=>({
          title:o.demand[0],text:o.demand[1],type:o.demand[2],
          evidence:evidenceFor(o.demand[2]),sourceScene:o.scene,sourceRole:o.role,sceneConfidence:o.score
        }));
        snap.demandFusion={mode:'PRIMARY_SECONDARY_UNION',scenes:topTwoSceneContext().map(x=>({name:x.name,role:x.role,score:x.score}))};
        localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
      }
    }catch(e){console.warn('客户诉求叠加报告快照写入失败',e)}
    return true;
  };

  function patchCopy(){
    const dp=document.querySelector('#demand .section-title p');
    if(dp)dp.textContent='主场景与次场景的客户核心诉求叠加展示，可分别勾选；最终勾选结果共同进入产品设计需求转换。';
    const rp=document.querySelector('#requirement .section-title p');
    if(rp)rp.textContent='05 自动汇总主场景 + 次场景已勾选诉求对应的全部设计需求；重复需求自动合并，并保留场景与诉求来源追溯。';
  }

  patchCopy();
  if(Object.keys(env||{}).length){renderDemands();renderRequirements();renderPackages();renderGap();renderResult();}
})();
