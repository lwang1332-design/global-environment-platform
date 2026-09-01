/* Global Environment Platform - Windows Local Workstation UI.
 * Localhost only. It does not alter engineering formulas.
 */
(()=>{
'use strict';
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
if(!isLocal)return;

const VERSION='20260901-local-v3-ui2';
const state={
  health:null,version:null,diagnostics:null,sources:null,projects:[],
  currentProjectId:sessionStorage.getItem('GE_LOCAL_PROJECT_ID')||'',
  lastCalculationId:sessionStorage.getItem('GE_LOCAL_CALC_ID')||'',
  lastError:'',panelOpen:false,busy:false
};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const fmtTime=s=>{if(!s)return'--';try{return new Date(s).toLocaleString('zh-CN',{hour12:false})}catch{return String(s)}};
const api=async(p,o={})=>{
  const r=await fetch('/local-api'+p,{cache:'no-store',headers:{'Content-Type':'application/json',...(o.headers||{})},...o});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||j.detail||`HTTP ${r.status}`);
  return j;
};

function loadCss(){
  if($('#localWorkstationCss'))return;
  const l=document.createElement('link');l.id='localWorkstationCss';l.rel='stylesheet';
  l.href=`./assets/local-workstation.css?v=${VERSION}`;document.head.appendChild(l);
}
function globals(){
  let cur=null,c=null,r=null,p=null;
  try{cur=current}catch{}
  try{c=cache}catch{}
  try{r=result}catch{}
  try{p=params}catch{}
  return{cur,c,r,p};
}
function versions(){
  const v=state.version||{};
  let param='V2.9-DEFAULT';
  try{param=window.V29Config?.state?.official?.version||window.V29Config?.state?.local?.version||param}catch{}
  return{
    platform:v.platform_version||'V2.9.0-local-v3',
    model:v.model_version||'V2.9-compatible',
    parameter:param,
    database:v.database_version||'1'
  };
}
function projectSnapshot(){
  const {cur,c,r,p}=globals(),v=versions();
  if(!cur&&!c&&!r)throw new Error('当前尚未完成项目环境评估，没有可保存的工程快照。');
  return{
    schema:'GE-LOCAL-PROJECT-1',
    saved_at:new Date().toISOString(),
    versions:v,
    current:clone(cur),
    cache:clone(c),
    result:clone(r),
    params:clone(p),
    joint_settings:clone(window.V29Joint?.settings||null),
    calculation_id:state.lastCalculationId||null
  };
}
function calculationSnapshot(){
  const {cur,r}=globals(),v=versions();
  if(!r)return null;
  return{
    project_id:state.currentProjectId||null,
    project_name:cur?.name||r?.project?.name||'未命名项目',
    coordinate:{latitude:cur?.lat??r?.project?.lat??null,longitude:cur?.lon??r?.project?.lon??null},
    versions:v,
    scores:clone(r.scores||{}),
    severity:r.severity,adapt:r.adapt,gap:r.gap,
    composite:clone(r.composite||{}),
    data_period:(()=>{let c=null;try{c=cache}catch{}return c?.w?{start:c.w.start,end:c.w.end}:null})(),
    created_at:new Date().toISOString()
  };
}

function injectNav(){
  const nav=$('.pageNav');if(!nav||$('#localWorkstationNav'))return;
  const b=document.createElement('button');b.id='localWorkstationNav';b.className='navBtn localWsNav';
  b.type='button';b.innerHTML='<span class="localWsDot"></span> 本地工作站';
  b.onclick=()=>openPanel('overview');nav.appendChild(b);
}
function injectPill(){
  if($('#localWorkstationPill'))return;
  const b=document.createElement('button');b.id='localWorkstationPill';b.type='button';
  b.innerHTML='<span class="localWsDot"></span><b>LOCAL</b><span id="localWsPillText">检查中</span>';
  b.onclick=()=>openPanel('overview');document.body.appendChild(b);
}
function panel(){
  let m=$('#localWorkstationMask');
  if(m)return m;
  m=document.createElement('div');m.id='localWorkstationMask';m.className='localWsMask';
  m.innerHTML=`
    <section class="localWsPanel" role="dialog" aria-modal="true" aria-label="本地工作站">
      <header class="localWsHeader">
        <div><span class="localWsEyebrow">WINDOWS LOCAL WORKSTATION</span><h2>全球环境适应性工程计算工作站</h2><p id="localWsHeaderMeta">正在读取系统信息…</p></div>
        <button class="localWsClose" id="localWsClose" aria-label="关闭">×</button>
      </header>
      <nav class="localWsTabs">
        <button data-tab="overview" class="active">运行状态</button>
        <button data-tab="projects">项目管理</button>
        <button data-tab="sources">数据源</button>
        <button data-tab="diagnostics">系统诊断</button>
      </nav>
      <main class="localWsContent">
        <div id="localWsMessage" class="localWsMessage" hidden></div>
        <section data-pane="overview"></section>
        <section data-pane="projects" hidden></section>
        <section data-pane="sources" hidden></section>
        <section data-pane="diagnostics" hidden></section>
      </main>
      <footer class="localWsFooter">
        <span>本地运行数据不会提交到 GitHub。</span>
        <div><button class="localWsGhost" id="localWsRefresh">刷新状态</button><button id="localWsBackup">一键备份</button></div>
      </footer>
    </section>`;
  document.body.appendChild(m);
  $('#localWsClose',m).onclick=closePanel;
  m.addEventListener('click',e=>{if(e.target===m)closePanel()});
  $('.localWsTabs',m).addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)selectTab(b.dataset.tab)});
  $('#localWsRefresh',m).onclick=()=>refreshAll(true);
  $('#localWsBackup',m).onclick=doBackup;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.panelOpen)closePanel()});
  return m;
}
function showMessage(text,type='info'){
  const el=$('#localWsMessage');if(!el)return;
  el.hidden=!text;el.className=`localWsMessage ${type}`;el.textContent=text||'';
}
function setBusy(v,text='处理中…'){
  state.busy=!!v;
  const p=panel();p.classList.toggle('isBusy',!!v);
  showMessage(v?text:'',v?'info':'info');
}
function openPanel(tab='overview'){
  loadCss();injectNav();injectPill();panel();
  state.panelOpen=true;$('#localWorkstationMask').classList.add('show');
  selectTab(tab);refreshAll(false);
}
function closePanel(){state.panelOpen=false;$('#localWorkstationMask')?.classList.remove('show')}
function selectTab(tab){
  const m=panel();
  m.querySelectorAll('.localWsTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  m.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==tab);
  if(tab==='projects')renderProjects();
  if(tab==='sources'&&!state.sources)loadSources();
  if(tab==='diagnostics')renderDiagnostics();
}

async function refreshCore(){
  const [h,v,d,ps]=await Promise.all([
    api('/health'),api('/version'),api('/diagnostics'),api('/projects')
  ]);
  state.health=h;state.version=v.version||{};state.diagnostics=d;state.projects=ps.projects||[];state.lastError='';
}
async function refreshAll(forceSources=false){
  try{
    await refreshCore();
    if(forceSources)await loadSources(false);
    updatePill();renderOverview();renderProjects();renderDiagnostics();
  }catch(e){
    state.lastError=e.message;updatePill();renderOverview();showMessage('本地工作站刷新失败：'+e.message,'bad');
  }
}
function updatePill(){
  const t=$('#localWsPillText'),pill=$('#localWorkstationPill');
  if(!t||!pill)return;
  if(state.lastError){t.textContent='异常';pill.classList.add('bad');return}
  pill.classList.remove('bad');
  t.textContent=state.version?.platform_version||'在线';
}
function kv(label,value,cls=''){return`<div class="localWsKv"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`}
function renderOverview(){
  const p=$('[data-pane="overview"]');if(!p)return;
  const v=versions(),d=state.diagnostics||{},g=globals(),cur=g.cur||g.r?.project||{};
  const online=navigator.onLine;
  const calc=state.lastCalculationId||'尚未记录';
  const project=state.currentProjectId||'尚未保存';
  $('#localWsHeaderMeta').textContent=`${v.platform} · ${location.origin} · ${online?'联网':'离线'}`;
  p.innerHTML=`
    <div class="localWsHero">
      <div><span>工作站状态</span><strong><i class="${state.lastError?'bad':'ok'}"></i>${state.lastError?'异常':'运行正常'}</strong><small>${online?'Local Online · 在线真实数据 + 本地缓存':'Local Offline · 本地缓存/项目可用'}</small></div>
      <div><span>当前项目</span><strong>${esc(cur.name||'尚未评估')}</strong><small>${cur.lat!=null&&cur.lon!=null?`${Number(cur.lat).toFixed(4)}, ${Number(cur.lon).toFixed(4)}`:'--'}</small></div>
      <div><span>Calculation ID</span><strong class="mono">${esc(calc)}</strong><small>每次计算自动生成，可用于报告追溯</small></div>
    </div>
    <div class="localWsGrid">
      <article class="localWsCard"><h3>版本与追溯</h3>
        ${kv('平台版本',v.platform)}${kv('模型版本',v.model)}${kv('参数版本',v.parameter)}${kv('数据库版本',v.database)}
        ${kv('本地项目 ID',project)}
      </article>
      <article class="localWsCard"><h3>本地数据</h3>
        ${kv('SQLite完整性',d.db_integrity||'--',d.db_integrity==='ok'?'okText':'')}
        ${kv('已保存项目',String(d.counts?.projects??'--'))}${kv('缓存记录',String(d.counts?.cache??'--'))}
        ${kv('计算记录',String(d.counts?.calculations??'--'))}${kv('剩余磁盘',d.disk_free_gb!=null?d.disk_free_gb+' GB':'--')}
      </article>
      <article class="localWsCard localWsActionsCard"><h3>常用操作</h3>
        <button data-act="save">保存当前项目</button><button data-act="saveAs" class="localWsGhost">另存项目</button>
        <button data-act="projects" class="localWsGhost">打开项目管理</button><button data-act="sources" class="localWsGhost">检查数据源</button>
      </article>
    </div>
    <div class="localWsHint">工程模型与 V2.9 在线版保持同源。本地工作站只增加运行、存储、缓存、诊断与追溯能力，不修改六大物理模型公式。</div>`;
  p.querySelector('[data-act="save"]').onclick=()=>saveCurrent(false);
  p.querySelector('[data-act="saveAs"]').onclick=()=>saveCurrent(true);
  p.querySelector('[data-act="projects"]').onclick=()=>selectTab('projects');
  p.querySelector('[data-act="sources"]').onclick=()=>selectTab('sources');
}

async function saveCurrent(asNew){
  try{
    const snap=projectSnapshot(),cur=snap.current||snap.result?.project||{};
    const def=cur.name||'未命名环境评估项目';
    const name=prompt(asNew?'另存项目名称':'项目名称',def);
    if(name===null)return;
    const id=asNew?'':state.currentProjectId;
    setBusy(true,'正在保存工程项目快照…');
    const r=await api('/projects',{method:'POST',body:JSON.stringify({id:id||undefined,name:name.trim()||def,payload:snap})});
    state.currentProjectId=r.id;sessionStorage.setItem('GE_LOCAL_PROJECT_ID',r.id);
    await refreshCore();setBusy(false);showMessage(`项目已保存：${name.trim()||def} · ${r.id}`,'ok');
    renderOverview();renderProjects();
  }catch(e){setBusy(false);showMessage('保存失败：'+e.message,'bad')}
}
async function openProject(id){
  try{
    setBusy(true,'正在恢复历史项目…');
    const x=await api('/projects/'+encodeURIComponent(id)),s=x.project?.payload||{};
    const currentV=versions(),savedV=s.versions||{};
    if(savedV.model&&savedV.model!==currentV.model){
      const ok=confirm(`该项目保存时模型版本为 ${savedV.model}，当前为 ${currentV.model}。\n将按保存时的结果快照打开，不自动重新计算。是否继续？`);
      if(!ok){setBusy(false);return}
    }
    try{if(s.current!=null)current=clone(s.current)}catch{}
    try{if(s.cache!=null)cache=clone(s.cache)}catch{}
    try{if(s.params!=null)params=clone(s.params)}catch{}
    try{
      if(s.result!=null){result=clone(s.result);if(typeof render==='function')render()}
      else if(s.cache!=null&&typeof calculate==='function')calculate()
    }catch(e){console.warn('Local project render restore failed',e)}
    try{window.V29Joint?.render?.()}catch{}
    try{window.CockpitScientific?.refresh?.()}catch{}
    state.currentProjectId=id;sessionStorage.setItem('GE_LOCAL_PROJECT_ID',id);
    if(s.calculation_id){state.lastCalculationId=s.calculation_id;sessionStorage.setItem('GE_LOCAL_CALC_ID',s.calculation_id)}
    setBusy(false);closePanel();
    try{if(typeof showPage==='function')showPage('main')}catch{}
    setTimeout(()=>alert(`项目已打开：${x.project.name}\n项目ID：${id}\n保存时间：${fmtTime(x.project.updated_at)}`),50);
  }catch(e){setBusy(false);showMessage('打开项目失败：'+e.message,'bad')}
}
async function deleteProject(id,name){
  if(!confirm(`确定删除本地项目“${name}”吗？\n该操作不会删除 GitHub 或云端数据。`))return;
  try{
    await api('/projects/'+encodeURIComponent(id),{method:'DELETE'});
    if(state.currentProjectId===id){state.currentProjectId='';sessionStorage.removeItem('GE_LOCAL_PROJECT_ID')}
    await refreshCore();renderProjects();renderOverview();showMessage('项目已删除。','ok');
  }catch(e){showMessage('删除失败：'+e.message,'bad')}
}
function renderProjects(){
  const p=$('[data-pane="projects"]');if(!p)return;
  const rows=state.projects||[];
  p.innerHTML=`
    <div class="localWsSectionHead"><div><h3>本地工程项目</h3><p>完整保存坐标、环境数据、参数、模型结果和版本快照。</p></div><div><button id="localWsSaveProject">保存当前项目</button><button id="localWsSaveAs" class="localWsGhost">另存</button></div></div>
    <div class="localWsTableWrap"><table class="localWsTable"><thead><tr><th>项目名称</th><th>项目ID</th><th>更新时间</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${rows.length?rows.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td class="mono">${esc(x.id)}</td><td>${esc(fmtTime(x.updated_at))}</td><td>${x.id===state.currentProjectId?'<span class="localWsTag ok">当前</span>':'<span class="localWsTag">已保存</span>'}</td><td><button class="localWsTiny" data-open="${esc(x.id)}">打开</button><button class="localWsTiny danger" data-del="${esc(x.id)}" data-name="${esc(x.name)}">删除</button></td></tr>`).join(''):`<tr><td colspan="5" class="localWsEmpty">尚无本地保存项目。完成一次评估后点击“保存当前项目”。</td></tr>`}
    </tbody></table></div>`;
  $('#localWsSaveProject',p).onclick=()=>saveCurrent(false);
  $('#localWsSaveAs',p).onclick=()=>saveCurrent(true);
  p.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
  p.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.del,b.dataset.name));
}

async function loadSources(renderLoading=true){
  const p=$('[data-pane="sources"]');
  if(renderLoading&&p)p.innerHTML='<div class="localWsLoading">正在并行检测 ERA5 / CAMS / Marine / DEM / 参数服务 / 地图…</div>';
  let lat=18.2528,lon=109.5119;const {cur}=globals();
  if(Number.isFinite(Number(cur?.lat)))lat=Number(cur.lat);
  if(Number.isFinite(Number(cur?.lon)))lon=Number(cur.lon);
  try{state.sources=await api(`/sources?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`);renderSources()}
  catch(e){if(p)p.innerHTML=`<div class="localWsMessage bad">数据源检测失败：${esc(e.message)}</div>`}
}
function renderSources(){
  const p=$('[data-pane="sources"]');if(!p)return;
  const x=state.sources,s=x?.sources||[];
  p.innerHTML=`
    <div class="localWsSectionHead"><div><h3>数据源健康检查</h3><p>检测点：${x?`${Number(x.latitude).toFixed(4)}, ${Number(x.longitude).toFixed(4)}`:'--'} · 每项独立超时，失败不会生成模拟数据。</p></div><button id="localWsSourceRefresh">重新检测全部</button></div>
    <div class="localWsSourceGrid">${s.length?s.map(z=>`<article class="localWsSource ${z.ok?'ok':'bad'}"><div><i></i><b>${esc(z.name)}</b></div><strong>${z.ok?'正常':'异常'}</strong><span>${z.latency_ms!=null?z.latency_ms+' ms':'--'}</span><small title="${esc(z.message)}">${esc(z.message||'--')}</small></article>`).join(''):'<div class="localWsEmpty">尚未检测。</div>'}</div>
    <div class="localWsHint">Marine 在内陆坐标可能返回“无海洋数据”或业务空值，这与网络不可达不同；实际项目结果仍以平台当前数据获取状态为准。</div>`;
  $('#localWsSourceRefresh',p).onclick=()=>loadSources(true);
}
function renderDiagnostics(){
  const p=$('[data-pane="diagnostics"]');if(!p)return;
  const d=state.diagnostics||{};
  p.innerHTML=`
    <div class="localWsSectionHead"><div><h3>系统诊断</h3><p>用于区分本地服务、数据库、磁盘和在线数据问题。</p></div><button id="localWsDiagRefresh">重新诊断</button></div>
    <div class="localWsGrid">
      <article class="localWsCard"><h3>运行环境</h3>${kv('Python',d.python||'--')}${kv('SQLite',d.sqlite||'--')}${kv('数据库完整性',d.db_integrity||'--',d.db_integrity==='ok'?'okText':'badText')}${kv('磁盘剩余',d.disk_free_gb!=null?d.disk_free_gb+' GB':'--')}</article>
      <article class="localWsCard"><h3>目录</h3>${Object.entries(d.directories||{}).map(([k,v])=>kv(k,v?'正常':'缺失',v?'okText':'badText')).join('')}</article>
      <article class="localWsCard"><h3>数据库记录</h3>${kv('项目',String(d.counts?.projects??'--'))}${kv('缓存',String(d.counts?.cache??'--'))}${kv('计算',String(d.counts?.calculations??'--'))}${kv('审计',String(d.counts?.audit??'--'))}</article>
    </div>
    <div class="localWsDiagResult ${d.ok?'ok':'bad'}"><b>${d.ok?'系统诊断正常':'系统存在异常'}</b><span>检查时间：${esc(fmtTime(d.time))}</span></div>`;
  $('#localWsDiagRefresh',p).onclick=async()=>{try{state.diagnostics=await api('/diagnostics');renderDiagnostics();renderOverview()}catch(e){showMessage(e.message,'bad')}};
}
async function doBackup(){
  try{setBusy(true,'正在备份 SQLite、项目、配置和缓存…');const r=await api('/backup',{method:'POST',body:'{}'});setBusy(false);showMessage('备份完成：'+r.file,'ok')}
  catch(e){setBusy(false);showMessage('备份失败：'+e.message,'bad')}
}

let calcHooked=false,reportHooked=false;
function installCalculationHook(){
  if(calcHooked)return true;
  try{
    if(typeof calculate!=='function')return false;
    const base=calculate;
    if(base.__localWorkstation)return calcHooked=true;
    const wrapped=function(){
      const out=base.apply(this,arguments);
      setTimeout(recordCalculation,0);
      return out;
    };
    wrapped.__localWorkstation=true;calculate=wrapped;calcHooked=true;return true;
  }catch{return false}
}
async function recordCalculation(){
  const snap=calculationSnapshot();if(!snap)return;
  const sig=JSON.stringify([snap.project_name,snap.coordinate,snap.severity,snap.adapt,snap.gap,snap.data_period,snap.versions.parameter]);
  if(recordCalculation.lastSig===sig&&Date.now()-(recordCalculation.lastAt||0)<1500)return;
  recordCalculation.lastSig=sig;recordCalculation.lastAt=Date.now();
  try{
    const r=await api('/calculations',{method:'POST',body:JSON.stringify(snap)});
    state.lastCalculationId=r.calculation_id;sessionStorage.setItem('GE_LOCAL_CALC_ID',r.calculation_id);
    renderOverview();
  }catch(e){console.warn('Calculation trace save failed:',e)}
}
function installReportHook(){
  if(reportHooked)return true;
  try{
    if(typeof reportHtml!=='function')return false;
    const base=reportHtml;if(base.__localWorkstation)return reportHooked=true;
    const wrapped=function(){
      let html=base.apply(this,arguments);
      const v=versions(),cid=state.lastCalculationId||'--',pid=state.currentProjectId||'--';
      const trace=`<div style="margin-top:12px;padding:10px 12px;border:1px solid #d7e5ff;background:#f6f9ff;border-radius:8px;font-size:10px;line-height:1.65"><b>工程可追溯信息</b><br>Calculation ID：${esc(cid)}<br>Local Project ID：${esc(pid)}<br>模型版本：${esc(v.model)}　参数版本：${esc(v.parameter)}　平台版本：${esc(v.platform)}</div>`;
      return html.replace('<div class="coverFoot">',trace+'<div class="coverFoot">');
    };
    wrapped.__localWorkstation=true;reportHtml=wrapped;reportHooked=true;return true;
  }catch{return false}
}
function installLocalApiPreference(){
  window.GE_LOCAL_API_BASE='/local-api';
  window.GE_RUNTIME_MODE='local-workstation';
}

function init(){
  loadCss();injectNav();injectPill();panel();installLocalApiPreference();
  refreshAll(false);
  let tries=0;
  const timer=setInterval(()=>{
    installCalculationHook();installReportHook();injectNav();
    if(++tries>20||(calcHooked&&reportHooked))clearInterval(timer);
  },500);
  if(document.readyState==='complete'||document.readyState==='interactive')setTimeout(recordCalculation,700);
}
window.LocalWorkstation={
  isLocal,state,open:openPanel,refresh:refreshAll,diagnostics:()=>api('/diagnostics'),
  sources:loadSources,listProjects:()=>api('/projects'),saveCurrent,openProject,backup:doBackup,
  saveCalculation:recordCalculation
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
