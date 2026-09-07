// V2.7 focused patch: 07 = selected 04 demands + selected 06 plan main risk; 08 = core capability matrix with scene package.
(function installDemandDrivenGap(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));

  function chosenDemands(){
    return typeof selectedDemands==='function' ? selectedDemands().map(x=>({
      title:String(x[0]||''),text:String(x[1]||''),type:String(x[2]||''),scene:String(x[3]||''),role:String(x[4]||'')
    })) : [];
  }

  const RISK_TYPE_KEYWORDS={
    salt:/盐雾|盐分|盐沉积|氯离子|锈蚀|腐蚀/,
    marine:/海洋|海上|盐雾|腐蚀|高湿|风驱雨/,
    industry:/工矿|工业|腐蚀性气体|有害气体|SO₂|H₂S|化学腐蚀/,
    humidity:/凝露|高湿|水汽|霉菌|湿润/,
    mist:/大雾|海雾|雾|携液|过滤器|排液/,
    rain:/降雨|强降雨|风驱雨|进水|漏水|倒灌|排水|雨雪/,
    dust:/沙尘|粉尘|积灰|沙蚀|过滤器|堵塞|清灰|风蚀/,
    heat:/高温|过温|热负荷|热裕量|散热|限功率|降额|强辐射/,
    cold:/低温|极寒|严寒|冷启动|预热|脆化/,
    altitude:/高海拔|低气压|绝缘|UV|紫外/,
    snow:/暴雪|风吹雪|降雪|积雪|结冰|冻雨|融雪|除雪|覆冰/
  };

  function selectedPlanMainRisk(){
    const d=typeof getScenario==='function'?getScenario(selectedScene):null;
    return String(d?.planMeta?.[selectedPlan]?.mainRisk||'').trim();
  }

  function riskTypesFromText(text){
    const out=new Set();
    Object.entries(RISK_TYPE_KEYWORDS).forEach(([type,re])=>{if(re.test(text))out.add(type)});
    return out;
  }

  function packageEvidence(p){
    const packageTypes=new Set(p[3]||[]),demands=chosenDemands();
    let demandPoints=0,mainHits=0,secondaryHits=0;
    for(const d of demands){
      if(!packageTypes.has(d.type))continue;
      if(d.role==='主场景'){demandPoints+=2;mainHits++}
      else{demandPoints+=1;secondaryHits++}
    }
    const planRisk=selectedPlanMainRisk(),riskTypes=riskTypesFromText(planRisk);
    const planRiskHit=[...packageTypes].some(t=>riskTypes.has(t));
    const points=demandPoints+(planRiskHit?1:0);
    const level=points>=3?3:points===2?2:points===1?1:0;
    return {level,points,mainHits,secondaryHits,planRiskHit,planRisk};
  }

  // 07 recommendation: ONLY 04 selected customer demands + 06 selected plan's "main risk".
  // Main-scene direct match = 2; secondary-scene direct match = 1; residual-risk match = 1.
  packageTrigger=function(p){return packageEvidence(p).level};

  // Keep the card order stable while giving the engineer traceable recommendation evidence.
  packageEntries=function(){
    const entries=activePackages.map((p,i)=>({p,i,auto:packageTrigger(p),evidence:packageEvidence(p)}));
    for(const x of entries)if(!(x.i in packageManual))packageManual[x.i]=false;
    return entries.sort((a,b)=>b.auto-a.auto||a.i-b.i);
  };

  renderPackages=function(){
    let n=0;const entries=packageEntries();
    $('packageGrid').innerHTML=entries.map(x=>{
      const {p,i,auto,evidence}=x,sel=packageManual[i];if(sel)n++;
      const txt=auto>=3?'强烈推荐':auto===2?'推荐':auto===1?'可选':'不触发',cl=auto>=3?'strong':auto===2?'auto':'';
      const source=[];
      if(evidence.mainHits)source.push(`主场景诉求×${evidence.mainHits}`);
      if(evidence.secondaryHits)source.push(`次场景诉求×${evidence.secondaryHits}`);
      if(evidence.planRiskHit)source.push('06主要风险命中');
      return `<div class="package ${sel?'selected':''}"><input type="checkbox" ${sel?'checked':''} onchange="packageManual[${i}]=this.checked;this.closest('.package').classList.toggle('selected',this.checked);$('pkgCount').textContent=activePackages.reduce((n,p,j)=>n+(packageManual[j]?1:0),0)+' 个升级包';renderGap();renderResult()"><span class="tag ${cl}">${txt}</span><h4>${esc(p[0])}</h4><p><b>适用：</b>${esc(p[1])}<br>${esc(p[2])}</p><small>推荐依据：${source.length?esc(source.join(' + ')):'未命中04诉求或06主要风险'} · ${auto}/3</small></div>`;
    }).join('');
    $('pkgCount').textContent=n+' 个升级包';
  };

  const CORE_DOMAINS=[
    {name:'防腐',types:['salt','marine','industry'],kw:/腐蚀|锈蚀|盐雾|盐分|海洋防护|化学/},
    {name:'凝露',types:['humidity','mist'],kw:/凝露|高湿|水汽|大雾|雾|霉菌/},
    {name:'防雨',types:['rain'],kw:/风驱雨|降雨|防雨|进水|漏水|倒灌|排水|携盐|雨雪/},
    {name:'沙尘',types:['dust'],kw:/沙尘|粉尘|积灰|沙蚀|过滤器|堵塞|易耗品/},
    {name:'高温',types:['heat'],kw:/高温|热裕量|散热|辐射|过温|限功率|降额/},
    {name:'低温',types:['cold'],kw:/低温|严寒|极寒|冷启动|预热|脆化/},
    {name:'高海拔',types:['altitude'],kw:/高海拔|低气压|绝缘|UV|紫外/},
    {name:'暴雪结冰',types:['snow'],kw:/暴雪|风吹雪|结冰|冻雨|融雪|除雪|覆冰/},
    {name:'工矿污染',types:['industry'],kw:/工矿|工业污染|有害气体|腐蚀性空气|导电粉尘/},
    {name:'维护性',types:[],kw:/维护|运维|少维护|维护周期|过滤器寿命|易耗品|远程诊断/}
  ];

  const MID_PROFILE={防腐:2,凝露:1,防雨:2,沙尘:2,高温:2,低温:2,高海拔:1,暴雪结冰:1,工矿污染:1,维护性:1};
  const HIGH_PROFILE={防腐:3,凝露:2,防雨:3,沙尘:3,高温:3,低温:3,高海拔:2,暴雪结冰:2,工矿污染:2,维护性:2};

  function domainMatches(d,domain){
    if(domain.types.includes(d.type))return true;
    return domain.kw.test(`${d.title} ${d.text}`);
  }

  function projectNeed(domain){
    let need=1;
    for(const d of chosenDemands()){
      if(!domainMatches(d,domain))continue;
      need=Math.max(need,d.role==='主场景'?3:2);
    }
    return need;
  }

  function currentCapability(domain){
    const level=Math.max(1,Math.min(3,Number($('machineLevel')?.value||1)));
    if(level===1)return 1;
    if(level===2)return MID_PROFILE[domain.name]||2;
    return HIGH_PROFILE[domain.name]||3;
  }

  function planCapabilities(domain,need,current){
    if(domain.name==='维护性'){
      return {Standard:current,Pro:need>=2?Math.min(3,current+1):current,Plus:3};
    }
    const standard=need>=2?Math.max(current,2):current;
    const pro=need>=2?Math.max(current,3):current;
    return {Standard:Math.min(3,standard),Pro:Math.min(3,pro),Plus:3};
  }

  // "场景包" is the capability contribution of the upgrade packages actually checked in 07.
  function scenePackageBoost(domain){
    let hit=false;
    activePackages.forEach((p,i)=>{
      if(!packageManual[i])return;
      const types=p[3]||[];
      if(types.some(t=>domain.types.includes(t)))hit=true;
      if(domain.name==='维护性'&&/维护|过滤|寿命|少维护/.test(`${p[0]||''} ${p[1]||''} ${p[2]||''}`))hit=true;
    });
    return hit?1:0;
  }

  gapRows=function(){
    return CORE_DOMAINS.map(domain=>{
      const need=projectNeed(domain),current=currentCapability(domain),caps=planCapabilities(domain,need,current);
      const selectedCap=caps[selectedPlan]||caps.Standard;
      const scenePackage=scenePackageBoost(domain);
      const supplied=Math.min(3,selectedCap+scenePackage);
      const rem=Math.max(0,need-supplied);
      return {
        domain:domain.name,need,current,base:current,
        Standard:caps.Standard,Pro:caps.Pro,Plus:caps.Plus,
        scenePackage,pkg:scenePackage,
        plan:Math.max(0,selectedCap-current),supplied,rem
      };
    });
  };

  function planGapTotals(rows){
    const out={Standard:0,Pro:0,Plus:0};
    for(const r of rows){
      out.Standard+=Math.max(0,r.need-Math.min(3,r.Standard+r.scenePackage));
      out.Pro+=Math.max(0,r.need-Math.min(3,r.Pro+r.scenePackage));
      out.Plus+=Math.max(0,r.need-Math.min(3,r.Plus+r.scenePackage));
    }
    return out;
  }

  renderGap=function(){
    const rows=gapRows(),max=Math.max(0,...rows.map(r=>r.rem)),tot=planGapTotals(rows);
    const table=document.querySelector('#gap table');
    if(table){
      const head=table.querySelector('thead');
      if(head)head.innerHTML=`<tr><th>风险域</th><th>项目要求</th><th>当前机组</th><th class="${selectedPlan==='Standard'?'gap-plan-head-active':''}">Standard</th><th class="${selectedPlan==='Pro'?'gap-plan-head-active':''}">Pro</th><th class="${selectedPlan==='Plus'?'gap-plan-head-active':''}">Plus</th><th>场景包</th><th>剩余Gap</th></tr>`;
    }
    $('gapBadge').textContent=`当前${selectedPlan} + 场景包 · 剩余Gap：${max>=2?'高':max===1?'中':'低'}`;
    $('gapBody').innerHTML=rows.map(r=>`<tr>
      <td><b>${esc(r.domain)}</b></td>
      <td>${r.need}/3</td>
      <td>${r.current}/3</td>
      <td class="${selectedPlan==='Standard'?'gap-plan-active':''}">${r.Standard}/3</td>
      <td class="${selectedPlan==='Pro'?'gap-plan-active':''}">${r.Pro}/3</td>
      <td class="${selectedPlan==='Plus'?'gap-plan-active':''}">${r.Plus}/3</td>
      <td>${r.scenePackage?`+${r.scenePackage}`:'0'}</td>
      <td class="${r.rem>=2?'gap-high':r.rem===1?'gap-mid':'gap-low'}">${r.rem===0?'0 · 已覆盖':`Gap ${r.rem}`}</td>
    </tr>`).join('');

    const card=$('gapBody')?.closest('.card');
    if(card){
      let note=card.querySelector('.gap-core-explain');
      if(!note){note=document.createElement('div');note.className='gap-core-explain';card.appendChild(note)}
      const rec=typeof recommendedPlan==='function'?recommendedPlan().name:selectedPlan;
      note.innerHTML=`<b>Design Gap 决策：</b>在当前已勾选场景包下，Standard 总缺口 <b>${tot.Standard}</b>，Pro 总缺口 <b>${tot.Pro}</b>，Plus 总缺口 <b>${tot.Plus}</b>。系统推荐 <b>${esc(rec)}</b>，当前选择 <b>${esc(selectedPlan)}</b>。对比矩阵直接回答“当前机组缺什么、Pro为什么合适、还需要哪些场景包补齐”。`;
    }
    return rows;
  };

  function patchCopy(){
    const pp=document.querySelector('#package .section-title p');
    if(pp)pp.textContent='基于 04 已勾选客户核心诉求 + 06 当前匹配场景方案的主要风险综合评价；按“强烈推荐 → 推荐 → 可选 → 不触发”固定排序，工程师最终人工勾选。';
    const gp=document.querySelector('#gap .section-title p');
    if(gp)gp.textContent='核心决策矩阵：项目要求 × 当前机组 × Standard / Pro / Plus × 已选场景包 → 剩余 Gap，直接解释为什么选择当前方案以及还缺什么。';
  }

  function installStyle(){
    if(document.getElementById('gapCoreStyle'))return;
    const style=document.createElement('style');style.id='gapCoreStyle';style.textContent=`
      #gap .card{overflow-x:auto}
      #gap table{min-width:860px}
      #gap .gap-plan-head-active{background:#eaf2ff;color:var(--blue);box-shadow:inset 0 -2px 0 var(--blue)}
      #gap .gap-plan-active{background:#f4f8ff;color:var(--nav);font-weight:800}
      .gap-core-explain{margin-top:10px;background:#f7faff;border-left:3px solid var(--blue);padding:9px 11px;border-radius:0 8px 8px 0;font-size:11px;line-height:1.6;color:#445269}
    `;document.head.appendChild(style);
  }

  installStyle();patchCopy();
  if(Object.keys(env||{}).length){renderPackages();renderGap();renderResult();}
})();
