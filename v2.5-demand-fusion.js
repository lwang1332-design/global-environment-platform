// V2.7 demand fusion: primary + secondary scene customer requirements
// Compact accordion UI: selected-demand summary + primary expanded / secondary collapsed.
(function installDemandFusion(){
  let demandPanelOpen={主场景:true,次场景:false};
  let demandSceneSignature='';

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));

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

  function syncPanelDefaults(contexts){
    const sig=contexts.map(x=>`${x.role}:${x.name}`).join('|');
    if(sig!==demandSceneSignature){
      demandSceneSignature=sig;
      demandPanelOpen={主场景:true,次场景:false};
    }
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

  function selectedSummaryHtml(details){
    const merged=[];
    const seen=new Set();
    details.forEach(o=>{
      const title=String(o.demand[0]||'').trim();
      if(title&&!seen.has(title)){seen.add(title);merged.push(title)}
    });
    if(!merged.length)return '<span class="demand-summary-empty">尚未选择客户诉求</span>';
    const show=merged.slice(0,8);
    return show.map(x=>`<span class="demand-summary-chip">${esc(x)}</span>`).join('')+
      (merged.length>show.length?`<span class="demand-summary-more">+${merged.length-show.length}</span>`:'');
  }

  function panelHtml(ctx){
    const rows=ctx.data.demands||[];
    const selected=rows.reduce((n,x,i)=>{
      const key=ctx.name+'#'+i;
      if(!(key in demandManual))demandManual[key]=true;
      return n+(demandManual[key]?1:0);
    },0);
    const open=!!demandPanelOpen[ctx.role];
    const body=rows.map((x,i)=>{
      const key=ctx.name+'#'+i;
      const checked=!!demandManual[key];
      const tip=`${x[1]||''}${x[2]?`\n环境依据：${evidenceFor(x[2])}`:''}`;
      return `<label class="demand-compact-row" title="${esc(tip)}">
        <input type="checkbox" ${checked?'checked':''} onchange="demandManual['${esc(key)}']=this.checked;renderDemands();renderRequirements();renderPackages();renderGap();renderResult()">
        <span class="demand-compact-copy"><b>${esc(x[0])}</b><small>${esc(x[1]||'')}</small></span>
        <span class="demand-evidence-dot" title="环境依据：${esc(evidenceFor(x[2]))}">依据</span>
      </label>`;
    }).join('');
    return `<div class="demand-panel ${open?'open':'closed'}">
      <button type="button" class="demand-panel-head" onclick="toggleDemandPanel('${ctx.role}')" aria-expanded="${open?'true':'false'}">
        <span class="demand-panel-arrow">${open?'▾':'▸'}</span>
        <span class="demand-panel-title"><b>${ctx.role}｜${esc(ctx.name)}</b><small>置信度 ${ctx.score}%</small></span>
        <span class="demand-panel-count">已选 ${selected}/${rows.length}</span>
      </button>
      <div class="demand-panel-body" ${open?'':'hidden'}>${body||'<div class="empty">该场景暂未配置客户诉求。</div>'}</div>
    </div>`;
  }

  window.toggleDemandPanel=function(role){
    demandPanelOpen[role]=!demandPanelOpen[role];
    renderDemands();
  };

  renderDemands=function(){
    const contexts=topTwoSceneContext();
    const grid=$('demandGrid');
    if(!contexts.length){
      $('demandCount').textContent='0 条核心诉求';
      grid.className='demands demand-accordion';
      grid.innerHTML='<div class="empty">完成项目环境分析后，系统将叠加主场景与次场景的客户核心诉求。</div>';
      return;
    }
    syncPanelDefaults(contexts);
    const all=selectedDemandDetails(true),selected=all.filter(o=>demandManual[o.key]);
    grid.className='demands demand-accordion';
    grid.innerHTML=`<div class="demand-summary">
        <div class="demand-summary-head"><b>已选诉求</b><span>${selected.length} / ${all.length}</span></div>
        <div class="demand-summary-chips">${selectedSummaryHtml(selected)}</div>
      </div>
      ${contexts.map(panelHtml).join('')}`;
    $('demandCount').textContent=`已选 ${selected.length}/${all.length} 条核心诉求`;
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

  // Switching between the primary/secondary scene is only a plan-source choice;
  // it must not erase the already fused customer-demand selections.
  window.selectScene=function(name){
    const allowed=new Set(topTwoSceneContext().map(x=>x.name));
    if(!allowed.has(name))return;
    selectedScene=name;
    planManual=false;
    renderDecision();
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
        snap.demandFusion={mode:'PRIMARY_SECONDARY_UNION',uiMode:'ACCORDION_SUMMARY',scenes:topTwoSceneContext().map(x=>({name:x.name,role:x.role,score:x.score}))};
        localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
      }
    }catch(e){console.warn('客户诉求叠加报告快照写入失败',e)}
    return true;
  };

  function installStyles(){
    if(document.getElementById('demandAccordionStyle'))return;
    const style=document.createElement('style');
    style.id='demandAccordionStyle';
    style.textContent=`
      .demands.demand-accordion{display:block!important}
      .demand-summary{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:7px}
      .demand-summary-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--nav);font-size:11px;margin-bottom:6px}
      .demand-summary-head span{color:var(--muted);font-size:10px}
      .demand-summary-chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center;min-height:24px}
      .demand-summary-chip{display:inline-flex;align-items:center;background:#eef5ff;color:#164a99;border:1px solid #dce8fb;border-radius:999px;padding:3px 7px;font-size:10px;line-height:1.35}
      .demand-summary-more{background:#eef1f5;color:#667085;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:700}
      .demand-summary-empty{color:var(--muted);font-size:10px}
      .demand-panel{background:#fff;border:1px solid var(--line);border-radius:10px;margin-top:6px;overflow:hidden}
      .demand-panel-head{width:100%;border:0;background:#f7f9fc;display:grid;grid-template-columns:18px 1fr auto;gap:7px;align-items:center;padding:7px 9px;text-align:left;cursor:pointer;color:var(--nav)}
      .demand-panel.open .demand-panel-head{background:#f0f5ff}
      .demand-panel-arrow{font-size:13px;color:var(--blue);font-weight:700}
      .demand-panel-title{display:flex;align-items:center;gap:8px;min-width:0}
      .demand-panel-title b{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .demand-panel-title small{font-size:9px;color:var(--muted);white-space:nowrap}
      .demand-panel-count{font-size:9px;color:var(--blue);background:#fff;border:1px solid #dce5f2;border-radius:999px;padding:3px 6px;white-space:nowrap}
      .demand-panel-body{padding:4px 7px 6px}
      .demand-compact-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:7px;align-items:center;padding:5px 3px;border-bottom:1px solid #eef1f4;cursor:pointer}
      .demand-compact-row:last-child{border-bottom:0}
      .demand-compact-row input{width:auto;margin:0}
      .demand-compact-copy{min-width:0;display:grid;grid-template-columns:minmax(120px,.7fr) minmax(0,1.3fr);gap:8px;align-items:center}
      .demand-compact-copy b{font-size:11px;color:var(--nav);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .demand-compact-copy small{font-size:9px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .demand-evidence-dot{font-size:9px;color:#667085;border:1px solid #e2e7ee;border-radius:6px;padding:2px 5px;background:#fafbfc;white-space:nowrap}
      @media(max-width:720px){
        .demand-compact-copy{grid-template-columns:1fr}
        .demand-compact-copy small{display:none}
        .demand-panel-title{display:block}
        .demand-panel-title small{display:block;margin-top:1px}
      }
    `;
    document.head.appendChild(style);
  }

  function patchCopy(){
    const dp=document.querySelector('#demand .section-title p');
    if(dp)dp.textContent='已选诉求在顶部汇总；主场景默认展开、次场景默认折叠，可分别勾选，最终共同进入产品设计需求转换。';
    const rp=document.querySelector('#requirement .section-title p');
    if(rp)rp.textContent='05 自动汇总主场景 + 次场景已勾选诉求对应的全部设计需求；重复需求自动合并，并保留场景与诉求来源追溯。';
  }

  installStyles();
  patchCopy();
  if(Object.keys(env||{}).length){renderDemands();renderRequirements();renderPackages();renderGap();renderResult();}
})();
