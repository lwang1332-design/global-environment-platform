// V2.7 plan images: Standard / Pro / Plus each has an independent image + caption.
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

  renderPlans=function(){
    const r=recommendedPlan();
    if(!planManual)selectedPlan=r.name;
    $('planBadge').textContent=`系统推荐：${r.name}`;
    const d=getScenario(selectedScene);
    $('planGrid').innerHTML=['Standard','Pro','Plus'].map(name=>`<div class="plan ${selectedPlan===name?'selected':''}">
      <span class="pill">${name===r.name?'系统推荐':'可选'}</span><h4>${name}</h4>
      <div class="plan-main">
        <div class="plan-copy"><ul>${(d?.plans?.[name]||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="plan-media">${mediaHtml(d,name)}</div>
      </div>
      <div class="plan-footer"><span>作为场景主方案</span><input type="radio" name="plan" ${selectedPlan===name?'checked':''} onchange="selectedPlan='${name}';planManual=true;renderPlans();renderPackages();renderGap();renderResult()"></div>
    </div>`).join('');
    $('planReason').innerHTML=`推荐规则：项目环境最高需求 <b>${r.envCode}/3</b>，当前机组基础能力 <b>${r.machine}/3</b>，能力差 <b>${r.gap}</b> → 推荐 <b>${r.name}</b>。场景方案内容来自 <b>${esc(selectedScene)}</b> 技术货架。方案图仅用于方案展示，不参与推荐算法。`;
  };

  const previousSave=saveReportSnapshot;
  saveReportSnapshot=function(){
    const ok=previousSave();if(!ok)return false;
    try{
      const snap=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');
      const d=getScenario(selectedScene);
      if(snap&&snap.plan){
        snap.plan.imageUrl=d?.planImages?.[selectedPlan]||'';
        snap.plan.imageCaption=d?.planImageCaptions?.[selectedPlan]||'';
        localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
      }
    }catch(e){console.warn('方案图报告快照写入失败',e)}
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
      @media(max-width:720px){.plan-main{grid-template-columns:1fr}.plan-image-box{max-height:240px}.plan-media{margin-top:4px}}
    `;document.head.appendChild(st);
  }

  if(Object.keys(env||{}).length&&selectedScene)renderPlans();
})();
