/* Global Environment Platform V3.3 - registry-driven cockpit
 * Makes the metric registry the visible source of truth for core environment cards.
 */
(()=>{
'use strict';
if(window.GEPlatformV33?.installed)return;
const q=(s,r=document)=>r?.querySelector?.(s)||null,qa=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
const finite=v=>Number.isFinite(Number(v)),observed=v=>v!==null&&v!==''&&finite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const META={platformVersion:'V3.3.0',registryVersion:'V3.2.0',buildDate:'2026-09-18',buildId:'20260918-core-env-v33',branch:'main'};
function riskLevel(v){if(!finite(Number(v)))return'待评价';const n=Number(v);return n>=80?'极高风险':n>=60?'高风险':n>=30?'中风险':'低风险'}
function resultSafe(){try{return window.result||result||{}}catch{return{}}}
function moduleRisk(name){
 const r=resultSafe(),s=r.scores||{};
 const map={
  '温度':Math.max(Number(s.高温)||0,Number(s.低温)||0),
  '湿度':s.凝露,
  '降雨':s.强降雨,
  'PM10 / 颗粒物':Math.max(Number(s.粉尘积灰)||0,Number(s.沙蚀)||0),
  '风速':s.极端风,
  '盐雾':s.盐雾,
  '海拔':s.高海拔,
  'SO₂ / 腐蚀气体':r.composite?.corrosion,
  '冰雪冻雨':s.冰雪
 };
 return observed(map[name])?riskLevel(map[name]):'待评价';
}
function decimals(v){const a=Math.abs(Number(v));if(!finite(a))return 1;return a>=100?0:a>=10?1:2}
function valText(i){
 const v=observed(i?.summaryValue)?Number(i.summaryValue):observed(i?.staticValue)?Number(i.staticValue):NaN;
 if(!finite(v))return'--';
 const u=i.summaryUnit||i.unit||'';return v.toFixed(decimals(v))+(u?'<small>'+esc(u)+'</small>':'');
}
function trace(i){
 const c=i.coverageMeta||{},cf=i.confidenceMeta||{},parts=[
  'Source '+(i.source||'N/A'),
  'Type '+(i.dataCode||i.dataClass||'N/A'),
  'Requested '+(c.requestedStart||'--')+'~'+(c.requestedEnd||'--'),
  'Actual '+(c.actualStart||'--')+'~'+(c.actualEnd||'--'),
  'Period '+(finite(c.periodCoveragePercent)?c.periodCoveragePercent.toFixed(1)+'%':'--'),
  'Complete '+(finite(c.dataCompletenessPercent)?c.dataCompletenessPercent.toFixed(1)+'%':'--'),
  'Confidence '+(cf.grade||'--'),
  i.formula?'Formula '+i.formula:''
 ];return parts.filter(Boolean).join(' | ');
}
function cardHtml(mod){
 const inds=mod.indicators||[],first=inds[0],rest=inds.slice(1),risk=moduleRisk(mod.module);
 if(!first)return'';
 const items=rest.map(i=>'<div title="'+esc(trace(i))+'"><span>'+esc(i.name)+'</span><b>'+valText(i)+'</b></div>').join('');
 const conf=first.confidenceMeta?.grade||'--',code=first.dataCode||'N/A';
 return '<article class="cockpitKpi" data-ge-registry="1" title="'+esc(trace(first))+'"><div class="cockpitKpiTop"><span>'+esc(mod.module)+'</span><em>'+esc(risk)+'</em></div><div class="cockpitKpiValue">'+valText(first)+'</div><div class="cockpitKpiLabel">'+esc(first.name)+'</div><div class="cockpitKpiMeta"><span>'+esc(code)+'</span><span>可信 '+esc(conf)+'</span></div><div class="cockpitKpiItems">'+items+'</div></article>';
}
function syncCore(mods){
 window.GE_CORE_ENVIRONMENT_DATA={
  version:META.registryVersion,
  chain:['公开/观测数据','统一Metric Registry','工程/统计计算','Design Gap','风险与工程决策'],
  modules:mods.map(m=>({module:m.module,risk_level:moduleRisk(m.module),indicators:(m.indicators||[]).map(i=>({name:i.name,key:i.key,unit:i.summaryUnit||i.unit,source:i.source,dataClass:i.dataClass,dataCode:i.dataCode,accessStatus:i.accessStatus,confidence:i.confidenceMeta?.grade,formula:i.formula,coverage:i.coverageMeta,design:i.design,summaryValue:i.summaryValue,staticValue:i.staticValue}))}))
 };
}
function renderCards(){
 const A=window.GETrendAnalysis,box=q('#cockpitKpiGrid');if(!A?.prepareAll||!box)return false;
 const mods=A.prepareAll();if(!mods.length)return false;
 const sig=mods.map(m=>m.module+':'+(m.indicators||[]).map(i=>String(i.summaryValue??i.staticValue??'na')).join(',')).join('|');
 if(box.dataset.geRegistrySig===sig&&qa('[data-ge-registry="1"]',box).length===mods.length){syncCore(mods);return true}
 box.dataset.geRegistrySig=sig;box.innerHTML=mods.map(cardHtml).join('');syncCore(mods);
 window.GETrendModal?.init?.();return true;
}
function statusClass(s){return s==='A'?'ok':s==='B'?'partial':s==='C'?'model':s==='D'?'regional':'limited'}
function renderSources(){
 const A=window.GETrendAnalysis,host=q('#cockpitSourceBody')||q('#cockpitSources');if(!A?.sourceStatus||!host)return;
 let box=q('#v33SourceStatus',host);if(!box){box=document.createElement('div');box.id='v33SourceStatus';box.className='v33SourceStatus';host.append(box)}
 const rows=A.sourceStatus();
 box.innerHTML='<div class="v33SourceTitle"><b>V3.3 数据源健康与覆盖</b><span>Actual coverage / completeness / fallback</span></div><div class="v33SourceGrid">'+rows.map(x=>'<div class="v33SourceItem"><span class="v33Dot '+statusClass(x.status)+'"></span><div><b>'+esc(x.name)+'</b><small>'+esc(x.source||'')+'</small></div><em>'+esc(x.status||'--')+'</em><p>'+esc((x.start||'--')+' ~ '+(x.end||'--'))+' · '+esc(x.note||'')+'</p></div>').join('')+'</div>';
}
function renderVersion(){
 document.title='全球风电机组环境适应性评估平台 '+META.platformVersion+' 工程分析版';
 const v=q('.ver');if(v)v.textContent=META.platformVersion+' · Registry唯一化 + 时序工程分析';
 const meta=q('#cockpitProjectMeta');if(meta){
  let row=q('[data-v33-version]',meta);if(!row){row=document.createElement('div');row.dataset.v33Version='1';meta.append(row)}
  row.innerHTML='<span>平台/模型版本</span><b>'+META.platformVersion+' / '+META.registryVersion+'</b>';
 }
 const host=q('#cockpitSources');if(host){
  let foot=q('#v33BuildMeta',host);if(!foot){foot=document.createElement('div');foot.id='v33BuildMeta';foot.className='v33BuildMeta';host.append(foot)}
  foot.textContent='Platform '+META.platformVersion+' · Registry '+META.registryVersion+' · Build '+META.buildDate+' · '+META.buildId+' · GitHub '+META.branch;
 }
}
function injectStyle(){
 if(q('#v33CockpitStyle'))return;const s=document.createElement('style');s.id='v33CockpitStyle';s.textContent=
 '.cockpitKpiMeta{display:flex;gap:5px;margin:2px 0 4px;font-size:7px;color:#667085}.cockpitKpiMeta span{padding:1px 4px;border:1px solid #e3e8f0;border-radius:999px;background:#fbfcff}.v33SourceStatus{margin-top:8px;border:1px solid #e3e8f0;border-radius:10px;background:#fff;padding:8px}.v33SourceTitle{display:flex;justify-content:space-between;gap:10px;color:#0a2a59;font-size:9px;margin-bottom:6px}.v33SourceTitle span{color:#667085;font-size:8px}.v33SourceGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.v33SourceItem{display:grid;grid-template-columns:auto 1fr auto;gap:5px 6px;align-items:center;border:1px solid #edf1f5;border-radius:8px;padding:6px}.v33SourceItem div{min-width:0}.v33SourceItem b{display:block;font-size:8.5px;color:#1e293b}.v33SourceItem small{display:block;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:7px}.v33SourceItem em{font-size:8px;font-style:normal;font-weight:800;color:#0a2a59}.v33SourceItem p{grid-column:2/4;margin:0;color:#667085;font-size:7px}.v33Dot{width:7px;height:7px;border-radius:50%;background:#98a2b3}.v33Dot.ok{background:#0f9d68}.v33Dot.partial{background:#1769e0}.v33Dot.model{background:#7c3aed}.v33Dot.regional{background:#e59b13}.v33Dot.limited{background:#98a2b3}.v33BuildMeta{padding:7px 2px 0;color:#98a2b3;font-size:7px;text-align:right}@media(max-width:900px){.v33SourceGrid{grid-template-columns:1fr}}';
 document.head.appendChild(s);
}
let timer=null;
function refresh(){injectStyle();renderVersion();renderCards();renderSources()}
function observe(){
 const root=q('#cockpitKpiGrid');if(root&&!root.dataset.v33Observed){root.dataset.v33Observed='1';new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,20)}).observe(root,{childList:true,subtree:true})}
 document.addEventListener('ge:v33-data-updated',()=>setTimeout(refresh,0));
}
function init(){refresh();observe();setTimeout(refresh,600);setTimeout(refresh,1800)}
window.GEPlatformV33={installed:true,version:META.platformVersion,meta:META,refresh,renderCards,renderSources};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();