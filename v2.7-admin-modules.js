/* Admin seven-module plan editor. Uses original plan textareas and save/publish pipeline. */
(function(){
const groups=['总体架构与热管理','环境隔离与防护','湿度与凝露控制','低温防护与防冰','腐蚀与材料防护','特殊环境专项防护','智能监测与环境控制'];
const ids=['planStandard','planPro','planPlus'];
function classify(value){
 const t=String(value||'');
 const explicit=t.match(/^\\s*\\[(0[1-7])\\]/);if(explicit)return Number(explicit[1])-1;
 if(/监测|预警|传感|智能|联动|控制策略|远程|预测|在线监控|状态诊断|数据采集|压差监控/.test(t))return 6;
 if(/盐雾|腐蚀|防腐|涂层|耐蚀|不锈钢|镀锌|异种金属|材料防护|C5|CX|防锈/.test(t))return 4;
 if(/沙尘|沙蚀|防沙|高海拔|低气压|紫外|UV|台风|雷电|防雷|防霉|霉菌|生物|暴雪|风吹雪|特殊环境/.test(t))return 5;
 if(/凝露|露点|湿度|除湿|防潮|湿膜|干燥|加湿/.test(t))return 2;
 if(/低温|保温|防冰|结冰|伴热|防冻|融冰|预热|加热|冷启动|低温润滑|防寒/.test(t))return 3;
 if(/防雨|防水|风驱雨|防尘|密封|过滤|滤芯|百叶|排水|进风口防护|迷宫|IPX|IP[0-9]/.test(t))return 1;
 return 0;
}
const host=document.getElementById('planStandard')?.closest('.card');if(!host)return;
const panel=document.createElement('div');panel.id='adminSevenModules';panel.innerHTML='<h4 style="margin:12px 0 8px;color:#0b2548">核心技术配置 · 七模块编辑</h4><p class="note">选择方案后逐模块编辑，每行一条措施。自动与上方原方案文本同步；保存场景和云端发布方式不变。</p><div style="display:flex;gap:12px;align-items:center;margin:8px 0"><label>方案 <select id="moduleTier"><option value="planStandard">标准方案</option><option value="planPro">强化方案</option><option value="planPlus">极致方案</option></select></label><span id="moduleCount" style="color:#667085;font-size:11px"></span></div><div id="moduleGrid" class="admin-module-grid"></div>';
const toolbar=host.querySelector('.toolbar');host.insertBefore(panel,toolbar);
const style=document.createElement('style');style.textContent='.admin-module-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.admin-module-box{border:1px solid #dce5f0;background:#fbfdff;border-radius:6px;padding:9px}.admin-module-box label{display:block;color:#123a64;font-weight:bold;font-size:12px}.admin-module-box textarea{width:100%;min-height:80px;margin-top:5px;font-size:12px}.admin-module-box:last-child{grid-column:1/-1}@media(max-width:740px){.admin-module-grid{grid-template-columns:1fr}.admin-module-box:last-child{grid-column:auto}}';document.head.appendChild(style);
let syncing=false;
function parse(source){const bins=groups.map(()=>[]);String(source||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(x=>bins[classify(x)].push(x.replace(/^\[(0[1-7])\]\s*/,'')));return bins}
function draw(){if(syncing)return;const val=document.getElementById(document.getElementById('moduleTier').value).value;const bins=parse(val);document.getElementById('moduleGrid').innerHTML=groups.map((g,i)=>'<div class="admin-module-box"><label>' +String(i+1).padStart(2,'0')+' · '+g+'</label><textarea data-module="'+i+'" placeholder="每行一条方案措施"></textarea></div>').join('');panel.querySelectorAll('[data-module]').forEach((x,i)=>{x.value=bins[i].join('\n');x.addEventListener('input',commit)});document.getElementById('moduleCount').textContent=bins.reduce((n,g)=>n+g.length,0)+' 条措施'}
function commit(){const id=document.getElementById('moduleTier').value;let rows=[];panel.querySelectorAll('[data-module]').forEach((el,i)=>el.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(x=>rows.push('['+String(i+1).padStart(2,'0')+'] '+x.replace(/^\[(0[1-7])\]\s*/,''))));const raw=document.getElementById(id);syncing=true;raw.value=rows.join('\n');raw.dispatchEvent(new Event('input',{bubbles:true}));syncing=false;window.EA_ADMIN_PLAN_PENDING=true;if(typeof markDirty==='function')markDirty('七模块技术措施已修改，请先保存当前场景，再发布云端');document.getElementById('moduleCount').textContent=rows.length+' 条措施'}
document.getElementById('moduleTier').onchange=draw;
ids.forEach(id=>document.getElementById(id).addEventListener('input',()=>{if(document.getElementById('moduleTier').value===id&&!syncing)draw()}));
document.getElementById('sceneSelect')?.addEventListener('change',()=>setTimeout(draw,0));
new MutationObserver(()=>{if(!syncing&&panel.offsetParent!==null)draw()}).observe(document.getElementById('planStandard'),{attributes:true,attributeFilter:['value']});
document.getElementById('saveScene')?.addEventListener('click',()=>{window.EA_ADMIN_PLAN_PENDING=false});
const priorApply=applyCloud;
applyCloud=function(row){priorApply(row);window.EA_ADMIN_PLAN_PENDING=false;setTimeout(draw,0)};
draw();
})();