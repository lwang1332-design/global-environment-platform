(function(){
const target=document.getElementById('adminArea');if(!target)return;
const pane=document.createElement('div');pane.className='card';
pane.innerHTML='<h2>管理员安全与审计</h2><p class="note">云端修改密码，要求12至128位且包含字母和数字。修改成功后重新登录。</p><div class="grid3"><label>原密码<input id="adminOldPassword" type="password" autocomplete="current-password"></label><label>新密码<input id="adminNewPassword" type="password" autocomplete="new-password"></label><label>确认新密码<input id="adminRepeatPassword" type="password" autocomplete="new-password"></label></div><div class="toolbar"><button class="btn primary" id="adminChangePassword" type="button">修改管理员密码</button><button class="btn secondary" id="adminRefreshAudit" type="button">读取审计记录</button></div><p class="note" id="adminPasswordNotice" aria-live="polite">不修改技术货架数据。</p><table class="history"><thead><tr><th>时间</th><th>操作</th><th>结果</th></tr></thead><tbody id="adminAuditRows"><tr><td colspan="3">登录后查看</td></tr></tbody></table>';
target.appendChild(pane);
const $=id=>document.getElementById(id),notice=(msg,bad)=>{$('adminPasswordNotice').textContent=msg;$('adminPasswordNotice').style.color=bad?'#b91c1c':'#087a59'};
async function call(path,opt={}){if(!token)throw Error('未登录管理员');const r=await fetch(CLOUD_API+path,{cache:'no-store',...opt,headers:{'Content-Type':'application/json','authorization':'Bearer '+token,...(opt.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j}
$('adminChangePassword').onclick=async()=>{
const old=$('adminOldPassword').value,n=$('adminNewPassword').value,again=$('adminRepeatPassword').value;
if(n!==again)return notice('新密码两次输入不一致',true);
if(n.length<12||n.length>128||!/[A-Za-z]/.test(n)||!/[0-9]/.test(n))return notice('密码需12至128位，包含字母和数字',true);
$('adminChangePassword').disabled=true;
try{await call('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:old,newPassword:n})});$('adminOldPassword').value='';$('adminNewPassword').value='';$('adminRepeatPassword').value='';token='';$('adminArea').classList.add('hidden');$('loginCard').classList.remove('hidden');notice('修改成功，旧会话已失效，请重新登录',false)}
catch(e){notice('修改失败：'+e.message,true)}finally{$('adminChangePassword').disabled=false}
};
$('adminRefreshAudit').onclick=async()=>{try{const j=await call('/auth/audit');$('adminAuditRows').innerHTML=(j.items||[]).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString()+'</td><td>'+String(x.action).replaceAll('<','&lt;')+'</td><td>'+String(x.outcome).replaceAll('<','&lt;')+'</td></tr>').join('')||'<tr><td colspan="3">暂无记录</td></tr>'}catch(e){notice('审计读取失败：'+e.message,true)}};
})();