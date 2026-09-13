import {DEFAULTS} from './model-v330.js';

const readJson=(key,def={})=>{try{return JSON.parse(localStorage.getItem(key)||'null')||def}catch{return def}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function patchVersion(){
  document.title=document.title.replaceAll('V3.2.8','V3.3.0');
  document.querySelectorAll('.brand-title').forEach(el=>{el.textContent=el.textContent.replaceAll('V3.2.8','V3.3.0')});
  const notice=document.querySelector('#globalNotice');
  if(notice&&/V3\.2\.8/.test(notice.textContent))notice.textContent=notice.textContent.replaceAll('V3.2.8','V3.3.0').replace('数据质量、完整时序统计与地图选点','科学模型修正版：标准Pd/Sd门控、CAMS RH80修正、单Fetch与量纲闭合沉降');
  try{const u=new URL(location.href);if(u.searchParams.get('v')!=='3.3.0'){u.searchParams.set('v','3.3.0');history.replaceState({},'',u.pathname+'?'+u.searchParams.toString()+u.hash)}}catch{}
}

function modelParamRows(){
  const saved={...DEFAULTS,...readJson('marineModelParams',{})};
  const rows=[
    ['海盐κ','kappa','—'],['Cl质量占比','chlorideFraction','—'],['雨洗效率','washEfficiency','—'],['通用捕盐系数','captureFactor','—'],['撞击特征长度','characteristicLength','m'],
    ['ISO SO₂浓度→Pd系数','isoSo2ConcentrationFactor','—'],['Proxy距海尺度','proxyDistanceScaleKm','km'],['Proxy距海下限','proxyDistanceFloor','—'],['Proxy盐雾系数','proxySaltCoeff','—'],['Proxy风速指数','proxyWindExp','—'],
    ['35μm Spray衰减长度','localSprayScale35Km','km'],['75μm Spray衰减长度','localSprayScale75Km','km'],['Spray源强系数','localSprayCoeff','—'],['Spray风速指数','localSprayWindExp','—'],['Spray波浪指数','localSprayWaveExp','—'],
    ['撞击方向因子','genericImpactionOrientation','—'],['CAMS RH80干盐质量因子','camsDryMassFactor','—'],['CAMS RH80/干半径比','camsRadiusRatio80ToDry','—']
  ];
  return `<table class="table"><thead><tr><th>参数</th><th>代码</th><th>当前值</th><th>单位</th></tr></thead><tbody>${rows.map(([label,key,unit])=>`<tr><td>${esc(label)}</td><td>${esc(key)}</td><td><input data-model-param="${esc(key)}" value="${esc(saved[key])}" type="number" step="any"></td><td>${esc(unit)}</td></tr>`).join('')}</tbody></table><p class="muted">V3.3.0：Wet scavenging参数与ISO Cl等效系数在完成标定前不开放为普通默认参数；ISO Sd建议优先使用下方实测Override。</p>`;
}

function overrideRows(){
  const saved=readJson('marineOverrides',{});
  const rows=[
    ['波高 Hs','waveHeight','m'],['海水盐度','salinity','PSU'],['CAMS SS1','camsSs1','kg/kg@RH80'],['CAMS SS2','camsSs2','kg/kg@RH80'],['CAMS SS3','camsSs3','kg/kg@RH80'],['CAMS SO₂','camsSo2','kg/kg'],['ISO SO₂沉降 Pd','so2Dep','mg/(m²·d)'],['ISO 9225等效Cl⁻沉降 Sd','isoChlorideDep','mg/(m²·d)']
  ];
  return `<table class="table"><thead><tr><th>变量</th><th>代码</th><th>Override</th><th>单位</th><th>规则</th></tr></thead><tbody>${rows.map(([label,key,unit])=>`<tr><td>${esc(label)}</td><td>${esc(key)}</td><td><input data-override="${esc(key)}" value="${saved[key]??''}" type="number" step="any" placeholder="留空=使用数据/保持MISSING"></td><td>${esc(unit)}</td><td><span class="tag override">原始值保留</span></td></tr>`).join('')}</tbody></table><p class="muted">SO₂缺失不再自动设Pd=1；ISO Sd缺失时不输出正式ISO腐蚀率，工程Cl仅用于screening。</p>`;
}

function patchAdmin(){
  const p=document.querySelector('#parameterTable'),o=document.querySelector('#overrideTable');
  if(p&&p.querySelector('[data-model-param]')&&!p.querySelector('[data-model-param="localSprayScale35Km"]'))p.innerHTML=modelParamRows();
  if(o&&o.querySelector('[data-override]')&&!o.querySelector('[data-override="isoChlorideDep"]'))o.innerHTML=overrideRows();
}

function init(){
  patchVersion();patchAdmin();
  new MutationObserver(()=>{patchVersion();patchAdmin()}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(patchVersion,0),true);
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
