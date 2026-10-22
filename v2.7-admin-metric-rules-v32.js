/* V3.2 administrator 50-metric thresholds: explicit source and approval required. */
(function(){
'use strict';
const catalog=window.EA_METRIC_CATALOG||[];
const admin=document.getElementById('adminArea');if(!admin||catalog.length!==50)return;
const card=document.createElement('div');card.className='card';card.id='adminMetricRules';
card.innerHTML='<details><summary style="font-size:15px;font-weight:bold;cursor:pointer;color:#123a64">02 风险配置｜50项环境指标与阈值管理（展开）</summary><p class="note">50项定义、公式、单位来自同一个V3.2数据字典。仅启用经过批准且填写来源的阈值；空缺规则保持UNRATED，不自动判定低风险。每行修改后需要点击原有“发布到云端”。</p><div style="max-height:520px;overflow:auto"><table class="history" style="font-size:11px;min-width:1000px"><thead><tr><th>编号/类别</th><th>参数 / 单位 / 公式</th><th>方向</th><th>中风险</th><th>高风险</th><th>规则来源/依据</th><th>批准启用</th></tr></thead><tbody id="adminMetricRuleRows"></tbody></table></div><p id="adminMetricRulesNotice" class="note">规则状态：未读取</p></details>';
const anchor=admin.querySelector('.card');if(anchor)anchor.insertAdjacentElement('afterend',card);else admin.appendChild(card);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&quot;':'&quot;',"'":'&#39;'}[c]));
function render(){
 const list=document.getElementById('adminMetricRuleRows');if(!list)return;
 list.innerHTML=catalog.map(m=>{const r=workingMetricRules?.[m.id]||{};return '<tr data-id="'+m.id+'"><td><b>'+m.id+'</b> '+esc(m.group)+'</td><td><b>'+esc(m.name)+'</b>（'+esc(m.unit)+'）<div style="color:#697a91">'+esc(m.formula)+'</div></td><td><select data-field="direction"><option value="high"'+(r.direction==='low'?'':' selected')+'>越高越危险</option><option value="low"'+(r.direction==='low'?' selected':'')+'>越低越危险</option></select></td><td><input data-field="medium" type="number" step="any" style="width:80px" value="'+esc(r.medium??'')+'"></td><td><input data-field="high" type="number" step="any" style="width:80px" value="'+esc(r.high??'')+'"></td><td><input data-field="source" style="min-width:155px" placeholder="标准/试验报告/版本" value="'+esc(r.source??'')+'"></td><td><input data-field="approved" type="checkbox"'+(r.approved?' checked':'')+'></td></tr>'}).join('');
 list.querySelectorAll('[data-id]').forEach(tr=>tr.addEventListener('change',()=>update(tr)));
 refreshCount();
}
function refreshCount(){const r=workingMetricRules||{},n=Object.values(r).filter(x=>x?.approved).length;document.getElementById('adminMetricRulesNotice').textContent='已批准风险规则 '+n+'/50；未批准规则仅作为编辑草稿，不参与前台风险判定。'}
function update(tr){
 const id=tr.dataset.id,get=k=>tr.querySelector('[data-field="'+k+'"]');
 const dir=get('direction').value,medium=get('medium').value,high=get('high').value,source=get('source').value.trim(),requested=get('approved').checked;
 const valid=medium!==''&&high!==''&&Number.isFinite(Number(medium))&&Number.isFinite(Number(high))&&source.length>=4&&(dir==='high'?Number(high)>Number(medium):Number(high)<Number(medium));
 if(requested&&!valid){get('approved').checked=false;document.getElementById('adminMetricRulesNotice').textContent=id+'：启用前必须填写有效的中/高阈值、正确阈值方向及依据来源（至少4字符）。';return}
 workingMetricRules[id]={direction:dir,medium:medium===''?null:Number(medium),high:high===''?null:Number(high),source,approved:requested&&valid};
 if(typeof markDirty==='function')markDirty('50项环境风险阈值已修改，请审核后发布云端');refreshCount();
}
const previousApply=applyCloud;applyCloud=function(row){previousApply(row);render()};
const prevReset=resetDefaults;resetDefaults=function(){prevReset();render()};
render();
})();