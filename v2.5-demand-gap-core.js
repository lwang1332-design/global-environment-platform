// V2.7 focused patch: 07 is driven only by selected 04 demands; 08 becomes the core capability matrix.
(function installDemandDrivenGap(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));

  function chosenDemands(){
    return typeof selectedDemands==='function' ? selectedDemands().map(x=>({
      title:String(x[0]||''),text:String(x[1]||''),type:String(x[2]||''),scene:String(x[3]||''),role:String(x[4]||'')
    })) : [];
  }

  // 07: recommendation level is based ONLY on the customer demands selected in 04.
  // Main-scene direct match = 2 points; secondary-scene direct match = 1 point.
  // >=3 strongly recommended; 2 recommended; 1 optional; 0 not triggered.
  packageTrigger=function(p){
    const packageTypes=new Set(p[3]||[]);
    let points=0;
    for(const d of chosenDemands()){
      if(packageTypes.has(d.type)) points += d.role==='主场景' ? 2 : 1;
    }
    return points>=3?3:points===2?2:points===1?1:0;
  };

  const CORE_DOMAINS=[
    {name:'防腐',types:['salt','marine','industry'],kw:/腐蚀|盐雾|盐分|海洋防护|化学/},
    {name:'凝露',types:['humidity','mist'],kw:/凝露|高湿|水汽|大雾|雾|霉菌/},
    {name:'防雨',types:['rain'],kw:/风驱雨|降雨|防雨|进水|漏水|排水|携盐/},
    {name:'沙尘',types:['dust'],kw:/沙尘|粉尘|积灰|沙蚀|过滤器|易耗品/},
    {name:'高温',types:['heat'],kw:/高温|热裕量|散热|辐射|过温|降额/},
    {name:'低温',types:['cold'],kw:/低温|严寒|冷启动|脆化/},
    {name:'高海拔',types:['altitude'],kw:/高海拔|低气压|绝缘|UV|紫外/},
    {name:'暴雪结冰',types:['snow'],kw:/暴雪|风吹雪|结冰|融雪|除雪|覆冰/},
    {name:'工矿污染',types:['industry'],kw:/工矿|污染|有害气体|腐蚀性空气|导电粉尘/},
    {name:'维护性',types:[],kw:/维护|运维|少维护|维护周期|过滤器寿命|易耗品/}
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
      const standard=current;
      const pro=need>=2?Math.min(3,current+1):current;
      return {Standard:standard,Pro:pro,Plus:3};
    }
    const standard=need>=2?Math.max(current,2):current;
    const pro=need>=2?Math.max(current,3):current;
    return {Standard:Math.min(3,standard),Pro:Math.min(3,pro),Plus:3};
  }

  function packageBoost(domain){
    let hit=false;
    activePackages.forEach((p,i)=>{
      if(!packageManual[i])return;
      const types=p[3]||[];
      if(types.some(t=>domain.types.includes(t)))hit=true;
      if(domain.name==='维护性'&&/维护|过滤|寿命/.test(`${p[1]||''} ${p[2]||''}`))hit=true;
    });
    return hit?1:0;
  }

  gapRows=function(){
    return CORE_DOMAINS.map(domain=>{
      const need=projectNeed(domain),current=currentCapability(domain),caps=planCapabilities(domain,need,current);
      const selectedCap=caps[selectedPlan]||caps.Standard;
      const pkg=packageBoost(domain);
      const supplied=Math.min(3,selectedCap+pkg);
      const rem=Math.max(0,need-supplied);
      return {
        domain:domain.name,need,current,base:current,
        Standard:caps.Standard,Pro:caps.Pro,Plus:caps.Plus,
        plan:Math.max(0,selectedCap-current),pkg,supplied,rem
      };
    });
  };

  function planGapTotals(rows){
    const out={Standard:0,Pro:0,Plus:0};
    for(const r of rows){
      out.Standard+=Math.max(0,r.need-r.Standard);
      out.Pro+=Math.max(0,r.need-r.Pro);
      out.Plus+=Math.max(0,r.need-r.Plus);
    }
    return out;
  }

  renderGap=function(){
    const rows=gapRows(),max=Math.max(0,...rows.map(r=>r.rem)),tot=planGapTotals(rows);
    const table=document.querySelector('#gap table');
    if(table){
      const head=table.querySelector('thead');
      if(head)head.innerHTML=`<tr><th>风险域</th><th>项目要求</th><th>当前机组</th><th class="${selectedPlan==='Standard'?'gap-plan-head-active':''}">Standard</th><th class="${selectedPlan==='Pro'?'gap-plan-head-active':''}">Pro</th><th class="${selectedPlan==='Plus'?'gap-plan-head-active':''}">Plus</th><th>剩余Gap（当前${esc(selectedPlan)}）</th></tr>`;
    }
    $('gapBadge').textContent=`当前${selectedPlan} · 剩余Gap：${max>=2?'高':max===1?'中':'低'}`;
    $('gapBody').innerHTML=rows.map(r=>`<tr>
      <td><b>${esc(r.domain)}</b></td>
      <td>${r.need}/3</td>
      <td>${r.current}/3</td>
      <td class="${selectedPlan==='Standard'?'gap-plan-active':''}">${r.Standard}/3</td>
      <td class="${selectedPlan==='Pro'?'gap-plan-active':''}">${r.Pro}/3</td>
      <td class="${selectedPlan==='Plus'?'gap-plan-active':''}">${r.Plus}/3</td>
      <td class="${r.rem>=2?'gap-high':r.rem===1?'gap-mid':'gap-low'}">${r.rem===0?'已覆盖':`Gap ${r.rem}`}${r.pkg?` · 升级包+${r.pkg}`:''}</td>
    </tr>`).join('');

    const card=$('gapBody')?.closest('.card');
    if(card){
      let note=card.querySelector('.gap-core-explain');
      if(!note){note=document.createElement('div');note.className='gap-core-explain';card.appendChild(note)}
      const rec=typeof recommendedPlan==='function'?recommendedPlan().name:selectedPlan;
      note.innerHTML=`<b>Design Gap 决策：</b>Standard 总缺口 <b>${tot.Standard}</b>，Pro 总缺口 <b>${tot.Pro}</b>，Plus 总缺口 <b>${tot.Plus}</b>。当前系统推荐 <b>${esc(rec)}</b>，当前选择 <b>${esc(selectedPlan)}</b>；表格直接展示“项目要求 − 方案能力 − 已选升级包补偿”的剩余缺口。`;
    }
    return rows;
  };

  function patchCopy(){
    const pp=document.querySelector('#package .section-title p');
    if(pp)pp.textContent='推荐等级仅由 04 已勾选客户核心诉求驱动：主场景直接匹配计2分、次场景直接匹配计1分；≥3强烈推荐、2推荐、1可选、0不触发。';
    const gp=document.querySelector('#gap .section-title p');
    if(gp)gp.textContent='核心决策矩阵：项目要求 × 当前机组能力 × Standard / Pro / Plus 能力，直接显示当前选定方案仍缺什么；已选升级包只用于补偿最终剩余 Gap。';
  }

  function installStyle(){
    if(document.getElementById('gapCoreStyle'))return;
    const style=document.createElement('style');style.id='gapCoreStyle';style.textContent=`
      #gap .card{overflow-x:auto}
      #gap table{min-width:760px}
      #gap .gap-plan-head-active{background:#eaf2ff;color:var(--blue);box-shadow:inset 0 -2px 0 var(--blue)}
      #gap .gap-plan-active{background:#f4f8ff;color:var(--nav);font-weight:800}
      .gap-core-explain{margin-top:10px;background:#f7faff;border-left:3px solid var(--blue);padding:9px 11px;border-radius:0 8px 8px 0;font-size:11px;line-height:1.6;color:#445269}
    `;document.head.appendChild(style);
  }

  installStyle();patchCopy();
  if(Object.keys(env||{}).length){renderPackages();renderGap();renderResult();}
})();
