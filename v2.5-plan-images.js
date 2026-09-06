// V2.7 plan images + plan metadata: Standard / Pro / Plus each has an independent image, caption, risk, positioning and cost change.
(function installPlanImages(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));

  window.planImageFallback=function(img){
    const box=img?.closest?.('.plan-image-box');
    if(!box)return;
    box.innerHTML='<div class="plan-image-placeholder"><b>暂无方案图</b><small>请在管理员中上传</small></div>';
  };

  function mediaHtml(d,level){
    const url=d?.planImages?.[level]||'';
    const caption=d?.planImageCaptions?.[level]||'';
    if(!url)return `<div class="plan-image-box"><div class="plan-image-placeholder"><b>暂无方案图</b><small>请在管理员中上传</small></div></div>${caption?`<div class="plan-image-caption">${esc(caption)}</div>`:''}`;
    return `<div class="plan-image-box"><img src="${esc(url)}" alt="${esc(caption||`${level} 方案图`)}" loading="lazy" onerror="planImageFallback(this)"></div>${caption?`<div class="plan-image-caption">${esc(caption)}</div>`:''}`;
  }

  function metaHtml(d,level){
    const m=d?.planMeta?.[level]||{};
    const risk=m.mainRisk||'—',position=m.positioning||'—',cost=m.costChange||'—';
    return `<div class="plan-meta">
      <div class="plan-meta-row risk"><span>主要风险</span><b>${esc(risk)}</b></div>
      <div class="plan-meta-row positioning"><span>方案定位</span><b>${esc(position)}</b></div>
      <div class="plan-meta-row cost"><span>相对成本变化</span><b>${esc(cost)}</b></div>
    </div>`;
  }

  renderPlans=function(){
    const r=recommendedPlan();
    if(!planManual)selectedPlan=r.name;
    $('planBadge').textContent=`系统推荐：${r.name}`;
    const d=getScenario(selectedScene);
    $('planGrid').innerHTML=['Standard','Pro','Plus'].map(name=>`<div class="plan ${selectedPlan===name?'selected':''}">
      <span class="pill">${name===r.name?'系统推荐':'可选'}</span><h4>${name}</h4>
      <div class="plan-main">
        <div class="plan-copy"><ul>${(d?.plans?.[name]||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${metaHtml(d,name)}</div>
        <div class="plan-media">${mediaHtml(d,name)}</div>
      </div>
      <div class="plan-footer"><span>作为场景主方案</span><input type="radio" name="plan" ${selectedPlan===name?'checked':''} onchange="selectedPlan='${name}';planManual=true;renderPlans();renderPackages();renderGap();renderResult()"></div>
    </div>`).join('');
    $('planReason').innerHTML=`推荐规则：项目环境最高需求 <b>${r.envCode}/3</b>，当前机组基础能力 <b>${r.machine}/3</b>，能力差 <b>${r.gap}</b> → 推荐 <b>${r.name}</b>。场景方案内容来自 <b>${esc(selectedScene)}</b> 技术货架。方案图、主要风险、方案定位和相对成本变化仅用于工程决策展示，不参与推荐算法。`;
  };

  const previousSave=saveReportSnapshot;
  saveReportSnapshot=function(){
    const ok=previousSave();if(!ok)return false;
    try{
      const snap=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');
      const d=getScenario(selectedScene),m=d?.planMeta?.[selectedPlan]||{};
      if(snap&&snap.plan){
        snap.plan.imageUrl=d?.planImages?.[selectedPlan]||'';
        snap.plan.imageCaption=d?.planImageCaptions?.[selectedPlan]||'';
        snap.plan.mainRisk=m.mainRisk||'';
        snap.plan.positioning=m.positioning||'';
        snap.plan.costChange=m.costChange||'';
        localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
      }
    }catch(e){console.warn('方案图/方案元数据报告快照写入失败',e)}
    return true;
  };

  if(!document.getElementById('planImageStyle')){
    const st=document.createElement('style');st.id='planImageStyle';st.textContent=`
      .plan-main{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(105px,1fr);gap:9px;align-items:start}
      .plan-copy{min-width:0}.plan-copy ul{min-height:0!important;margin-top:5px}
      .plan-media{min-width:0}.plan-image-box{aspect-ratio:4/3;border:1px solid var(--line);border-radius:8px;background:#f5f8fc;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .plan-image-box img{width:100%;height:100%;object-fit:contain;display:block;background:#fff}
      .plan-image-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--muted);padding:8px;min-height:100%}
      .plan-image-placeholder b{font-size:10px;color:#65758a}.plan-image-placeholder small{font-size:8px;margin-top:3px;color:#98a2b3}
      .plan-image-caption{font-size:8px;color:var(--muted);text-align:center;margin-top:4px;line-height:1.35}
      .plan-meta{margin-top:9px;border-top:1px solid #edf0f4;padding-top:7px;display:grid;gap:6px}
      .plan-meta-row{display:grid;grid-template-columns:74px minmax(0,1fr);gap:7px;align-items:start;font-size:9px;line-height:1.45}
      .plan-meta-row span{color:var(--muted);font-weight:700}.plan-meta-row b{font-weight:600;color:#344054;word-break:break-word}
      .plan-meta-row.risk b{color:#9a5b08}.plan-meta-row.cost b{display:inline-flex;justify-self:start;padding:3px 7px;border-radius:99px;background:#eef4ff;color:#1557d6;font-size:10px}
      @media(max-width:720px){.plan-main{grid-template-columns:1fr}.plan-image-box{max-height:240px}.plan-media{margin-top:4px}.plan-meta-row{grid-template-columns:70px 1fr}}
    `;document.head.appendChild(st);
  }

  if(Object.keys(env||{}).length&&selectedScene)renderPlans();
})();
