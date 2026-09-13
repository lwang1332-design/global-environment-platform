import {DEFAULTS,doseResponse,corrosionClass} from './model-v330.js';
import {APP_VERSION,INPUT_STORAGE_KEY,APPLIED_HASH_KEY,normalizeV331Inputs,validateV331Inputs,deriveManagedOverrides,deriveManagedModelParams,stableInputHash} from './input-policy-v331.js';

const readJson=(key,def={})=>{try{return JSON.parse(localStorage.getItem(key)||'null')??def}catch{return def}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};

function seedInputs(){
  const saved=readJson(INPUT_STORAGE_KEY,null);if(saved)return normalizeV331Inputs(saved);
  const o=readJson('marineOverrides',{}),p=readJson('marineModelParams',{});
  return normalizeV331Inputs({
    so2Mode:Number.isFinite(Number(o.so2Dep))?'pd':'auto',so2Pd:o.so2Dep??null,isoSd:o.isoChlorideDep??null,
    wetEnabled:Number.isFinite(Number(p.wetScavengingRatePerMm))&&Number.isFinite(Number(p.wetScavengingHeightM)),wetRatePerMm:p.wetScavengingRatePerMm??null,wetHeightM:p.wetScavengingHeightM??null
  });
}

function patchVersion(){
  document.title=document.title.replaceAll('V3.2.8',`V${APP_VERSION}`).replaceAll('V3.3.0',`V${APP_VERSION}`);
  document.querySelectorAll('.brand-title').forEach(el=>{el.textContent=el.textContent.replaceAll('V3.2.8',`V${APP_VERSION}`).replaceAll('V3.3.0',`V${APP_VERSION}`)});
  const notice=document.querySelector('#globalNotice');
  if(notice&&!notice.dataset.v331Base){notice.dataset.v331Base='1';notice.textContent=`V${APP_VERSION} 可计算性修正版：缺失数据按“环境Screening → 腐蚀Screening → 正式ISO”分级，不再因Pd/Sd缺失阻断环境与海盐计算。`;}
  try{const u=new URL(location.href);if(u.searchParams.get('v')!==APP_VERSION){u.searchParams.set('v',APP_VERSION);history.replaceState({},'',u.pathname+'?'+u.searchParams.toString()+u.hash)}}catch{}
}

function style(){if(document.querySelector('#v331Style'))return;const s=document.createElement('style');s.id='v331Style';s.textContent=`
.v331-input-panel{margin:12px 0;border:1px solid #cbd8e6;background:#fff}.v331-head{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e4ebf2}.v331-head h2{margin:0 0 4px;font-size:16px;color:#123d66}.v331-head p{margin:0;color:#617286;font-size:12px}.v331-levels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px;background:#f8fbfe}.v331-level{border:1px solid #d9e3ed;background:#fff;padding:9px 10px}.v331-level b{display:block;color:#29425f;font-size:12px}.v331-level small{color:#748396;font-size:10px}.v331-level.ready{border-color:#97cbb8;background:#f1faf6}.v331-level.warn{border-color:#e4c48b;background:#fff9ee}.v331-level.formal{border-color:#8fb4db;background:#f1f7fd}.v331-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 16px}.v331-field{display:flex;flex-direction:column;gap:5px}.v331-field label,.v331-field>span{font-size:11px;color:#52667d;font-weight:700}.v331-field input,.v331-field select{min-width:0}.v331-field em{font-style:normal;font-size:10px;color:#8492a4}.v331-wide{grid-column:span 2}.v331-advanced{grid-column:1/-1;border-top:1px dashed #d7e0e9;padding-top:10px}.v331-advanced summary{cursor:pointer;font-size:12px;font-weight:800;color:#315c86}.v331-advanced-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}.v331-check{display:flex;align-items:center;gap:7px;font-size:11px;color:#42566d}.v331-status{padding:0 16px 14px;font-size:11px;color:#607287}.v331-status strong{color:#174f81}.v331-error{color:#a32323!important}.v331-screen-card{border-left:4px solid #e5a43a!important}.v331-mini-action{border:0;background:transparent;color:#315c86;text-decoration:underline;cursor:pointer;font-size:11px}.v331-hidden{display:none!important}@media(max-width:900px){.v331-grid,.v331-advanced-grid{grid-template-columns:1fr 1fr}.v331-levels{grid-template-columns:1fr}.v331-wide{grid-column:span 2}}@media(max-width:560px){.v331-grid,.v331-advanced-grid{grid-template-columns:1fr}.v331-wide{grid-column:span 1}}
`;document.head.append(s)}

