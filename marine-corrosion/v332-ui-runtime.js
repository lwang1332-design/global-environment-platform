import './v331-ui-runtime.js';
import {APP_VERSION,SO2_AUTO_POLICY} from './input-policy-v332.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function patchVersion(){
  document.title=document.title.replace(/V3\.3\.1/g,`V${APP_VERSION}`);
  $$('.brand-title').forEach(el=>{el.textContent=el.textContent.replace(/V3\.3\.1/g,`V${APP_VERSION}`)});
  try{const u=new URL(location.href);if(u.searchParams.get('v')!==APP_VERSION){u.searchParams.set('v',APP_VERSION);history.replaceState({},'',u.pathname+'?'+u.searchParams.toString()+u.hash)}}catch{}
}

function patchPanel(){
  const panel=$('#v331InputPanel');if(!panel)return false;
  panel.setAttribute('aria-label','V3.3.2 SO₂ Auto与缺失数据补齐');
  const h=panel.querySelector('.v331-head h2');if(h)h.textContent='V3.3.2 SO₂ Auto与缺失数据补齐';
  const p=panel.querySelector('.v331-head p');if(p)p.textContent='SO₂ Auto已接入CAMS：Historical使用EAC4月平均，Current使用CAMS Global Forecast；只有上游/凭据不可用时才降级到L1或人工Pc/Pd。';
  const auto=$('#v331So2Mode option[value="auto"]');if(auto)auto.textContent='自动：Historical=CAMS EAC4；Current=CAMS Forecast';
  let note=$('#v332So2AutoNote');
  if(!note){note=document.createElement('div');note.id='v332So2AutoNote';note.className='v331-status';panel.append(note)}
  note.innerHTML=`SO₂ Auto：<b>${SO2_AUTO_POLICY.historical.source}</b>（ML60，2003–2025） / <b>${SO2_AUTO_POLICY.current.source}</b>（ML137，0–120 h）。缺失保持MISSING，不当零、不恢复Pd=1。`;
  return true;
}

function patch(){patchVersion();patchPanel()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
let tries=0;const timer=setInterval(()=>{patch();if(++tries>=20&&$('#v331InputPanel'))clearInterval(timer)},250);
