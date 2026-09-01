/* Local workstation adapter. Does not modify engineering model formulas. */
(()=>{
'use strict';
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
if(!isLocal)return;
const api=(p,o)=>fetch('/local-api'+p,{cache:'no-store',headers:{'Content-Type':'application/json'},...o}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||`HTTP ${r.status}`);return j});
const state={health:null,version:null,lastError:''};
function pill(){
  let el=document.getElementById('localWorkstationPill');
  if(el)return el;
  el=document.createElement('button');el.id='localWorkstationPill';el.type='button';
  el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:3000;height:30px;padding:0 10px;border:1px solid #cdd8e8;border-radius:999px;background:#fff;color:#0a2a59;font:700 11px Microsoft YaHei,Arial;box-shadow:0 4px 16px rgba(0,0,0,.12);cursor:pointer';
  el.textContent='本地工作站：检查中';el.onclick=showPanel;document.body.appendChild(el);return el;
}
async function refresh(){
  const el=pill();
  try{const [h,v]=await Promise.all([api('/health'),api('/version')]);state.health=h;state.version=v.version||{};state.lastError='';el.textContent=`本地工作站：${state.version.platform_version||'在线'}`;el.style.color='#087a50'}
  catch(e){state.lastError=e.message;el.textContent='本地工作站：异常';el.style.color='#b4232b'}
}
async function diagnostics(){return api('/diagnostics')}
async function listProjects(){return api('/projects')}
async function saveProject(name,payload,id){return api('/projects',{method:'POST',body:JSON.stringify({id,name,payload})})}
async function saveCalculation(payload){return api('/calculations',{method:'POST',body:JSON.stringify(payload||{})})}
async function backup(){return api('/backup',{method:'POST',body:'{}'})}
async function showPanel(){
  let d=document.getElementById('localWorkstationPanel');if(d){d.remove();return}
  d=document.createElement('div');d.id='localWorkstationPanel';d.style.cssText='position:fixed;right:14px;bottom:52px;z-index:3001;width:360px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #d9e2ef;border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.18);padding:12px;font:11px Microsoft YaHei,Arial;color:#1e293b';d.innerHTML='<b style="font-size:13px;color:#0a2a59">本地工作站</b><div id="localWsBody" style="margin-top:8px">读取诊断信息...</div><div style="display:flex;gap:6px;margin-top:10px"><button id="localWsDiag">系统诊断</button><button id="localWsBackup">一键备份</button><button id="localWsClose">关闭</button></div>';
  document.body.appendChild(d);const body=d.querySelector('#localWsBody');
  try{const x=await diagnostics();body.innerHTML=`版本：${state.version?.platform_version||'--'}<br>Python：${x.python}<br>SQLite：${x.sqlite}<br>数据库：${x.db_integrity}<br>剩余磁盘：${x.disk_free_gb} GB<br>运行模式：Local Online / Cache Fallback`}
  catch(e){body.textContent='诊断失败：'+e.message}
  d.querySelector('#localWsDiag').onclick=async()=>{try{body.textContent=JSON.stringify(await diagnostics(),null,2)}catch(e){body.textContent=e.message}};
  d.querySelector('#localWsBackup').onclick=async()=>{try{const r=await backup();alert('备份完成：'+r.file)}catch(e){alert('备份失败：'+e.message)}};
  d.querySelector('#localWsClose').onclick=()=>d.remove();
}
window.LocalWorkstation={isLocal,state,refresh,diagnostics,listProjects,saveProject,saveCalculation,backup};
window.addEventListener('DOMContentLoaded',refresh);window.addEventListener('online',refresh);
})();