function cardHtml(x){return `<section id="v331InputPanel" class="panel v331-input-panel" aria-label="V3.3.1 缺失数据补齐">
 <div class="v331-head"><div><h2>V3.3.1 缺失数据补齐与计算级别</h2><p>默认先完成环境与海盐Screening；补SO₂后输出工程腐蚀筛查；再补ISO 9225湿烛等效Sd后升级正式ISO 9223。</p></div><span class="tag calc">CALCULABILITY</span></div>
 <div class="v331-levels"><div id="v331L1" class="v331-level ready"><b>L1 环境Screening</b><small>始终可算：气象 / 海盐 / Cl⁻ / 湿润 / GIS</small></div><div id="v331L2" class="v331-level warn"><b>L2 腐蚀Screening</b><small>需要SO₂ Pc或Pd；工程Cl⁻作为相对输入</small></div><div id="v331L3" class="v331-level"><b>L3 正式ISO 9223</b><small>还需ISO 9225等效Sd</small></div></div>
 <div class="v331-grid">
  <div class="v331-field v331-wide"><span>SO₂输入方式</span><select id="v331So2Mode"><option value="auto">自动：优先CAMS；缺失则只做L1</option><option value="pc">人工输入空气浓度 Pc（推荐）</option><option value="pd">人工直接输入ISO Pd</option></select><em>人工Pc按 Pd = 0.8 × Pc 自动换算。</em></div>
  <div id="v331PcField" class="v331-field"><label for="v331So2Pc">SO₂ Pc</label><input id="v331So2Pc" type="number" min="0" max="2000" step="0.01" value="${x.so2Pc??''}" placeholder="例如 12.6"><em>μg/m³</em></div>
  <div id="v331PdField" class="v331-field"><label for="v331So2Pd">ISO Pd</label><input id="v331So2Pd" type="number" min="0" max="1000" step="0.01" value="${x.so2Pd??''}" placeholder="直接沉降率"><em>mg/(m²·d)</em></div>
  <div class="v331-field"><label for="v331IsoSd">ISO 9225湿烛等效 Sd</label><input id="v331IsoSd" type="number" min="0" max="5000" step="0.01" value="${x.isoSd??''}" placeholder="无实测可留空"><em>mg/(m²·d)；留空时工程Cl⁻仅Screening</em></div>
  <div class="v331-field"><span>应用规则</span><em>点击“自动获取真实数据并计算”时自动保存并生效；输入有变化时页面会自动刷新一次后继续计算。</em><button id="v331Clear" class="v331-mini-action" type="button">清除本页人工补齐</button></div>
  <details class="v331-advanced"><summary>高级输入：复杂海岸GIS / Wet deposition</summary><div class="v331-advanced-grid">
   <label class="v331-check"><input id="v331GisEnabled" type="checkbox" ${x.gisEnabled?'checked':''}>启用固定GIS人工覆盖（仅Screening）</label>
   <div class="v331-field"><label for="v331GisCoast">最近距海</label><input id="v331GisCoast" type="number" min="0" max="2000" step="0.1" value="${x.gisDistanceToCoastKm??''}" placeholder="可选"><em>km</em></div>
   <div class="v331-field"><label for="v331GisSea">上风向海距</label><input id="v331GisSea" type="number" min="0" max="2000" step="0.1" value="${x.gisUpwindSeaDistanceKm??''}" placeholder="启用时必填"><em>km</em></div>
   <div class="v331-field"><label for="v331GisFetch">有效Fetch</label><input id="v331GisFetch" type="number" min="0" max="2000" step="0.1" value="${x.gisFetchKm??''}" placeholder="启用时必填"><em>km</em></div>
   <label class="v331-check"><input id="v331WetEnabled" type="checkbox" ${x.wetEnabled?'checked':''}>启用Wet deposition高级模型</label>
   <div class="v331-field"><label for="v331WetRate">清除系数 λr</label><input id="v331WetRate" type="number" min="0.00000001" max="100" step="any" value="${x.wetRatePerMm??''}" placeholder="需标定"><em>mm⁻¹</em></div>
   <div class="v331-field"><label for="v331WetHeight">有效气柱 Heff</label><input id="v331WetHeight" type="number" min="0.1" max="10000" step="0.1" value="${x.wetHeightM??''}" placeholder="需标定"><em>m</em></div>
   <div class="v331-field"><span>边界</span><em>GIS固定覆盖不可替代GSHHG Direct；Wet参数无标定时应保持关闭。</em></div>
  </div></details>
 </div><div id="v331Status" class="v331-status">当前：L1环境Screening始终可用。</div>
</section>`}

