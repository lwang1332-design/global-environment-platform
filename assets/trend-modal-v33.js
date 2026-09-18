/* Global Environment Platform V3.3 - unified engineering time-series UI */
(()=>{
'use strict';
const A=()=>window.GETrendAnalysis;
const q=(s,r=document)=>r?.querySelector?.(s)||null,qa=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
const finite=Number.isFinite,observed=v=>v!==null&&v!==''&&finite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,n=2)=>observed(v)?Number(v).toFixed(n):'--';
const COLORS=['#1769e0','#0f9d68','#d92d20','#e59b13','#7c3aed','#0891b2','#e11d48','#475467','#16a34a','#ea580c','#4f46e5','#0f766e'];
const S={catalog:[],module:null,mode:'combo',selected:new Set(),focus:null,axes:new Map(),hidden:new Set(),view:null,scale:'absolute',notice:'',brush:null};
function injectStyle(){
 if(q('#geTrendV33Style'))return;
 const s=document.createElement('style');s.id='geTrendV33Style';
 s.textContent='#geTrendHost,#geMetricDetailHost{position:fixed;inset:0;z-index:7600;display:none;align-items:center;justify-content:center;padding:12px;background:rgba(15,23,42,.55);backdrop-filter:blur(3px)}#geMetricDetailHost{z-index:7700}.geV33Show{display:flex!important}.geV33Modal{width:min(97vw,1580px);max-height:95vh;display:flex;flex-direction:column;background:#fff;border:1px solid #dfe6ef;border-radius:14px;box-shadow:0 30px 90px rgba(15,23,42,.3);overflow:hidden}.geV33Head{display:flex;justify-content:space-between;gap:12px;padding:12px 15px 10px;border-bottom:1px solid #e3e8f0;background:#fbfcff}.geV33Head h2{margin:0;color:#0a2a59;font-size:17px}.geV33Meta{display:flex;gap:5px 13px;flex-wrap:wrap;margin-top:5px;color:#667085;font-size:8px}.geV33Meta b{color:#344054}.geV33Close{width:34px;height:34px;border:1px solid #dfe6ef!important;background:#fff!important;color:#0a2a59!important;border-radius:8px;font-size:19px}.geV33Body{padding:10px 13px 15px;overflow:auto}.geV33Toolbar{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}.geV33Left,.geV33Right{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.geV33Seg{display:flex;border:1px solid #dfe6ef;border-radius:8px;overflow:hidden}.geV33Seg button,.geV33Btn{height:30px;padding:0 10px;border:0;border-radius:0;background:#fff;color:#475467;font-size:8.5px}.geV33Seg button.active{background:#0a2a59;color:#fff}.geV33Btn{border:1px solid #dfe6ef!important;border-radius:7px!important;background:#fff!important;color:#344054!important}.geV33Selector{border:1px solid #e3e8f0;border-radius:10px;background:#fbfcff;padding:7px;margin-bottom:8px}.geV33SelectorTitle{display:flex;justify-content:space-between;color:#667085;font-size:8px;margin-bottom:5px}.geV33Groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.geV33Group{border:1px solid #e5eaf1;border-radius:7px;background:#fff}.geV33Group summary{padding:6px 7px;cursor:pointer;color:#0a2a59;font-size:8.5px;font-weight:800}.geV33List{padding:0 5px 5px}.geV33Metric{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:4px;padding:4px;border-top:1px dashed #edf1f5;font-size:8px;cursor:pointer}.geV33Metric.sel{background:#eef4ff}.geV33Metric.na{opacity:.65;background:#f8fafc}.geV33Axis{height:22px!important;padding:0 2px!important;font-size:7px!important}.geV33Tag{padding:2px 4px;border-radius:999px;background:#f2f4f7;color:#667085;font-size:6.5px;font-weight:800}.geV33Tag.REA,.geV33Tag.OBS{background:#e8f7ef;color:#087a50}.geV33Tag.MODEL{background:#eef4ff;color:#1769e0}.geV33Tag.ENG{background:#f3e8ff;color:#7c3aed}.geV33Tag.GIS{background:#ecfeff;color:#0e7490}.geV33Panel{border:1px solid #e3e8f0;border-radius:10px;background:#fff;padding:8px;margin-top:8px}.geV33PanelHead{display:flex;justify-content:space-between;gap:7px;margin-bottom:5px}.geV33PanelHead b{color:#0a2a59;font-size:9.5px}.geV33PanelHead span{color:#667085;font-size:7.5px}.geV33Legend{display:flex;gap:5px 8px;flex-wrap:wrap;margin-bottom:4px}.geV33Legend button{height:23px;padding:0 5px;border:1px solid #e3e8f0;background:#fff;color:#475467;border-radius:6px;font-size:7.5px;display:flex;gap:4px;align-items:center}.geV33Legend button.off{opacity:.38;text-decoration:line-through}.geV33Legend i{width:13px;height:3px;border-radius:2px}.geV33Chart{position:relative;overflow:hidden}.geV33Chart svg{width:100%;height:370px;display:block;touch-action:none;cursor:crosshair}.geV33Tip{position:absolute;display:none;z-index:5;pointer-events:none;max-width:350px;padding:6px 8px;border-radius:7px;background:rgba(15,23,42,.95);color:#fff;font-size:8px;line-height:1.5}.geV33Stats{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:6px}.geV33Stat{border:1px solid #edf1f5;border-radius:7px;padding:6px}.geV33Stat span{display:block;color:#667085;font-size:7px}.geV33Stat b{display:block;color:#0a2a59;font-size:11px;margin-top:2px}.geV33Table{width:100%;border-collapse:collapse;font-size:7.5px}.geV33Table th,.geV33Table td{padding:5px;border-bottom:1px dashed #edf1f5;text-align:left}.geV33Table th{color:#667085}.geV33Corr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.geV33Corr>div{border:1px solid #edf1f5;border-radius:7px;padding:6px}.geV33Corr span{display:block;color:#667085;font-size:7px}.geV33Corr b{display:block;color:#0a2a59;font-size:10px;margin:2px 0}.geV33Notice{padding:8px 9px;border:1px solid #f4d58d;border-left:4px solid #e59b13;border-radius:8px;background:#fff7e8;color:#694b00;font-size:8px;line-height:1.55;margin:6px 0}.geV33Detail{width:min(92vw,620px);max-height:90vh;overflow:auto;background:#fff;border-radius:14px;border:1px solid #dfe6ef;box-shadow:0 28px 80px rgba(15,23,42,.3)}.geV33DetailHead{display:flex;justify-content:space-between;padding:14px 15px 9px;border-bottom:1px solid #e3e8f0;background:#fbfcff}.geV33DetailHead h3{margin:0;color:#0a2a59;font-size:14px}.geV33Value{font-size:22px;font-weight:900;color:#1769e0;margin-top:4px}.geV33Rows{display:grid;grid-template-columns:150px 1fr;padding:8px 14px}.geV33Rows span,.geV33Rows b{padding:6px 4px;border-bottom:1px dashed #edf1f5;font-size:8.5px}.geV33Rows span{color:#667085}.geV33Rows b{color:#1e293b}.geV33Actions{display:flex;justify-content:flex-end;gap:7px;padding:0 14px 13px}.geV33Actions button{height:31px}.geV33Empty{padding:22px;text-align:center;color:#667085}.geV33Brush{fill:rgba(23,105,224,.10);stroke:#1769e0;stroke-dasharray:4 3}.cockpitKpiValue.geV33Click,.cockpitKpiItems b.geV33Click{cursor:pointer;text-decoration:underline dotted #98a2b3;text-underline-offset:3px}.geV33TrendBtn{position:absolute!important;right:8px;bottom:7px;height:25px!important;padding:0 8px!important;border:1px solid #d7e5ff!important;background:#f6f9ff!important;color:#1769e0!important;border-radius:999px!important;font-size:8px!important;z-index:5}@media(max-width:1000px){.geV33Groups{grid-template-columns:1fr 1fr}.geV33Stats{grid-template-columns:repeat(3,1fr)}.geV33Corr{grid-template-columns:1fr 1fr}}@media(max-width:700px){#geTrendHost,#geMetricDetailHost{padding:4px}.geV33Modal{width:99vw;max-height:97vh}.geV33Groups{grid-template-columns:1fr}.geV33Stats{grid-template-columns:repeat(2,1fr)}.geV33Corr{grid-template-columns:1fr}.geV33Chart svg{height:310px}.geV33Rows{grid-template-columns:110px 1fr}}';
 document.head.appendChild(s);
}
function trendHost(){
 let h=q('#geTrendHost');if(h)h.remove();
 h=document.createElement('div');h.id='geTrendHost';h.setAttribute('role','dialog');h.innerHTML='<section class="geV33Modal"><header class="geV33Head"><div><h2 id="geV33Title">核心环境数据时序分析</h2><div class="geV33Meta" id="geV33Meta"></div></div><button class="geV33Close" type="button">×</button></header><div class="geV33Body" id="geV33Body"></div></section>';
 document.body.appendChild(h);q('.geV33Close',h).onclick=close;h.addEventListener('mousedown',e=>{if(e.target===h)close()});return h;
}
function detailHost(){
 let h=q('#geMetricDetailHost');if(h)h.remove();
 h=document.createElement('div');h.id='geMetricDetailHost';h.innerHTML='<section class="geV33Detail" id="geV33Detail"></section>';document.body.appendChild(h);h.addEventListener('mousedown',e=>{if(e.target===h)closeDetail()});return h;
}
function close(){q('#geTrendHost')?.classList.remove('geV33Show')}
function closeDetail(){q('#geMetricDetailHost')?.classList.remove('geV33Show')}
function refreshCatalog(){S.catalog=A()?.prepareAll?.()||[]}
function all(){return S.catalog.flatMap(m=>m.indicators||[])}
function byId(id){return all().find(i=>i.id===id)||null}
function module(name){return S.catalog.find(m=>m.module===name)||null}
function byName(mod,name){refreshCatalog();const m=module(mod),direct=m?.indicators?.find(i=>i.name===name);if(direct)return direct;return A()?.prepareIndicatorByName?.(mod,name)||null}
function selected(){return [...S.selected].map(byId).filter(i=>i?.trendAvailable)}
function bounds(inds){let a=Infinity,b=-Infinity;inds.forEach(i=>{const r=i.raw||i.series||[];if(r.length){a=Math.min(a,r[0].ts);b=Math.max(b,r.at(-1).ts)}});return finite(a)&&finite(b)?{start:a,end:b}:null}
function setFull(inds){const b=bounds(inds);S.view=b?{start:b.start,end:b.end,fullStart:b.start,fullEnd:b.end}:null}
function ensureView(inds){const b=bounds(inds);if(!b){S.view=null;return}if(!S.view||S.view.end<b.start||S.view.start>b.end)S.view={start:b.start,end:b.end,fullStart:b.start,fullEnd:b.end};else{S.view.fullStart=b.start;S.view.fullEnd=b.end;S.view.start=Math.max(S.view.start,b.start);S.view.end=Math.min(S.view.end,b.end)}}
function timeLabel(ts,span){const d=new Date(ts),Y=d.getUTCFullYear(),M=String(d.getUTCMonth()+1).padStart(2,'0'),D=String(d.getUTCDate()).padStart(2,'0'),H=String(d.getUTCHours()).padStart(2,'0');if(span<3*864e5)return M+'-'+D+' '+H+':00';if(span<120*864e5)return Y+'-'+M+'-'+D;if(span<2.2*365.25*864e5)return Y+'-'+M;return String(Y)}
function color(i){const k=Math.max(0,all().findIndex(x=>x.id===i.id));return COLORS[k%COLORS.length]}
function valueText(i){const v=observed(i?.summaryValue)?i.summaryValue:i?.staticValue;return observed(v)?Number(v).toFixed(Math.abs(Number(v))>=100?0:Math.abs(Number(v))>=10?1:2)+' '+(i.summaryUnit||i.unit||''):'N/A'}
function designText(i){const d=i?.design;if(!d)return'未配置';const a=[];if(observed(d.lower))a.push('≥ '+d.lower);if(observed(d.upper))a.push('≤ '+d.upper);return a.join(' / ')+' '+(i.summaryUnit||i.unit||'')}
function gapText(i){
 const e=i?.designEvaluation;if(!e)return'N/A';const u=i.summaryUnit||i.unit||'';
 return e.pass?'设计裕量 '+fmt(Math.max(0,e.margin||0),2)+' '+u:'Design Gap +'+fmt(Math.abs(e.gap||0),2)+' '+u;
}
function openDetail(mod,name,text){
 const i=byName(mod,name);if(!i)return;const h=q('#geMetricDetailHost')||detailHost(),d=q('#geV33Detail',h),c=i.coverageMeta||{},cf=i.confidenceMeta||{};
 d.innerHTML='<div class="geV33DetailHead"><div><h3>'+esc(mod)+' · '+esc(name)+'</h3><div class="geV33Value">'+esc(text||valueText(i))+'</div></div><button class="geV33Close" data-x>×</button></div><div class="geV33Rows"><span>数据来源</span><b>'+esc(i.source||'N/A')+'</b><span>请求周期</span><b>'+esc((c.requestedStart||'--')+' ～ '+(c.requestedEnd||'--'))+'</b><span>实际数据周期</span><b>'+esc((c.actualStart||'--')+' ～ '+(c.actualEnd||'--'))+'</b><span>请求周期覆盖率</span><b>'+esc(observed(c.periodCoveragePercent)?fmt(c.periodCoveragePercent,1)+'%':'N/A')+'</b><span>数据完整率</span><b>'+esc(observed(c.dataCompletenessPercent)?fmt(c.dataCompletenessPercent,1)+'%':'N/A')+'</b><span>数据类型</span><b>'+esc((i.dataCode||'N/A')+' · '+(i.dataClass||''))+'</b><span>可信度</span><b>'+esc((cf.grade||'N/A')+(observed(cf.score)?' · '+fmt(cf.score,0)+'/100':''))+'</b><span>接入状态</span><b>'+esc(i.accessStatus||'N/A')+'</b><span>设计能力</span><b>'+esc(designText(i))+'</b><span>Design Gap / 裕量</span><b>'+esc(gapText(i))+'</b><span>原始字段/分辨率</span><b>'+esc([i.sourceVariable,i.rawResolution].filter(Boolean).join(' · ')||'N/A')+'</b><span>计算公式</span><b>'+esc(i.formula||'—')+'</b><span>边界说明</span><b>'+esc([i.method,i.note].filter(Boolean).join('；')||'—')+'</b></div><div class="geV33Actions"><button class="geV33Btn" data-close>关闭</button><button data-trend>'+esc(i.trendAvailable?'查看趋势':'查看数据状态')+'</button></div>';
 q('[data-x]',d).onclick=closeDetail;q('[data-close]',d).onclick=closeDetail;q('[data-trend]',d).onclick=()=>{closeDetail();open(mod,i.key)};
 h.classList.add('geV33Show');
}
function open(mod,ref=null){
 if(!A())return;refreshCatalog();S.module=mod;S.notice='';S.hidden.clear();S.axes.clear();S.scale='absolute';
 const m=module(mod)||S.catalog[0];if(!m)return;
 if(ref){
  const i=m.indicators.find(x=>x.key===ref||x.id===ref||x.name===ref)||m.indicators[0];S.mode='single';S.focus=i?.id||null;S.selected=new Set(i?[i.id]:[]);setFull(i?.trendAvailable?[i]:[]);
 }else{
  S.mode='combo';S.focus=m.indicators.find(i=>i.trendAvailable)?.id||null;S.selected=new Set(m.defaultSelected||[]);setFull(selected());
 }
 const h=q('#geTrendHost')||trendHost();q('#geV33Title').textContent=m.module+' · 核心环境数据时序分析';
 let cur={};try{cur=window.current||current||{}}catch{}
 q('#geV33Meta').innerHTML='<span>项目：<b>'+esc(cur.name||'--')+'</b></span><span>坐标：<b>'+esc(observed(cur.lat)?Number(cur.lat).toFixed(4):'--')+', '+esc(observed(cur.lon)?Number(cur.lon).toFixed(4):'--')+'</b></span><span>请求周期：<b>'+esc(A().selectedYears?.()||'--')+'年</b></span><span>显示：<b>原始/工程时序</b></span><span>趋势：<b>月均去季节化 + MK/Sen</b></span>';
 render();h.classList.add('geV33Show');
}
function toolbar(){
 return '<div class="geV33Toolbar"><div class="geV33Left"><div class="geV33Seg"><button data-mode="combo" class="'+(S.mode==='combo'?'active':'')+'">组合时序</button><button data-mode="single" class="'+(S.mode==='single'?'active':'')+'">单指标分析</button></div><button class="geV33Btn" data-zoom="in">＋ 放大</button><button class="geV33Btn" data-zoom="out">－ 缩小</button><button class="geV33Btn" data-zoom="reset">恢复全局</button><div class="geV33Seg"><button data-scale="absolute" class="'+(S.scale==='absolute'?'active':'')+'">绝对值</button><button data-scale="normalized" class="'+(S.scale==='normalized'?'active':'')+'">归一化</button></div><button class="geV33Btn" data-export>导出当前窗口CSV</button></div><div class="geV33Right"><span style="font-size:8px;color:#667085">滚轮缩放 · 拖动平移 · Shift+拖动框选分析区间</span></div></div>';
}
function selector(){
 const html=S.catalog.map(m=>'<details class="geV33Group" '+(m.module===S.module?'open':'')+'><summary>'+esc(m.module)+'</summary><div class="geV33List">'+m.indicators.map(i=>{const sel=S.mode==='single'?S.focus===i.id:S.selected.has(i.id),ax=S.axes.get(i.id)||'auto',na=!i.trendAvailable&&i.staticValue===null;return '<div class="geV33Metric '+(sel?'sel ':'')+(na?'na':'')+'" data-id="'+esc(i.id)+'"><input type="'+(S.mode==='single'?'radio':'checkbox')+'" '+(sel?'checked':'')+'><span title="'+esc(i.note||i.source||'')+'">'+esc(i.name)+'</span><em class="geV33Tag '+esc(i.dataCode||'N/A')+'">'+esc(i.dataCode||'N/A')+'</em>'+(S.mode==='combo'&&sel&&i.trendAvailable&&S.scale==='absolute'?'<select class="geV33Axis" data-axis="'+esc(i.id)+'"><option value="auto" '+(ax==='auto'?'selected':'')+'>Auto</option><option value="0" '+(ax==='0'?'selected':'')+'>Y1</option><option value="1" '+(ax==='1'?'selected':'')+'>Y2</option><option value="2" '+(ax==='2'?'selected':'')+'>Y3</option></select>':'<i></i>')+'</div>'}).join('')+'</div></details>').join('');
 return '<div class="geV33Selector"><div class="geV33SelectorTitle"><b>一级 / 二级指标</b><span>支持跨一级模块组合；N/A不生成伪时序</span></div><div class="geV33Groups">'+html+'</div></div>';
}
function stat(k,v){return '<div class="geV33Stat"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'}
function singleTop(i){
 if(i.staticValue!==null&&!i.trendAvailable)return '<div class="geV33Panel"><div class="geV33Stats">'+stat('静态值',valueText(i))+stat('接入状态',i.accessStatus||'--')+stat('数据类型',i.dataCode||'GIS')+stat('趋势','静态量不绘制')+'</div></div>';
 if(!i.trendAvailable)return '<div class="geV33Notice"><b>'+esc(i.name)+'：当前无可靠时间序列。</b><br>接入状态：'+esc(i.accessStatus||'N/A')+' · 候选来源：'+esc(i.source||'--')+'<br>'+esc(i.note||'不生成代理/随机数据。')+'</div>';
 const a=i.analysis||{},t=i.trendStats?.analysis||{},e=i.exceedance||{};
 return '<div class="geV33Stats">'+stat('当前/最新',fmt(a.current)+' '+i.unit)+stat('Mean',fmt(a.mean)+' '+i.unit)+stat('P95 / P99',fmt(a.p95)+' / '+fmt(a.p99)+' '+i.unit)+stat('去季节趋势',(t.trendDirection||'--')+' · '+(observed(t.slopePerYear)?fmt(t.slopePerYear,3)+' '+i.unit+'/y':'--'))+stat('MK p值',observed(t.pValue)?fmt(t.pValue,3):'--')+stat('超限事件',String(e.count||0))+stat('累计超限',fmt(e.totalHours||0,1)+' h')+stat('最长连续',fmt(e.longestHours||0,1)+' h')+stat('最大 / P95 Gap',fmt(e.maxGap||0)+' / '+fmt(e.p95Gap||0)+' '+i.unit)+stat('可信度',(i.confidenceMeta?.grade||'--')+' '+fmt(i.confidenceMeta?.score,0)+'/100')+stat('周期覆盖',fmt(i.coverageMeta?.periodCoveragePercent,1)+'%')+stat('完整率',fmt(i.coverageMeta?.dataCompletenessPercent,1)+'%')+'</div>';
}
function windowStats(inds){
 if(!S.view||!A()?.rangeStats)return'';
 const rows=inds.map(i=>{const x=A().rangeStats(i,S.view.start,S.view.end),e=x.events||{};return '<tr><td>'+esc(i.name)+'</td><td>'+esc(x.count||0)+'</td><td>'+esc(observed(x.mean)?fmt(x.mean):'--')+'</td><td>'+esc(observed(x.p95)?fmt(x.p95):'--')+'</td><td>'+esc(observed(x.max)?fmt(x.max):'--')+'</td><td>'+esc(e.count||0)+'</td><td>'+esc(fmt(e.totalHours||0,1))+'</td><td>'+esc(fmt(e.longestHours||0,1))+'</td><td>'+esc(fmt(e.maxGap||0))+'</td></tr>'}).join('');
 return '<div class="geV33Panel"><div class="geV33PanelHead"><b>当前窗口工程统计</b><span>'+esc(timeLabel(S.view.start,S.view.end-S.view.start))+' ～ '+esc(timeLabel(S.view.end,S.view.end-S.view.start))+'</span></div><table class="geV33Table"><thead><tr><th>指标</th><th>点数</th><th>Mean</th><th>P95</th><th>Max</th><th>事件</th><th>超限h</th><th>最长h</th><th>Max Gap</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function corrPanel(inds){
 if(inds.length<2||!A()?.correlation)return'';const ref=inds[0];
 const cards=inds.slice(1).map(i=>{const c=A().correlation(ref,i),l=A().lagCorrelation?.(ref,i),b=l?.best;return '<div><span>'+esc(ref.name)+' ↔ '+esc(i.name)+'</span><b>r='+(observed(c.r)?fmt(c.r,3):'--')+' · n='+esc(c.count||0)+'</b><span>最佳滞后 '+(b?((b.lagHours>=0?'+':'')+b.lagHours+' h · r='+fmt(b.r,3)):'--')+'</span></div>'}).join('');
 return '<div class="geV33Panel"><div class="geV33PanelHead"><b>关联 / 滞后相关</b><span>第一条曲线为参考；相关不等于因果</span></div><div class="geV33Corr">'+cards+'</div></div>';
}
function bodyContent(){
 const inds=S.mode==='single'?[byId(S.focus)].filter(Boolean):selected();
 if(!inds.length)return '<div class="geV33Empty">请选择至少一个可用时序指标。</div>';
 const top=S.mode==='single'?singleTop(inds[0]):(S.notice?'<div class="geV33Notice">'+esc(S.notice)+'</div>':'');
 if(S.mode==='single'&&!inds[0]?.trendAvailable)return top;
 return top+chartPanel(inds)+windowStats(inds)+(S.mode==='combo'?corrPanel(inds):'')+'<div class="geV33Notice"><b>统计口径：</b>曲线展示原始/工程计算时序；长期趋势采用月均去季节化异常序列进行Mann-Kendall和Sen slope辅助判定。缩放后的窗口统计不改变底层数据。</div>';
}
function render(){
 const b=q('#geV33Body');if(!b)return;b.innerHTML=toolbar()+selector()+bodyContent();bind();draw();
}
function axisNeed(ids){
 if(S.scale==='normalized')return 1;const g=new Set();ids.map(byId).filter(Boolean).forEach(i=>{const a=S.axes.get(i.id)||'auto';g.add(a==='auto'?(i.axisGroup||i.unit||i.id):'m'+a)});return g.size;
}
function resolveAxes(inds){
 const out=new Map();if(S.scale==='normalized'){inds.forEach(i=>out.set(i.id,0));return out}
 const groups=new Map();let n=0;inds.forEach(i=>{const m=S.axes.get(i.id);if(m&&m!=='auto'){out.set(i.id,Number(m));return}const g=i.axisGroup||i.unit;if(groups.has(g)){out.set(i.id,groups.get(g));return}const k=Math.min(2,n++);groups.set(g,k);out.set(i.id,k)});return out;
}
function zoom(f){
 if(!S.view)return;const full=S.view.fullEnd-S.view.fullStart,span=Math.max(4*36e5,(S.view.end-S.view.start)*f),next=Math.min(full,span),mid=(S.view.start+S.view.end)/2;let a=mid-next/2,b=mid+next/2;if(a<S.view.fullStart){a=S.view.fullStart;b=a+next}if(b>S.view.fullEnd){b=S.view.fullEnd;a=b-next}S.view.start=a;S.view.end=b;draw();refreshStats();
}
function refreshStats(){const b=q('#geV33Body');if(!b)return;qa('.geV33Panel',b).filter(x=>q('b',x)?.textContent==='当前窗口工程统计'||q('b',x)?.textContent==='关联 / 滞后相关').forEach(x=>x.remove());const inds=S.mode==='single'?[byId(S.focus)].filter(Boolean):selected();const notice=qa('.geV33Notice',b).at(-1);const wrap=document.createElement('div');wrap.innerHTML=windowStats(inds)+(S.mode==='combo'?corrPanel(inds):'');while(wrap.firstChild)b.insertBefore(wrap.firstChild,notice||null)}
function download(){
 const inds=(S.mode==='single'?[byId(S.focus)].filter(Boolean):selected()).filter(i=>i.trendAvailable);if(!inds.length||!S.view||!A()?.exportCsv)return;
 const csv=A().exportCsv(inds,S.view.start,S.view.end),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='environment_timeseries_'+new Date(S.view.start).toISOString().slice(0,10)+'_'+new Date(S.view.end).toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bind(){
 qa('[data-mode]',q('#geV33Body')).forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;S.notice='';if(S.mode==='single'){const i=byId(S.focus)||selected()[0]||all().find(x=>x.trendAvailable)||all()[0];S.focus=i?.id||null;S.selected=new Set(i?[i.id]:[]);setFull(i?.trendAvailable?[i]:[])}else{if(S.focus&&byId(S.focus)?.trendAvailable)S.selected.add(S.focus);setFull(selected())}render()});
 qa('[data-scale]',q('#geV33Body')).forEach(b=>b.onclick=()=>{S.scale=b.dataset.scale;S.notice='';render()});
 qa('[data-zoom]',q('#geV33Body')).forEach(b=>b.onclick=()=>{if(b.dataset.zoom==='reset'){const inds=S.mode==='single'?[byId(S.focus)].filter(Boolean):selected();setFull(inds);draw();refreshStats()}else zoom(b.dataset.zoom==='in'?.55:1.8)});
 q('[data-export]',q('#geV33Body'))?.addEventListener('click',download);
 qa('.geV33Metric',q('#geV33Body')).forEach(el=>el.onclick=e=>{if(e.target.closest('select'))return;const i=byId(el.dataset.id);if(!i)return;if(S.mode==='single'){S.focus=i.id;S.selected=new Set([i.id]);S.module=i.module;setFull(i.trendAvailable?[i]:[]);render();return}if(!i.trendAvailable){S.notice=i.name+'：'+(i.accessStatus||'N/A')+'。'+(i.note||'当前无可靠时序。');render();return}if(S.selected.has(i.id)){S.selected.delete(i.id);S.axes.delete(i.id);S.hidden.delete(i.id)}else{if(S.scale==='absolute'&&axisNeed([...S.selected,i.id])>3){S.notice='绝对值模式最多支持3个独立量纲。可手动共用Y轴，或切换“归一化”继续添加。';render();return}S.selected.add(i.id)}ensureView(selected());render()});
 qa('.geV33Axis',q('#geV33Body')).forEach(s=>{s.onclick=e=>e.stopPropagation();s.onchange=e=>{e.stopPropagation();S.axes.set(s.dataset.axis,s.value);render()}});
 qa('[data-leg]',q('#geV33Body')).forEach(b=>b.onclick=()=>{const id=b.dataset.leg;S.hidden.has(id)?S.hidden.delete(id):S.hidden.add(id);b.classList.toggle('off',S.hidden.has(id));draw()});
}
function chartPanel(inds){
 const axes=resolveAxes(inds),legend=inds.map(i=>'<button data-leg="'+esc(i.id)+'" class="'+(S.hidden.has(i.id)?'off':'')+'"><i style="background:'+color(i)+'"></i>'+esc(i.name)+' · Y'+((axes.get(i.id)||0)+1)+' · '+esc(S.scale==='normalized'?'Index':i.unit)+'</button>').join('');
 return '<div class="geV33Panel"><div class="geV33PanelHead"><b>真实时序 / 工程计算时序</b><span>'+esc(S.scale==='normalized'?'归一化0–1 · 多量纲同步分析':'绝对值 · Y1/Y2/Y3')+'</span></div><div class="geV33Legend">'+legend+'</div><div class="geV33Chart"><svg id="geV33Svg" viewBox="0 0 1220 370" preserveAspectRatio="none"></svg><div class="geV33Tip"></div></div></div>';
}
function rawIn(i,a,b){const r=i.raw||i.series||[];return r.filter(p=>p.ts>=a&&p.ts<=b&&observed(p.value))}
function series(i,a,b){const r=rawIn(i,a,b);return S.scale==='normalized'&&A()?.normalizeSeries?A().normalizeSeries(r,'minmax'):r}
function down(a,n=1800){if(a.length<=n)return a;const out=[],step=a.length/n;for(let k=0;k<n;k++){const s=Math.floor(k*step),e=Math.min(a.length,Math.floor((k+1)*step));if(s>=e)continue;let mn=a[s],mx=a[s];for(let j=s+1;j<e;j++){if(a[j].value<mn.value)mn=a[j];if(a[j].value>mx.value)mx=a[j]}out.push(mn);if(mx!==mn)out.push(mx)}return out.sort((x,y)=>x.ts-y.ts)}
function scales(inds,axes,a,b){
 const v=[[],[],[]];inds.forEach(i=>{if(S.hidden.has(i.id))return;const ax=axes.get(i.id)||0;series(i,a,b).forEach(p=>v[ax].push(Number(p.value)));if(S.scale==='absolute'&&i.design){if(observed(i.design.lower))v[ax].push(Number(i.design.lower));if(observed(i.design.upper))v[ax].push(Number(i.design.upper))}});
 return v.map(x=>{if(!x.length)return null;if(S.scale==='normalized')return{lo:0,hi:1};let lo=Math.min(...x),hi=Math.max(...x);if(lo===hi){const d=Math.abs(lo)*.08||1;lo-=d;hi+=d}const p=(hi-lo)*.08;return{lo:lo-p,hi:hi+p}});
}
function units(inds,axes){if(S.scale==='normalized')return['Index 0–1','',''];const u=[new Set(),new Set(),new Set()];inds.forEach(i=>{if(!S.hidden.has(i.id))u[axes.get(i.id)||0].add(i.unit)});return u.map(s=>[...s].join(' / '))}
function eventBands(i,x,a,b,H,T,B){
 if(S.scale!=='absolute'||!i.design||!A()?.rangeStats)return'';const st=A().rangeStats(i,a,b),events=st.events?.events||[];return events.slice(0,100).map(e=>{const x1=x(Math.max(a,e.start)),x2=x(Math.min(b,e.end));return '<rect x="'+x1.toFixed(1)+'" y="'+T+'" width="'+Math.max(1,x2-x1).toFixed(1)+'" height="'+(H-T-B)+'" fill="'+color(i)+'" opacity=".055"></rect>'}).join('');
}
function draw(){
 const svg=q('#geV33Svg');if(!svg)return;const inds=(S.mode==='single'?[byId(S.focus)].filter(Boolean):selected()).filter(i=>i.trendAvailable);ensureView(inds);if(!S.view||!inds.length){svg.innerHTML='';return}
 const show=inds.filter(i=>!S.hidden.has(i.id));if(!show.length){svg.innerHTML='<text x="500" y="180" fill="#667085">全部曲线已隐藏</text>';return}
 const W=1220,H=370,L=78,R=160,T=22,B=50,PR=W-R,PW=PR-L,PH=H-T-B,a=S.view.start,b=S.view.end,span=Math.max(1,b-a),axes=resolveAxes(inds),sc=scales(inds,axes,a,b),un=units(inds,axes);
 const x=t=>L+(t-a)/span*PW,y=(v,k)=>T+(sc[k].hi-v)/(sc[k].hi-sc[k].lo)*PH;
 let grid='',axis='',ticks='',bands='',lines='',refs='';
 for(let k=0;k<3;k++){if(!sc[k])continue;const axx=k===0?L:k===1?PR:W-18,tx=k===0?4:k===1?PR+8:W-75;axis+='<line x1="'+axx+'" y1="'+T+'" x2="'+axx+'" y2="'+(H-B)+'" stroke="#aeb9c8"/>';for(let j=0;j<=4;j++){const v=sc[k].hi-(sc[k].hi-sc[k].lo)*j/4,yy=y(v,k);if(k===0)grid+='<line x1="'+L+'" y1="'+yy+'" x2="'+PR+'" y2="'+yy+'" stroke="#edf1f6"/>';axis+='<text x="'+tx+'" y="'+(yy+3)+'" font-size="8" fill="#667085">'+v.toFixed(Math.abs(v)<10?2:1)+'</text>'}axis+='<text x="'+tx+'" y="'+(T-7)+'" font-size="8" fill="#344054">Y'+(k+1)+' '+esc(un[k]||'')+'</text>'}
 for(let j=0;j<=6;j++){const t=a+span*j/6,xx=x(t);ticks+='<line x1="'+xx+'" y1="'+(H-B)+'" x2="'+xx+'" y2="'+(H-B+4)+'" stroke="#aeb9c8"/><text x="'+xx+'" y="'+(H-14)+'" text-anchor="middle" font-size="8" fill="#667085">'+esc(timeLabel(t,span))+'</text>'}
 inds.forEach(i=>{if(S.hidden.has(i.id))return;const ax=axes.get(i.id)||0,raw=series(i,a,b),pts=down(raw),col=color(i);bands+=eventBands(i,x,a,b,H,T,B);let d='',prev=null;const base=rawIn(i,a,b),dt=base.length>1?(base.at(-1).ts-base[0].ts)/(base.length-1):Infinity;pts.forEach(p=>{const br=!prev||p.ts-prev.ts>dt*2.5;d+=(br?'M':'L')+x(p.ts).toFixed(1)+','+y(p.value,ax).toFixed(1)+' ';prev=p});lines+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.7" vector-effect="non-scaling-stroke"/>';if(S.scale==='absolute'&&i.design){[['lower',i.design.lower],['upper',i.design.upper]].forEach(z=>{if(!observed(z[1])||!sc[ax])return;const yy=y(Number(z[1]),ax);if(yy<T||yy>H-B)return;refs+='<line x1="'+L+'" x2="'+PR+'" y1="'+yy+'" y2="'+yy+'" stroke="'+col+'" stroke-dasharray="5 5" opacity=".55"/><text x="'+(L+5)+'" y="'+(yy-3)+'" font-size="7" fill="'+col+'">'+esc(i.name)+' '+(z[0]==='upper'?'≤':'≥')+' '+fmt(z[1])+'</text>'})}});
 const brush=S.brush?'<rect class="geV33Brush" x="'+S.brush.x+'" y="'+T+'" width="'+S.brush.w+'" height="'+PH+'"></rect>':'';
 svg.innerHTML='<rect x="'+L+'" y="'+T+'" width="'+PW+'" height="'+PH+'" fill="#fff"/>'+grid+bands+axis+'<line x1="'+L+'" x2="'+PR+'" y1="'+(H-B)+'" y2="'+(H-B)+'" stroke="#aeb9c8"/>'+ticks+lines+refs+brush+'<text x="'+((L+PR)/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8" fill="#667085">时间轴 · '+esc(timeLabel(a,span))+' ～ '+esc(timeLabel(b,span))+'</text>';
 interact(svg,inds,{W,H,L,PR,T,B,a,b,span});
}
function nearest(arr,ts,tol){if(!arr.length)return null;let best=null,bd=Infinity;for(const p of arr){const d=Math.abs(p.ts-ts);if(d<bd){bd=d;best=p}if(p.ts>ts&&d>bd)break}return bd<=tol?best:null}
function interact(svg,inds,g){
 const tip=q('.geV33Tip',svg.parentElement),{W,L,PR,a,b,span,T,B,H}=g;
 svg.onwheel=e=>{e.preventDefault();const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*W,an=Math.max(0,Math.min(1,(px-L)/(PR-L))),f=e.deltaY>0?1.35:.72,full=S.view.fullEnd-S.view.fullStart,next=Math.min(full,Math.max(4*36e5,(S.view.end-S.view.start)*f)),center=S.view.start+(S.view.end-S.view.start)*an;let s=center-next*an,en=s+next;if(s<S.view.fullStart){s=S.view.fullStart;en=s+next}if(en>S.view.fullEnd){en=S.view.fullEnd;s=en-next}S.view.start=s;S.view.end=en;draw();refreshStats()};
 svg.onmousemove=e=>{const rect=svg.getBoundingClientRect();if(svg._brush){const x0=(svg._brush.clientX-rect.left)/rect.width*W,x1=(e.clientX-rect.left)/rect.width*W;S.brush={x:Math.max(L,Math.min(PR,Math.min(x0,x1))),w:Math.max(0,Math.min(PR,Math.max(x0,x1))-Math.max(L,Math.min(PR,Math.min(x0,x1))))};draw();return}if(svg._drag){const dx=e.clientX-svg._drag.x,shift=-dx/(rect.width||1)*(svg._drag.end-svg._drag.start);let s=svg._drag.start+shift,en=svg._drag.end+shift;if(s<S.view.fullStart){en+=S.view.fullStart-s;s=S.view.fullStart}if(en>S.view.fullEnd){s-=en-S.view.fullEnd;en=S.view.fullEnd}S.view.start=s;S.view.end=en;draw();return}const px=(e.clientX-rect.left)/rect.width*W;if(px<L||px>PR){tip.style.display='none';return}const ts=a+(px-L)/(PR-L)*span,rows=[];inds.forEach(i=>{if(S.hidden.has(i.id))return;const raw=rawIn(i,a,b),tol=Math.max(span/180,raw.length>1?(raw.at(-1).ts-raw[0].ts)/(raw.length-1)*1.7:span/100),p=nearest(raw,ts,tol);if(p)rows.push('<span style="color:'+color(i)+'">●</span> '+esc(i.name)+': '+fmt(p.value)+' '+esc(i.unit))});if(!rows.length){tip.style.display='none';return}tip.innerHTML='<b>'+esc(timeLabel(ts,Math.min(span,2*864e5)))+'</b><br>'+rows.join('<br>');tip.style.display='block';tip.style.left=Math.max(4,Math.min(rect.width-350,e.clientX-rect.left+10))+'px';tip.style.top=Math.max(4,e.clientY-rect.top-20)+'px'};
 svg.onmouseleave=()=>{if(!svg._drag&&!svg._brush)tip.style.display='none'};
 svg.onpointerdown=e=>{svg.setPointerCapture?.(e.pointerId);if(e.shiftKey){svg._brush={clientX:e.clientX};S.brush={x:0,w:0};return}svg._drag={x:e.clientX,start:S.view.start,end:S.view.end}};
 svg.onpointerup=e=>{const rect=svg.getBoundingClientRect();if(svg._brush){const x0=(svg._brush.clientX-rect.left)/rect.width*W,x1=(e.clientX-rect.left)/rect.width*W,lo=Math.max(L,Math.min(PR,Math.min(x0,x1))),hi=Math.max(L,Math.min(PR,Math.max(x0,x1)));svg._brush=null;S.brush=null;if(hi-lo>8){S.view.start=a+(lo-L)/(PR-L)*span;S.view.end=a+(hi-L)/(PR-L)*span;draw();refreshStats()}return}svg._drag=null};
 svg.onpointercancel=()=>{svg._drag=null;svg._brush=null;S.brush=null};
}
function bindCards(){
 const root=q('#cockpitKpiGrid');if(!root)return;
 qa('.cockpitKpi',root).forEach(card=>{const mod=q('.cockpitKpiTop span',card)?.textContent?.trim();if(!mod)return;const main=q('.cockpitKpiValue',card);if(main){main.classList.add('geV33Click');main.title='点击查看来源、覆盖、可信度、设计能力和Gap'}qa('.cockpitKpiItems b',card).forEach(x=>{x.classList.add('geV33Click');x.title='点击查看来源、覆盖、可信度、设计能力和Gap'});let b=q('.geV33TrendBtn',card);if(!b){b=document.createElement('button');b.className='geV33TrendBtn';b.type='button';b.textContent='↗ 时序';b.onclick=e=>{e.stopPropagation();open(mod)};card.appendChild(b)}});
 if(!root.dataset.geV33Bound){root.dataset.geV33Bound='1';root.addEventListener('click',e=>{const x=e.target.closest('.geV33Click');if(!x)return;const card=x.closest('.cockpitKpi'),mod=q('.cockpitKpiTop span',card)?.textContent?.trim();let name=x.classList.contains('cockpitKpiValue')?q('.cockpitKpiLabel',card)?.textContent?.trim():x.closest('.cockpitKpiItems>div')?.querySelector('span')?.textContent?.trim();if(mod&&name){e.preventDefault();e.stopPropagation();openDetail(mod,name,x.textContent.trim())}})}
}
function observeCards(){const root=q('#cockpitKpiGrid');if(!root||root.dataset.geV33Observer)return;root.dataset.geV33Observer='1';let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(bindCards,30)}).observe(root,{childList:true,subtree:true})}
function init(){injectStyle();trendHost();detailHost();bindCards();observeCards();document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetail();close()}});setTimeout(bindCards,600);setTimeout(bindCards,1800)}
window.GETrendModal={version:'3.3.0-engineering-analysis',init,open,openDetail,close,closeDetail};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();