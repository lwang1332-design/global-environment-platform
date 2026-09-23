// V2.7 plan images + plan metadata: Standard / Pro / Plus each has an independent image, caption, risk, positioning and cost change.
(function installPlanImages(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const PLAN_LABELS={Standard:'标准环境适应方案',Pro:'增强环境适应方案',Plus:'极端环境适应方案'};

  window.planImageFallback=function(img){
    const box=img?.closest?.('.plan-image-box');
    if(!box)return;
    box.innerHTML='<div class="plan-image-placeholder"><b>TECHNICAL SCHEME</b><small>技术方案图待配置</small></div>';
  };

  function mediaHtml(d,level){
    const url=d?.planImages?.[level]||'';
    const caption=d?.planImageCaptions?.[level]||'';
    if(!url)return `<div class="plan-image-box"><div class="plan-image-placeholder"><b>TECHNICAL SCHEME</b><small>技术方案图待配置</small></div></div>${caption?`<div class="plan-image-caption">${esc(caption)}</div>`:''}`;
    return `<div class="plan-image-box"><img src="${esc(url)}" alt="${esc(caption||`${level} 方案图`)}" loading="lazy" onerror="planImageFallback(this)"></div>${caption?`<div class="plan-image-caption">${esc(caption)}</div>`:''}`;
  }

  function majorComponentsHtml(d,level){
    const m=d?.planMeta?.[level]||{};
    const raw=m.majorComponentPlan??'';
    const items=(Array.isArray(raw)?raw:String(raw).split(/\r?\n/)).map(x=>String(x).trim()).filter(Boolean);
    return `<div class="plan-major">
      <div class="plan-subtitle">大部件差异化配置</div>
      ${items.length?`<ul class="plan-major-list">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="plan-empty-line">待管理员配置</div>'}
    </div>`;
  }

  function metaHtml(d,level){
    const m=d?.planMeta?.[level]||{};
    const risk=m.mainRisk||'—',position=m.positioning||'—',cost=m.costChange||'—';
    return `<div class="plan-meta">
      <div class="plan-subtitle">方案工程属性</div>
      <div class="plan-meta-row risk"><span>主要风险</span><b>${esc(risk)}</b></div>
      <div class="plan-meta-row positioning"><span>方案定位</span><b>${esc(position)}</b></div>
      <div class="plan-meta-row cost"><span>相对成本变化</span><b>${esc(cost)}</b></div>
    </div>`;
  }

  function statusHtml(name,recommended,selected){
    if(recommended)return '<span class="plan-status-badge recommended">★ 推荐方案</span>';
    if(selected)return '<span class="plan-status-badge current">✓ 当前选择</span>';
    return '<span class="plan-status-badge optional">可选</span>';
  }

  renderPlans=function(){
    const r=recommendedPlan();
    if(!planManual)selectedPlan=r.name;
    $('planBadge').textContent=`系统推荐：${r.name}`;
    const d=getScenario(selectedScene);

    $('planGrid').innerHTML=['Standard','Pro','Plus'].map(name=>{
      const recommended=name===r.name;
      const selected=selectedPlan===name;
      const items=Array.isArray(d?.plans?.[name])?d.plans[name]:[];
      return `<div class="plan plan-row ${recommended?'recommended':''} ${selected?'selected':''}">
        <div class="plan-head">
          <h4><span class="plan-level">${name.toUpperCase()}</span><span class="plan-cn-title">${PLAN_LABELS[name]||''}</span></h4>
          <div class="plan-head-actions">
            <div class="plan-status">${statusHtml(name,recommended,selected)}</div>
            <label class="plan-radio-label"><input type="radio" name="plan" ${selected?'checked':''} onchange="selectedPlan='${name}';planManual=true;renderPlans();renderPackages();renderGap();renderResult()"><span>作为场景主方案</span></label>
          </div>
        </div>
        <div class="plan-main">
          <div class="plan-copy">
            <div class="plan-config">
              <div class="plan-subtitle">核心技术配置</div>
              <ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
            </div>
            ${majorComponentsHtml(d,name)}
            ${metaHtml(d,name)}
          </div>
          <div class="plan-media">${mediaHtml(d,name)}</div>
        </div>
      </div>`;
    }).join('');

    const selectionNote=planManual&&selectedPlan!==r.name
      ? `当前人工选择 <b>${esc(selectedPlan)}</b>，系统推荐 <b>${r.name}</b> 保持不变；07 推荐升级包、08 Design Gap 和项目输出按当前人工选择方案继续计算。`
      : `当前主方案与系统推荐一致，为 <b>${r.name}</b>。`;

    $('planReason').innerHTML=`推荐规则：项目环境最高需求 <b>${r.envCode}/3</b>，当前机组基础能力 <b>${r.machine}/3</b>，能力差 <b>${r.gap}</b> → 系统推荐 <b>${r.name}</b>。场景方案内容来自 <b>${esc(selectedScene)}</b> 技术货架。方案图、大部件差异化配置、方案定位和相对成本变化不参与 Standard / Pro / Plus 推荐算法；“主要风险”用于 07 升级包推荐评价，但不反向改变 06 三档方案推荐结果。<br><span class="plan-selection-note">${selectionNote}</span>`;
  };

  const previousSave=saveReportSnapshot;
  saveReportSnapshot=function(){
    const ok=previousSave();if(!ok)return false;
    try{
      const snap=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');
      const d=getScenario(selectedScene),m=d?.planMeta?.[selectedPlan]||{};
      const r=recommendedPlan();
      if(snap&&snap.plan){
        snap.plan.imageUrl=d?.planImages?.[selectedPlan]||'';
        snap.plan.imageCaption=d?.planImageCaptions?.[selectedPlan]||'';
        snap.plan.majorComponentPlan=m.majorComponentPlan||'';
        snap.plan.mainRisk=m.mainRisk||'';
        snap.plan.positioning=m.positioning||'';
        snap.plan.costChange=m.costChange||'';
        snap.plan.recommendedName=r.name;
        snap.plan.selectedName=selectedPlan;
        snap.plan.manualOverride=Boolean(planManual&&selectedPlan!==r.name);
        snap.plan.recommendationBasis={envCode:r.envCode,machine:r.machine,gap:r.gap};
        localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
      }
    }catch(e){console.warn('方案图/方案元数据报告快照写入失败',e)}
    return true;
  };

  if(!document.getElementById('planImageStyle')){
    const st=document.createElement('style');st.id='planImageStyle';st.textContent=`
      #plan .plan-grid{display:grid;grid-template-columns:1fr;gap:18px}
      #plan .plan{padding:0;overflow:hidden;position:relative;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);transform:none}
      #plan .plan.recommended{border:2px solid var(--blue);background:#f8fbff;box-shadow:0 8px 22px rgba(21,87,214,.08)}
      #plan .plan.recommended:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--blue)}
      #plan .plan.selected:not(.recommended){box-shadow:inset 0 0 0 2px rgba(21,87,214,.18),var(--shadow)}
      .plan-head{min-height:52px;padding:11px 14px 9px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid #edf0f4}
      .plan-head h4{margin:0!important;display:flex;align-items:baseline;gap:10px;min-width:0}
      .plan-level{font-size:18px;line-height:1.1;color:var(--nav);font-weight:800;letter-spacing:.15px}
      .plan-cn-title{font-size:13px;color:#475467;font-weight:700}
      .plan-head-actions{display:flex;align-items:center;justify-content:flex-end;gap:14px;flex-wrap:nowrap}.plan-status{flex:0 0 auto}
      .plan-status-badge{display:inline-flex;align-items:center;border-radius:99px;padding:5px 9px;font-size:10px;font-weight:800;white-space:nowrap}
      .plan-status-badge.recommended{background:#eaf2ff;color:var(--blue)}
      .plan-status-badge.current{background:#eef7f3;color:var(--green)}
      .plan-status-badge.optional{background:#f2f4f7;color:#667085}
      .plan-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;align-items:stretch;min-height:0}
      .plan-copy{min-width:0;padding:13px 17px 14px 18px;display:flex;flex-direction:column}
      .plan-subtitle{font-size:11px;color:var(--nav);font-weight:800;letter-spacing:.1px;margin-bottom:7px}
      .plan-config{padding-bottom:12px}
      .plan-copy ul{margin:0;padding-left:18px;min-height:0!important;font-size:11px;line-height:1.72;color:#475467;columns:1}
      .plan-copy li{break-inside:avoid;margin:0 0 2px}
      .plan-major{border-top:1px solid #e6ebf1;padding:10px 0 11px}.plan-major-list{margin:0!important;padding-left:18px!important}.plan-empty-line{font-size:10px;color:#98a2b3;padding:2px 0 3px}
      .plan-meta{border-top:1px solid #e6ebf1;padding-top:10px;display:grid;grid-template-columns:1fr;gap:7px}
      .plan-meta .plan-subtitle{margin-bottom:1px}
      .plan-meta-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;align-items:start;font-size:10px;line-height:1.55}
      .plan-meta-row span{color:var(--muted);font-weight:700}
      .plan-meta-row b{font-weight:600;color:#344054;word-break:break-word}
      .plan-meta-row.risk b{color:#9a5b08}
      .plan-meta-row.cost b{display:inline-flex;justify-self:start;padding:3px 8px;border-radius:99px;background:#eef4ff;color:#1557d6;font-size:10px}
      .plan-radio-label{display:inline-flex;align-items:center;gap:7px;color:#475467;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
      .plan-radio-label input{width:auto;margin:0}
      .plan-media{min-width:0;min-height:0;border-left:1px solid #edf0f4;padding:0;position:relative;align-self:stretch;background:#fbfcfe;overflow:hidden}
      .plan-image-box{position:absolute;inset:0;width:auto;height:auto;min-width:0;min-height:0;border:0;border-radius:0;background:#f5f8fc;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .plan-image-box img{width:100%;height:100%;object-fit:contain;display:block;background:#fff}
      .plan-image-caption{position:absolute;left:10px;right:10px;bottom:8px;margin:0!important;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.88);backdrop-filter:blur(2px)}
      .plan-image-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--muted);padding:16px;min-height:100%;letter-spacing:.3px}
      .plan-image-placeholder b{font-size:11px;color:#65758a}
      .plan-image-placeholder small{font-size:9px;margin-top:5px;color:#98a2b3}
      .plan-image-caption{font-size:9px;color:var(--muted);text-align:center;margin-top:6px;line-height:1.4}
      .plan-selection-note{display:inline-block;margin-top:4px;color:#475467}
      @media(max-width:1080px){
        .plan-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
        .plan-copy ul{columns:1}
      }
      @media(max-width:720px){
        #plan .plan-grid{gap:14px}
        .plan-head{align-items:flex-start}
        .plan-head h4{flex-direction:column;gap:3px}
        .plan-head-actions{align-items:flex-end;gap:8px;flex-wrap:wrap}
        .plan-level{font-size:17px}
        .plan-cn-title{font-size:12px}
        .plan-main{grid-template-columns:1fr;min-height:0}
        .plan-copy{padding:13px 14px}
        .plan-media{border-left:0;border-top:1px solid #edf0f4;padding:0;display:block;min-height:0;aspect-ratio:4/3}
        .plan-image-box{position:absolute;inset:0;height:auto;min-height:0;aspect-ratio:auto;max-height:none}
        .plan-meta-row{grid-template-columns:78px 1fr}
      }
      @media(max-width:480px){
        .plan-head{padding:10px 12px}
        .plan-copy{padding:12px}
        .plan-status-badge{padding:4px 7px;font-size:9px}
      }
    `;document.head.appendChild(st);
  }

  if(Object.keys(env||{}).length&&selectedScene)renderPlans();
})();