function injectCard(){if(document.querySelector('#v331InputPanel'))return;const anchor=document.querySelector('.project-strip');if(!anchor)return;const wrap=document.createElement('div');wrap.innerHTML=cardHtml(seedInputs());anchor.after(wrap.firstElementChild);const x=seedInputs();document.querySelector('#v331So2Mode').value=x.so2Mode;bindCard();toggleFields();updateLevelDisplay()}

function readForm(){return normalizeV331Inputs({
 so2Mode:document.querySelector('#v331So2Mode')?.value,so2Pc:document.querySelector('#v331So2Pc')?.value,so2Pd:document.querySelector('#v331So2Pd')?.value,isoSd:document.querySelector('#v331IsoSd')?.value,
 gisEnabled:document.querySelector('#v331GisEnabled')?.checked,gisDistanceToCoastKm:document.querySelector('#v331GisCoast')?.value,gisUpwindSeaDistanceKm:document.querySelector('#v331GisSea')?.value,gisFetchKm:document.querySelector('#v331GisFetch')?.value,
 wetEnabled:document.querySelector('#v331WetEnabled')?.checked,wetRatePerMm:document.querySelector('#v331WetRate')?.value,wetHeightM:document.querySelector('#v331WetHeight')?.value
})}

function toggleFields(){const m=document.querySelector('#v331So2Mode')?.value;document.querySelector('#v331PcField')?.classList.toggle('v331-hidden',m!=='pc');document.querySelector('#v331PdField')?.classList.toggle('v331-hidden',m!=='pd')}
function setStatus(text,error=false){const el=document.querySelector('#v331Status');if(!el)return;el.textContent=text;el.classList.toggle('v331-error',error)}

function persistRuntime(x){
  const oldO=readJson('marineOverrides',{}),oldP=readJson('marineModelParams',{}),nextO=deriveManagedOverrides(x,oldO),nextP=deriveManagedModelParams(x,oldP);
  localStorage.setItem(INPUT_STORAGE_KEY,JSON.stringify(x));localStorage.setItem('marineOverrides',JSON.stringify(nextO));localStorage.setItem('marineModelParams',JSON.stringify(nextP));localStorage.setItem(APPLIED_HASH_KEY,stableInputHash(x));
  const audit=readJson('marineAudit',[]);audit.unshift({time:new Date().toISOString(),type:'V331_INPUT_APPLY',before:{overrides:oldO,model:oldP},after:{overrides:nextO,model:nextP,v331Inputs:x},reason:'V3.3.1可计算性补齐'});localStorage.setItem('marineAudit',JSON.stringify(audit.slice(0,100)));
}

function managedClear(){
  const o=readJson('marineOverrides',{}),p=readJson('marineModelParams',{});delete o.so2Dep;delete o.isoChlorideDep;delete p.wetScavengingRatePerMm;delete p.wetScavengingHeightM;
  localStorage.setItem('marineOverrides',JSON.stringify(o));localStorage.setItem('marineModelParams',JSON.stringify(p));localStorage.removeItem(INPUT_STORAGE_KEY);localStorage.removeItem(APPLIED_HASH_KEY);location.reload();
}

