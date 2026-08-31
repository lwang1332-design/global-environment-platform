/* V2.9 参数云同步 + 本地最近有效快照。仅管理参数来源/发布，不改变任何物理模型公式。 */
(()=>{
'use strict';
const SCHEMA='2.9';
const LOCAL_KEY='GE_V29_CONFIG_LAST_GOOD';
const DEBUG_KEY='GE_V29_DEBUG_PARAMS';
const TOKEN_KEY='GE_V29_ADMIN_TOKEN';
const API_BASE=String(window.V29_RUNTIME_CONFIG?.configApiBase||document.querySelector('meta[name="v29-config-api"]')?.content||localStorage.getItem('GE_V29_API_BASE')||'').replace(/\/$/,'');
const state={source:'default',server:'unknown',official:null,cloud:null,local:null,debugActive:false,dirtyCount:0,lastError:'',syncing:false};
const $v=id=>document.getElementById(id);
const clone=o=>JSON.parse(JSON.stringify(o));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fmtTime=s=>{if(!s)return'--';try{return new Date(s).toLocaleString('zh-CN',{hour12:false})}catch{return String(s)}};
const api=p=>`${API_BASE}${p.startsWith('/')?p:'/'+p}`;

function normalize(raw){
  const out={...DEFAULT_PARAMS};
  if(raw&&typeof raw==='object')for(const k of Object.keys(DEFAULT_PARAMS)){const v=Number(raw[k]);if(Number.isFinite(v))out[k]=v}
  return out;
}
function localEnvelope(){try{const j=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null');if(j?.parameters&&String(j.schemaVersion||'').startsWith('2.9'))return j}catch{}return null}
function saveLocal(cfg){
  const env={version:cfg.version||'V2.9-LOCAL',updatedAt:cfg.updatedAt||new Date().toISOString(),updatedBy:cfg.updatedBy||'server',description:cfg.description||'',schemaVersion:SCHEMA,parameters:normalize(cfg.parameters)};
  localStorage.setItem(LOCAL_KEY,JSON.stringify(env));
  localStorage.setItem('GE_V25_PARAMS',JSON.stringify(env.parameters));
  state.local=env;return env;
}
function applyConfig(cfg,source){
  const normalized=normalize(cfg?.parameters||cfg);
  params=Object.assign({},DEFAULT_PARAMS,normalized);
  state.source=source;state.debugActive=source==='debug';
  if(source==='cloud'||source==='local'){state.official={...(cfg||{}),parameters:clone(normalized),schemaVersion:SCHEMA};}
  if(source==='cloud')state.cloud=state.official;
  renderStatus();
}
function paramDiff(a,b){let n=0;for(const k of Object.keys(DEFAULT_PARAMS))if(Number(a?.[k])!==Number(b?.[k]))n++;return n}
function clearInvalid(){Object.values(PARAM_IDS).forEach(id=>{const el=$v(id);if(el){el.classList.remove('v29-invalid');el.removeAttribute('data-v29-error')}})}
function validate(p,mark=true){
  const e={};const set=(k,msg,ok)=>{if(!e[k]&&!ok)e[k]=msg};const range=(v,a,b)=>finite(v)&&v>=a&&v<=b;const pos=v=>finite(v)&&v>0;const nn=v=>finite(v)&&v>=0;
  for(const k of Object.keys(DEFAULT_PARAMS))if(!finite(p[k]))e[k]='必须为有效数值';
  set('delta','金属厚度必须 > 0 mm',pos(p.delta));set('rho','密度必须 > 0',pos(p.rho));set('cp','比热必须 > 0',pos(p.cp));
  set('eps','0 < 发射率 ≤ 1',p.eps>0&&p.eps<=1);set('alpha','太阳吸收率范围 0～1',range(p.alpha,0,1));
  set('Q','通风量必须 > 0',pos(p.Q));set('D','风机直径必须 > 0',pos(p.D));set('rpm','转速必须 ≥ 0',nn(p.rpm));
  set('impactEta','撞击效率范围 0～1',range(p.impactEta,0,1));set('filterEta','过滤效率范围 0～1',range(p.filterEta,0,1));set('filterBypass','旁通率范围 0～1',range(p.filterBypass,0,1));
  set('saltClFrac','Cl⁻质量分数范围 0～1',range(p.saltClFrac,0,1));set('towRh','TOW RH范围 0～100%',range(p.towRh,0,100));set('capRh','RH范围 0～100%',range(p.capRh,0,100));set('capTow','TOW范围 0～100%',range(p.capTow,0,100));
  set('condDtMin','0 < 时间步长 ≤ 60 min',p.condDtMin>0&&p.condDtMin<=60);set('capLow','最低设计温度必须小于最高设计温度',finite(p.capLow)&&finite(p.capHigh)&&p.capLow<p.capHigh);
  set('towTmin','TOW最低温度必须小于最高温度',finite(p.towTmin)&&finite(p.towTmax)&&p.towTmin<p.towTmax);
  [['hiA','hiB'],['loA','loB'],['windA','windB'],['rainA','rainB'],['snowA','snowB'],['altA','altB']].forEach(([a,b])=>set(a,'评分起点必须小于满分值',finite(p[a])&&finite(p[b])&&p[a]<p[b]));
  ['w1','w2','w3','wavg','saltWSea','saltWTow','saltWSo2'].forEach(k=>set(k,'权重范围 0～1',range(p[k],0,1)));
  ['sky','dewMargin','marineKm','coastalKm','camsDays','opHours','capCondHours','capCl','capPm','capEi','capHeatLoss','capDayRange','capTempRate','capRainDay','capRainHour','capWind','capSnow','capAltitude','capSo2','capNo2'].forEach(k=>set(k,'必须 ≥ 0',nn(p[k])));
  set('opHours','年运行小时范围 0～8784 h',range(p.opHours,0,8784));set('impactAngle','撞击角范围 0～90°',range(p.impactAngle,0,90));
  ['ne','eiMass','eiVel','particleD50','particleRho','materialK','condMassK','gustFactor','protect'].forEach(k=>set(k,'必须 > 0',pos(p[k])));
  if(mark){clearInvalid();for(const [k,msg] of Object.entries(e)){const el=$v(PARAM_IDS[k]);if(el){el.classList.add('v29-invalid');el.dataset.v29Error=msg;el.title=msg}}}
  return{ok:Object.keys(e).length===0,errors:e};
}
function readInputs(){const p={...params};for(const [k,id] of Object.entries(PARAM_IDS)){const el=$v(id);if(el)p[k]=el.value===''?NaN:Number(el.value)}return p}
function writeInputs(p){for(const [k,id] of Object.entries(PARAM_IDS)){const el=$v(id);if(el&&finite(Number(p[k])))el.value=Number(p[k])}}
function officialParams(){return state.official?.parameters||state.local?.parameters||DEFAULT_PARAMS}
function updateDirty(p=readInputs()){state.dirtyCount=paramDiff(p,officialParams());state.debugActive=state.dirtyCount>0;renderStatus()}

async function getJSON(url,options={},timeout=6000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',...options,signal:c.signal});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);return j}finally{clearTimeout(t)}
}
async function fetchLatest({apply=true}={}){
  if(!API_BASE)throw new Error('中央参数 API 尚未配置');
  const j=await getJSON(api('/config/latest'));const cfg=j.config;if(!cfg?.parameters)throw new Error('中央参数返回格式无效');if(String(cfg.schemaVersion)!==SCHEMA)throw new Error(`参数版本不兼容：${cfg.schemaVersion||'unknown'}`);
  const check=validate(normalize(cfg.parameters),false);if(!check.ok)throw new Error('服务器正式参数未通过本地合法性校验');
  state.server='online';state.lastError='';state.cloud={...cfg,parameters:normalize(cfg.parameters)};saveLocal(state.cloud);if(apply&&!state.debugActive)applyConfig(state.cloud,'cloud');renderStatus();return state.cloud;
}
async function ensureLatest(){
  if(state.syncing)return;state.syncing=true;try{await fetchLatest({apply:!state.debugActive})}catch(e){state.server=navigator.onLine?'error':'offline';state.lastError=e.message;const local=state.local||localEnvelope();if(!state.official){if(local){state.local=local;applyConfig(local,'local')}else applyConfig({version:'V2.9-DEFAULT',updatedAt:'',parameters:DEFAULT_PARAMS},'default')}renderStatus()}finally{state.syncing=false}
}

function injectStatusUI(){
  const admin=$v('adminPage');if(admin&&!$v('v29ParamState')){
    const box=document.createElement('section');box.id='v29ParamState';box.className='v29ParamState';box.innerHTML=`<div class="v29StateHead"><div><h3>参数管理状态 <span class="v29Tag">V2.9</span></h3><p>本机调试 → 结果确认 → 服务端验证 → 正式发布 → 全网同步</p></div><div id="v29SyncBadge" class="v29SyncBadge">初始化</div></div><div class="v29StateGrid"><div><span>正式版本</span><b id="v29OfficialVersion">--</b></div><div><span>服务器状态</span><b id="v29ServerStatus">--</b></div><div><span>当前调试状态</span><b id="v29DebugStatus">--</b></div><div><span>本地版本</span><b id="v29LocalVersion">--</b></div><div><span>云端版本</span><b id="v29CloudVersion">--</b></div><div><span>当前参数来源</span><b id="v29ParamSource">--</b></div></div><label class="v29DescLabel">本次发布说明 <input id="v29PublishDesc" maxlength="500" placeholder="例如：修改盐雾沉积速度和高温阈值"></label><div class="v29ManageActions"><button onclick="V29Config.applyDebug()">应用并重算</button><button class="v29Publish" onclick="V29Config.publish()">发布正式参数（全网同步）</button><button class="ghost" onclick="V29Config.discard()">放弃修改</button><button class="ghost" onclick="V29Config.reloadCloud()">读取最新参数</button><button class="ghost" onclick="V29Config.exportJSON()">导出JSON</button><button class="ghost" onclick="V29Config.importJSON()">导入JSON</button><button class="ghost" onclick="V29Config.history()">查看历史版本</button><button class="ghost" onclick="V29Config.restoreServer()">恢复服务器正式参数</button><button class="ghost" onclick="V29Config.restoreDefaults()">恢复系统默认参数</button></div><input id="v29ImportFile" type="file" accept="application/json,.json" hidden>`;
    admin.insertBefore(box,admin.firstChild);
    const old=admin.querySelector('.adminActions');if(old)old.innerHTML='<button class="ghost" onclick="showPage(\'main\')">返回评估主页</button>';
    const file=$v('v29ImportFile');if(file)file.addEventListener('change',importFile);
    for(const id of Object.values(PARAM_IDS)){const el=$v(id);if(el)el.addEventListener('input',()=>updateDirty())}
  }
  const meta=$v('uiDataMeta');if(meta&&!$v('v29PublicConfigPill')){const s=document.createElement('span');s.className='uiMetaPill';s.id='v29PublicConfigPill';meta.appendChild(s)}
  if(!$v('v29HistoryMask')){const m=document.createElement('div');m.id='v29HistoryMask';m.className='v29HistoryMask';m.innerHTML='<div class="v29HistoryPanel"><div class="v29HistoryHead"><h3>正式参数历史版本</h3><button onclick="V29Config.closeHistory()">×</button></div><div id="v29HistoryBody" class="v29HistoryBody">读取中...</div></div>';document.body.appendChild(m)}
}
function renderStatus(){
  injectStatusUI();const cfg=state.official||state.local;const source={cloud:'云端最新参数',local:'本地缓存参数',default:'系统默认参数',debug:'本机调试参数'}[state.debugActive?'debug':state.source]||state.source;
  const set=(id,v)=>{const el=$v(id);if(el)el.textContent=v};
  set('v29OfficialVersion',cfg?.version||'V2.9-DEFAULT');set('v29LocalVersion',state.local?.version||'--');set('v29CloudVersion',state.cloud?.version||'--');set('v29ParamSource',source);
  set('v29ServerStatus',state.server==='online'?'● 在线':state.server==='offline'?'● 离线':state.server==='error'?'● 异常':'● 检查中');
  set('v29DebugStatus',state.dirtyCount?`有 ${state.dirtyCount} 项参数修改尚未发布`:'无未发布修改');
  const badge=$v('v29SyncBadge');if(badge){badge.textContent=state.dirtyCount?'调试中':state.source==='cloud'?'已同步':state.source==='local'?'本地缓存':'默认参数';badge.className='v29SyncBadge '+(state.dirtyCount?'warn':state.source==='cloud'?'ok':'muted')}
  const pill=$v('v29PublicConfigPill');if(pill){const offline=state.source==='local'&&!navigator.onLine;pill.innerHTML=`<i class="uiMetaDot ${state.source==='cloud'?'ok':state.source==='local'?'warn':''}"></i>参数 <b>${cfg?.version||'V2.9-DEFAULT'}</b> · ${state.debugActive?'本机调试':state.source==='cloud'?'云端':state.source==='local'?'本地缓存':'默认'}${offline?' · 离线模式':''}`}
  const as=$v('adminStatus');if(as)as.textContent=state.lastError?`参数服务：${state.lastError}`:(state.dirtyCount?`${state.dirtyCount}项修改待发布`:`${cfg?.version||'V2.9-DEFAULT'} · ${source}`);
}

async function applyDebug(){const p=readInputs(),c=validate(p,true);if(!c.ok){alert('参数存在异常，请先修正标红项。');return false}params=clone(p);state.debugActive=true;state.dirtyCount=paramDiff(p,officialParams());localStorage.setItem(DEBUG_KEY,JSON.stringify({savedAt:new Date().toISOString(),parameters:p}));renderStatus();if(cache)calculate();return true}
async function publish(){
  const ok=await applyDebug();if(!ok)return;if(!API_BASE){alert('尚未配置中央参数 API，不能全网发布。');return}
  let token=sessionStorage.getItem(TOKEN_KEY)||'';if(!token){alert('请重新进行管理员服务端验证后再发布。');adminUnlocked=false;openAdmin();return}
  const description=$v('v29PublishDesc')?.value.trim()||'管理员正式发布';
  try{const j=await getJSON(api('/config/publish'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({schemaVersion:SCHEMA,description,parameters:readInputs()})},10000);const cfg=j.config;saveLocal(cfg);state.cloud=cfg;state.official=cfg;state.server='online';state.debugActive=false;state.dirtyCount=0;applyConfig(cfg,'cloud');localStorage.removeItem(DEBUG_KEY);if($v('v29PublishDesc'))$v('v29PublishDesc').value='';if(cache)calculate();alert(`参数发布成功：${cfg.version}\n所有用户刷新或重新评估时将自动读取该正式版本。`)}catch(e){state.lastError=e.message;renderStatus();alert('发布失败：'+e.message)}
}
function discard(){const p=normalize(officialParams());params=clone(p);writeInputs(p);clearInvalid();state.debugActive=false;state.dirtyCount=0;localStorage.removeItem(DEBUG_KEY);renderStatus();if(cache)calculate()}
async function reloadCloud(){try{state.debugActive=false;state.dirtyCount=0;const cfg=await fetchLatest({apply:true});writeInputs(cfg.parameters);clearInvalid();if(cache)calculate()}catch(e){state.lastError=e.message;renderStatus();alert('读取服务器正式参数失败：'+e.message)}}
function restoreServer(){if(state.cloud?.parameters){params=normalize(state.cloud.parameters);writeInputs(params);state.debugActive=false;state.dirtyCount=0;renderStatus();if(cache)calculate()}else reloadCloud()}
function restoreDefaults(){params=clone(DEFAULT_PARAMS);writeInputs(params);clearInvalid();state.debugActive=true;state.dirtyCount=paramDiff(params,officialParams());renderStatus();if(cache)calculate()}
function exportJSON(){const p=readInputs(),cfg={schemaVersion:SCHEMA,version:state.debugActive?'V2.9-DEBUG':state.official?.version||'V2.9-DEFAULT',exportedAt:new Date().toISOString(),source:state.debugActive?'debug':state.source,description:$v('v29PublishDesc')?.value||'',parameters:p};const blob=new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`global-env-params-${cfg.version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importJSON(){$v('v29ImportFile')?.click()}
async function importFile(e){const file=e.target.files?.[0];if(!file)return;try{const j=JSON.parse(await file.text()),p=normalize(j.parameters||j);const c=validate(p,true);if(!c.ok)throw new Error('导入参数存在不合理范围');params=p;writeInputs(p);state.debugActive=true;state.dirtyCount=paramDiff(p,officialParams());renderStatus();if(cache)calculate();alert('参数已导入到本机调试状态，尚未发布到全网。')}catch(err){alert('参数JSON导入失败：'+err.message)}finally{e.target.value=''}}
async function history(){const mask=$v('v29HistoryMask'),body=$v('v29HistoryBody');mask?.classList.add('show');if(body)body.textContent='读取中...';try{const j=await getJSON(api('/config/history?limit=30'));if(body)body.innerHTML=(j.items||[]).map(x=>`<div class="v29HistoryItem"><div><b>${escapeHtml(x.version)}</b><span>${escapeHtml(fmtTime(x.updatedAt))}</span></div><p>${escapeHtml(x.description||'无说明')}</p><small>${x.status==='published'?'当前正式版本':'历史版本'} · ${escapeHtml(x.updatedBy||'')}</small></div>`).join('')||'暂无历史版本'}catch(e){if(body)body.textContent='读取失败：'+e.message}}
function closeHistory(){$v('v29HistoryMask')?.classList.remove('show')}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function serverLogin(password){if(!API_BASE)throw new Error('中央参数 API 尚未配置');const j=await getJSON(api('/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,username:'admin'})},8000);sessionStorage.setItem(TOKEN_KEY,j.token);return true}
function overrideAdminAuth(){
  openAdmin=function(){if(!sessionStorage.getItem(TOKEN_KEY)){adminUnlocked=false;$v('loginMask').classList.add('show');$v('adminPwd').focus();return}adminUnlocked=true;loadAdminInputs();renderStatus();showPage('admin')};
  verifyAdmin=async function(){const pwd=$v('adminPwd').value;const msg=$v('loginMsg');if(msg)msg.textContent='正在进行服务端验证...';try{await serverLogin(pwd);adminUnlocked=true;$v('loginMask').classList.remove('show');$v('adminPwd').value='';if(msg)msg.textContent='';loadAdminInputs();renderStatus();showPage('admin')}catch(e){adminUnlocked=false;if(msg)msg.textContent='验证失败：'+e.message}};
  applyAdminParams=applyDebug;
  resetAdminParams=restoreDefaults;
}

// IndexedDB：保存最近一次完整项目数据。小时级 ERA5 多年数据不放 localStorage，避免容量不足。
const DB_NAME='GE_V29_ENGINEERING',STORE='snapshots';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putSnapshot(key,val){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(val,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){console.warn('V2.9 snapshot save failed',e)}}
async function getSnapshot(key){try{const db=await openDB();const v=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return v}catch{return null}}
async function saveProject(){if(!cache?.w?.j?.hourly)return;await putSnapshot('latest-project',{savedAt:new Date().toISOString(),current:clone(current),cache:clone(cache),configVersion:state.official?.version||'V2.9-DEFAULT'})}
async function restoreProject(message='当前离线，使用最近缓存数据'){const s=await getSnapshot('latest-project');if(!s?.cache)return false;current=s.current||current;cache=s.cache;selected={env:null,equip:null};if($v('query'))$v('query').value=current.name||`${current.lat},${current.lon}`;try{updateMapLocation(current.lat,current.lon,current.name)}catch{}calculate();if($v('status'))$v('status').textContent=`${message} · ${s.savedAt?fmtTime(s.savedAt):''}`;return true}
function sameLocation(loc,s){if(!loc||!s?.current)return false;return Math.abs(Number(loc.lat)-Number(s.current.lat))<0.02&&Math.abs(Number(loc.lon)-Number(s.current.lon))<0.02}
function wrapAssessment(){
  const originalAssess=assess;assess=async function(loc){if(!state.debugActive)await ensureLatest();if(!navigator.onLine){const s=await getSnapshot('latest-project');if(sameLocation(loc,s)&&await restoreProject())return;$v('status').textContent='当前离线，且该项目没有可用的最近缓存数据';return}await originalAssess(loc);if(String($v('status')?.textContent||'').startsWith('查询失败')){const s=await getSnapshot('latest-project');if(sameLocation(loc,s))await restoreProject('实时数据获取失败，使用最近缓存数据')}};
  const originalCalculate=calculate;calculate=function(){const r=originalCalculate.apply(this,arguments);saveProject();return r};
}

async function init(){
  injectStatusUI();overrideAdminAuth();state.local=localEnvelope();if(state.local)applyConfig(state.local,'local');else applyConfig({version:'V2.9-DEFAULT',parameters:DEFAULT_PARAMS},'default');
  wrapAssessment();renderStatus();ensureLatest();
  if(!navigator.onLine)restoreProject();
  window.addEventListener('online',()=>{state.server='unknown';ensureLatest()});window.addEventListener('offline',()=>{state.server='offline';renderStatus()});
}
window.V29Config={state,API_BASE,validate,ensureLatest,fetchLatest,applyDebug,publish,discard,reloadCloud,restoreServer,restoreDefaults,exportJSON,importJSON,history,closeHistory,restoreProject,saveProject};
init();
})();
