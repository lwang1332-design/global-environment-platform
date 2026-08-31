/* V2.9.1 administrator page gate.
 * Page-entry password requested by product owner: SHA-256 comparison only.
 * IMPORTANT: this browser gate is not the security boundary for cloud publishing.
 * Formal parameter publish still requires the existing server-side bearer token.
 */
(()=>{
'use strict';
const UI_GATE_KEY='GE_V29_UI_GATE';
const TOKEN_KEY='GE_V29_ADMIN_TOKEN';
const PASSWORD_SHA256='8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
const $g=id=>document.getElementById(id);
async function sha256(text){const b=new TextEncoder().encode(String(text||'')),h=await crypto.subtle.digest('SHA-256',b);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function validPagePassword(password){return(await sha256(password))===PASSWORD_SHA256}
function enterAdmin(){window.adminUnlocked=true;try{window.loadAdminInputs?.()}catch{}try{window.V29Config?.ensureLatest?.()}catch{}try{window.showPage?.('admin')}catch{}setTimeout(()=>window.CockpitScientific?.refresh?.(),0)}
function showLogin(message='请输入管理员权限密码'){window.adminUnlocked=false;const mask=$g('loginMask'),msg=$g('loginMsg'),pwd=$g('adminPwd');mask?.classList.add('show');if(msg)msg.textContent=message;setTimeout(()=>pwd?.focus(),0)}
async function serverLoginIfAvailable(password){const base=String(window.V29Config?.API_BASE||'').replace(/\/$/,'');if(!base)return{ok:false,reason:'中央参数 API 尚未配置'};const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,username:'admin'}),signal:c.signal});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);if(!j.token)throw new Error('服务器未返回管理员令牌');sessionStorage.setItem(TOKEN_KEY,j.token);return{ok:true}}catch(e){return{ok:false,reason:e.message}}finally{clearTimeout(t)}}
window.openAdmin=function(){if(sessionStorage.getItem(UI_GATE_KEY)!=='1'){showLogin();return}enterAdmin()};
window.verifyAdmin=async function(){const pwd=$g('adminPwd')?.value||'',msg=$g('loginMsg');if(msg)msg.textContent='正在验证管理员权限…';if(!await validPagePassword(pwd)){showLogin('密码错误，请重新输入');return}sessionStorage.setItem(UI_GATE_KEY,'1');const cloud=await serverLoginIfAvailable(pwd);$g('loginMask')?.classList.remove('show');if($g('adminPwd'))$g('adminPwd').value='';if(msg)msg.textContent='';enterAdmin();const status=$g('adminStatus');if(status&&!cloud.ok)status.textContent=`页面权限已通过 · ${cloud.reason} · 正式发布仍需服务端验证`};
window.V291AdminGate={lock(){sessionStorage.removeItem(UI_GATE_KEY);sessionStorage.removeItem(TOKEN_KEY);window.adminUnlocked=false;showLogin('管理员权限已锁定')},isUnlocked(){return sessionStorage.getItem(UI_GATE_KEY)==='1'}};
})();