function bindCard(){
  document.querySelector('#v331So2Mode')?.addEventListener('change',()=>{toggleFields();updateLevelDisplay()});
  document.querySelectorAll('#v331InputPanel input,#v331InputPanel select').forEach(el=>el.addEventListener('input',updateLevelDisplay));
  document.querySelector('#v331Clear')?.addEventListener('click',managedClear);
  const run=document.querySelector('#runBtn');if(run&&!run.dataset.v331Bound){run.dataset.v331Bound='1';run.addEventListener('click',e=>{
    const {inputs,errors}=validateV331Inputs(readForm());if(errors.length){e.preventDefault();e.stopImmediatePropagation();setStatus(errors.join('；'),true);return}
    const hash=stableInputHash(inputs),applied=localStorage.getItem(APPLIED_HASH_KEY);if(hash!==applied){e.preventDefault();e.stopImmediatePropagation();persistRuntime(inputs);sessionStorage.setItem('marineV331AutoRun','1');location.reload()}
  },true)}
}

function modelParamRows(){
  const saved={...DEFAULTS,...readJson('marineModelParams',{})};
  const rows=[['海盐κ','kappa','—'],['Cl质量占比','chlorideFraction','—'],['雨洗效率','washEfficiency','—'],['通用捕盐系数','captureFactor','—'],['撞击特征长度','characteristicLength','m'],['ISO SO₂浓度→Pd系数','isoSo2ConcentrationFactor','—'],['Proxy距海尺度','proxyDistanceScaleKm','km'],['Proxy距海下限','proxyDistanceFloor','—'],['Proxy盐雾系数','proxySaltCoeff','—'],['Proxy风速指数','proxyWindExp','—'],['35μm Spray衰减长度','localSprayScale35Km','km'],['75μm Spray衰减长度','localSprayScale75Km','km'],['Spray源强系数','localSprayCoeff','—'],['Spray风速指数','localSprayWindExp','—'],['Spray波浪指数','localSprayWaveExp','—'],['撞击方向因子','genericImpactionOrientation','—'],['CAMS RH80干盐质量因子','camsDryMassFactor','—'],['CAMS RH80/干半径比','camsRadiusRatio80ToDry','—']];
  return `<table class="table"><thead><tr><th>参数</th><th>代码</th><th>当前值</th><th>单位</th></tr></thead><tbody>${rows.map(([label,key,unit])=>`<tr><td>${esc(label)}</td><td>${esc(key)}</td><td><input data-model-param="${esc(key)}" value="${esc(saved[key])}" type="number" step="any"></td><td>${esc(unit)}</td></tr>`).join('')}</tbody></table><p class="muted">V3.3.1：Wet参数建议从上方“高级输入”启用；未标定时保持关闭。</p>`;
}
function overrideRows(){
  const saved=readJson('marineOverrides',{});const rows=[['波高 Hs','waveHeight','m'],['海水盐度','salinity','PSU'],['CAMS SS1','camsSs1','kg/kg@RH80'],['CAMS SS2','camsSs2','kg/kg@RH80'],['CAMS SS3','camsSs3','kg/kg@RH80'],['CAMS SO₂','camsSo2','kg/kg'],['ISO SO₂沉降 Pd','so2Dep','mg/(m²·d)'],['ISO 9225等效Cl⁻沉降 Sd','isoChlorideDep','mg/(m²·d)']];
  return `<table class="table"><thead><tr><th>变量</th><th>代码</th><th>Override</th><th>单位</th><th>规则</th></tr></thead><tbody>${rows.map(([label,key,unit])=>`<tr><td>${esc(label)}</td><td>${esc(key)}</td><td><input data-override="${esc(key)}" value="${saved[key]??''}" type="number" step="any" placeholder="留空=自动/保持MISSING"></td><td>${esc(unit)}</td><td><span class="tag override">原始值保留</span></td></tr>`).join('')}</tbody></table><p class="muted">普通工程人员建议优先使用页面上方V3.3.1补齐卡：Pc更直观，系统自动换算Pd；管理员页保留直接Pd/Sd覆盖。</p>`;
}
function patchAdmin(){const p=document.querySelector('#parameterTable'),o=document.querySelector('#overrideTable');if(p&&p.querySelector('[data-model-param]')&&!p.querySelector('[data-model-param="localSprayScale35Km"]'))p.innerHTML=modelParamRows();if(o&&o.querySelector('[data-override]')&&!o.querySelector('[data-override="isoChlorideDep"]'))o.innerHTML=overrideRows()}

