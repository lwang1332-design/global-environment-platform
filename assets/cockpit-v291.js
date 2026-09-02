/* V2.9.1 Scientific Engineering Cockpit interactions
 * Presentation / information hierarchy only.
 * Reads existing result/cache/current/params/V29Config/V29JointResult.
 * No business formula, API, score or matrix recalculation is introduced here.
 */
(()=>{
'use strict';
const q=(s,r=document)=>r?.querySelector?.(s)||null;
const qa=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>Number.isFinite(Number(v));

function globals(){
 let r={},c={},cur={},p={},v29={};
 try{r=result||{}}catch{}
 try{c=cache||{}}catch{}
 try{cur=current||{}}catch{}
 try{p=params||{}}catch{}
 try{v29=window.V29Config?.state||{}}catch{}
 return{r,c,cur,p,v29};
}
function summaryMap(){
 const m={};
 qa('#uiDecisionSummary .uiSummaryCard').forEach(card=>{
   const label=q('.uiSummaryLabel',card);
   let k='';
   if(label){k=[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||label.textContent.trim()}
   m[k]={value:q('.uiSummaryValue',card)?.textContent?.trim()||'--',explain:q('.uiSummaryExplain',card)?.textContent?.trim()||''};
 });
 return m;
}
function getByPrefix(m,prefix){const k=Object.keys(m).find(x=>x.startsWith(prefix));return k?m[k]:{value:'--',explain:'等待真实数据评估'}}
function levelByScore(v){v=Number(v);if(!Number.isFinite(v))return'--';return v>=80?'CRITICAL':v>=60?'HIGH':v>=30?'MEDIUM':'LOW'}

function renderHero(){
 const pad=q('.summaryCard>.pad');if(!pad)return;
 let box=q('#cockpitHeroDecision',pad);
 if(!box){box=document.createElement('div');box.id='cockpitHeroDecision';box.className='cockpitHeroDecision';pad.prepend(box)}
 const m=summaryMap(),sev=getByPrefix(m,'环境严重度'),gap=getByPrefix(m,'设计缺口'),top=getByPrefix(m,'TOP环境');
 const level=levelByScore(parseFloat(sev.value));
 box.innerHTML=`<div class="heroDecisionMain"><span>综合环境风险</span><strong>${esc(sev.value)} <em>${esc(level)}</em></strong><p>${esc(sev.explain)}</p></div><div class="heroDecisionJudgements"><div><span>环境严酷等级</span><b>${esc(level)}</b></div><div><span>Design Gap</span><b>${esc(gap.value)}</b></div><div><span>TOP1 环境风险</span><b>${esc(top.value)}</b></div></div>`;
 const {r,c,cur,v29}=globals(),meta=q('#cockpitProjectMeta');
 if(meta){
   const parts=String(cur.name||'--').split(/\s*[·,]\s*/).filter(Boolean),region=parts.slice(1).join(' · ')||'--';
   const period=c?.w?`${c.w.start||'--'} ~ ${c.w.end||'--'}`:'--';
   const ver=v29.official?.version||v29.local?.version||'V2.9-DEFAULT';
   meta.innerHTML=`<div><span>项目名称</span><b>${esc(parts[0]||cur.name||'--')}</b></div><div><span>国家 / 区域</span><b>${esc(region)}</b></div><div><span>经纬度</span><b>${finite(cur.lat)?Number(cur.lat).toFixed(4):'--'}, ${finite(cur.lon)?Number(cur.lon).toFixed(4):'--'}</b></div><div><span>海拔</span><b>${finite(r?.base?.elev)?Number(r.base.elev).toFixed(0)+' m':'--'}</b></div><div><span>数据周期</span><b>${esc(period)}</b></div><div><span>数据更新时间</span><b>${esc(c?.w?.end||'--')}</b></div><div><span>参数版本</span><b>${esc(ver)}</b></div>`;
 }
}

function enhanceKpis(){}

let riskExpanded=false;
function applyRiskTop5(){
 const list=q('#riskList');if(!list)return;
 const rows=qa('.riskrow',list);rows.forEach((r,i)=>r.hidden=!riskExpanded&&i>=5);
 let btn=q('#cockpitRiskToggle');
 if(rows.length>5){
   if(!btn){btn=document.createElement('button');btn.id='cockpitRiskToggle';btn.className='cockpitRiskToggle';list.after(btn);btn.onclick=()=>{riskExpanded=!riskExpanded;applyRiskTop5()}}
   btn.hidden=false;btn.textContent=riskExpanded?'收起，仅看 TOP 5':`展开全部 ${rows.length} 项风险`;
 }else if(btn)btn.hidden=true;
}

function renderSelectedRisk(env,eq){
 const card=q('.matrixCard'),pad=q('.matrixContent',card)||q('.pad',card);if(!pad)return;
 let box=q('#cockpitSelectedRisk',card);if(!box){box=document.createElement('div');box.id='cockpitSelectedRisk';box.className='cockpitSelectedRisk';pad.append(box)}
 let r={},S='--',E='--',reason='由现有环境严重度、设备敏感度和暴露系数共同决定';
 try{r=result||{}}catch{}
 try{S=sensitivity?.[env]?.[eq]??'--'}catch{}
 try{E=exposure?.[eq]??'--'}catch{}
 try{reason=failure?.[env]||reason}catch{}
 const R=r?.matrix?.[env]?.[eq],H=r?.scores?.[env];
 box.innerHTML=`<div><span>环境</span><b>${esc(env||'--')}</b></div><div><span>设备</span><b>${esc(eq||'--')}</b></div><div><span>Risk</span><b>${finite(R)?Number(R).toFixed(0)+'/100':'--'}</b></div><div><span>H / S / E</span><b>${finite(H)?Number(H).toFixed(0):'--'} / ${finite(S)?Number(S).toFixed(0):'--'} / ${finite(E)?Number(E).toFixed(2):'--'}</b></div><div><span>等级</span><b>${levelByScore(R)}</b></div><div class="riskReason"><span>主要原因</span><b>${esc(reason)}</b></div>`;
}
function bindMatrix(){
 const table=q('#matrix');if(!table||table.dataset.scientificBound)return;table.dataset.scientificBound='1';
 table.addEventListener('click',e=>{const c=e.target.closest('.cell');if(c?.dataset.env&&c?.dataset.eq)setTimeout(()=>renderSelectedRisk(c.dataset.env,c.dataset.eq),0)});
 table.addEventListener('keydown',e=>{const c=e.target.closest('.cell');if(c&&(e.key==='Enter'||e.key===' '))setTimeout(()=>renderSelectedRisk(c.dataset.env,c.dataset.eq),0)});
}

function renderDecisionCore(){
 const pad=q('.decisionCard>.pad');if(!pad)return;
 let box=q('#cockpitDecisionCore',pad);if(!box){box=document.createElement('div');box.id='cockpitDecisionCore';box.className='cockpitDecisionCore';pad.prepend(box)}
 const src=q('#aiSummary')||q('.decisionCard .ai');
 const html=src?.innerHTML||'<span>等待真实数据评估后生成核心工程结论。</span>';
 box.innerHTML=`<div class="cockpitDecisionFlow"><b>Environment</b><i>→</i><b>Physics</b><i>→</i><b>Equipment</b><i>→</i><b>Engineering Decision</b></div><div class="cockpitDecisionText">${html}</div>`;
}

function trustLine(card,source){
 if(!card)return;let line=q('.cockpitTrustLine',card);if(!line){line=document.createElement('div');line.className='cockpitTrustLine';card.append(line)}
 const {c}=globals(),hours=c?.w?.j?.hourly?.time?.length||0,period=c?.w?`${c.w.start||'--'} ~ ${c.w.end||'--'}`:'等待数据',updated=c?.w?.end||'--';
 line.innerHTML=`<b>${esc(source)}</b> · ${esc(period)}${hours?` · ${hours.toLocaleString()} valid hours`:''} · Updated ${esc(updated)}`;
}
function renderTrust(){
 trustLine(q('.envCard'),'ERA5 / CAMS');
 trustLine(q('.riskCard'),'ERA5 / CAMS → 现有风险模型');
 const jr=window.V29JointResult;trustLine(q('#jointCard'),jr?.ok?`ERA5逐小时共同有效样本 ${jr.valid} h`:'ERA5逐小时共同有效样本');
 trustLine(q('.physicsCard'),'ERA5 / CAMS / 项目参数 → 现有物理模型');
 trustLine(q('.matrixCard'),'现有环境×设备风险矩阵 H / S / E / P');
 trustLine(q('.decisionCard'),'物理模型 + 风险矩阵 + Design Gap');
}

function addAdminHelp(){
 qa('#adminPage .fieldGrid label').forEach(label=>{if(q('.adminHelp',label))return;const h=document.createElement('span');h.className='adminHelp';h.textContent='?';h.tabIndex=0;h.title='沿用现有V2.9参数定义。修改后先“应用并重算”验证结果，再“发布正式参数”同步全网。';label.append(h)})
}

function refresh(){renderHero();enhanceKpis();applyRiskTop5();bindMatrix();renderDecisionCore();renderTrust();addAdminHelp()}
function observe(){
 const list=q('#riskList');if(list&&!list.dataset.scientificObserved){list.dataset.scientificObserved='1';let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(applyRiskTop5,0)}).observe(list,{childList:true})}
 const summary=q('#uiDecisionSummary');if(summary&&!summary.dataset.scientificObserved){summary.dataset.scientificObserved='1';let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(renderHero,0)}).observe(summary,{childList:true,subtree:true,characterData:true})}
 const decision=q('#aiSummary');if(decision&&!decision.dataset.scientificObserved){decision.dataset.scientificObserved='1';let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(renderDecisionCore,0)}).observe(decision,{childList:true,subtree:true,characterData:true})}
 const admin=q('#adminPage');if(admin&&!admin.dataset.scientificObserved){admin.dataset.scientificObserved='1';let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(addAdminHelp,0)}).observe(admin,{childList:true,subtree:true})}
}
window.CockpitScientific={refresh};
function init(){refresh();observe();setTimeout(refresh,350);setTimeout(refresh,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