function metricNumber(label){for(const row of document.querySelectorAll('.metric-row')){if(row.querySelector('.metric-name strong')?.textContent.trim()===label)return n(row.querySelector('.metric-val')?.textContent)}return null}
function statNumber(container,label){for(const card of document.querySelectorAll(`${container} .stat-card`)){if(card.querySelector('span')?.textContent.trim()===label)return n(card.querySelector('b')?.textContent)}return null}
function formalClass(){const t=document.querySelector('#isoClass')?.textContent.trim()||'';const level=document.querySelector('#riskRing')?.dataset.v331Level;if(level==='screening'||level==='environment')return null;return /^(C1|C2|C3|C4|C5|CX)$/.test(t)?t:null}

function updateLevelDisplay(){
  const form=document.querySelector('#v331InputPanel')?readForm():seedInputs(),pdDom=metricNumber('SO₂沉降'),cl=metricNumber('Cl⁻沉降率'),t=statNumber('#dataStats','周期平均气温'),rh=statNumber('#dataStats','周期平均湿度'),material=document.querySelector('#material')?.value||'carbon_steel';
  const pd=Number.isFinite(pdDom)?pdDom:(form.so2Mode==='pc'&&Number.isFinite(form.so2Pc)?form.so2Pc*(DEFAULTS.isoSo2ConcentrationFactor??.8):form.so2Mode==='pd'?form.so2Pd:null);
  const isoClass=formalClass(),screen=(!isoClass&&[pd,cl,t,rh].every(Number.isFinite))?(()=>{const rate=doseResponse(material,pd,cl,rh,t);return {rate,cls:corrosionClass(material,rate)}})():null;
  const l1=document.querySelector('#v331L1'),l2=document.querySelector('#v331L2'),l3=document.querySelector('#v331L3');l1?.classList.add('ready');l2?.classList.toggle('ready',Number.isFinite(pd));l2?.classList.toggle('warn',!Number.isFinite(pd));l3?.classList.toggle('formal',!!isoClass);l3?.classList.toggle('warn',!isoClass&&form.isoSd!==null&&Number.isFinite(pd));
  const ring=document.querySelector('#riskRing'),clsEl=document.querySelector('#isoClass'),label=document.querySelector('#isoLabel');
  if(isoClass){if(ring)ring.dataset.v331Level='formal';if(label)label.textContent='FORMAL ISO 9223';setStatus('L3正式ISO：可追溯Pd与ISO 9225等效Sd已进入正式剂量响应。');}
  else if(screen&&Number.isFinite(screen.rate)){
    if(ring)ring.dataset.v331Level='screening';if(clsEl)clsEl.textContent=screen.cls+'*';if(label)label.textContent='ENGINEERING SCREENING';
    let box=document.querySelector('#v331ScreenResult');if(!box){box=document.createElement('div');box.id='v331ScreenResult';box.className='stat-card v331-screen-card';document.querySelector('#riskMetrics')?.prepend(box)}box.innerHTML=`<span>工程Screening腐蚀率</span><b>${screen.rate.toFixed(2)}</b><em>${material==='aluminium'?'g/(m²·a)':'μm/a'} · ${screen.cls}*</em><div class="risk-med">非正式ISO</div>`;
    setStatus(`L2工程腐蚀Screening可用：Pd=${pd.toFixed(2)}，工程Cl⁻=${cl.toFixed(3)}。等级“${screen.cls}*”仅作相对筛查，不能替代ISO 9225湿烛Sd。`);
  }else{
    if(ring)ring.dataset.v331Level='environment';if(clsEl)clsEl.textContent='L1';if(label)label.textContent='ENVIRONMENT SCREENING';document.querySelector('#v331ScreenResult')?.remove();
    setStatus('L1环境Screening可用。若CAMS SO₂仍缺失，请输入SO₂ Pc（推荐）或Pd，即可升级L2工程腐蚀Screening。');
  }
}

function init(){style();patchVersion();injectCard();patchAdmin();const observer=new MutationObserver(()=>{patchVersion();injectCard();patchAdmin();updateLevelDisplay()});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});document.addEventListener('click',()=>setTimeout(()=>{patchVersion();patchAdmin();updateLevelDisplay()},0),true);if(sessionStorage.getItem('marineV331AutoRun')==='1'){sessionStorage.removeItem('marineV331AutoRun');setTimeout(()=>document.querySelector('#runBtn')?.click(),350)}}

if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()}
