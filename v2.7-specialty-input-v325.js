/* V3.2.5 locally reviewed specialty measurements, not cloud-certified data. */
(function(){
'use strict';
const special=new Set([8,9,10,15,21,24,25,29,30,42,43,45,46,48,49,50]);
const $=id=>document.getElementById(id);
const context=()=>[$('lat')?.value,$('lon')?.value,$('periodYears')?.value].join('|');
const storageKey='ea-health-v3-verified';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('根节点必须为JSON对象');
 if(String(input.context||'')!==context())throw Error('文件中context必须与当前经纬度及统计周期一致');
 if(!Array.isArray(input.records)||input.records.length>50)throw Error('records必须为数组，且不超过50条');
 const accepted={};
 for(const item of input.records){
  const id=Number(item.id);if(!special.has(id))throw Error('不允许覆盖非专项指标EA'+id);
  const def=window.EA_METRIC_CATALOG?.[id-1];if(!def)throw Error('未知指标EA'+id);
  if(item.unit!==def.unit)throw Error('指标'+def.id+'单位必须为'+def.unit);
  if(!['APPROVED','DRAFT'].includes(item.reviewStatus))throw Error(def.id+'的审核状态无效');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(item.sourceDate||''))||!Number.isFinite(Date.parse(item.sourceDate+'T00:00:00Z')))throw Error(def.id+'的测量日期无效');
  if(String(item.source||'').trim().length<4||String(item.evidenceRef||'').trim().length<4||String(item.reviewedBy||'').trim().length<2)throw Error(def.id+'缺少测量机构、报告编号或审核人');
  if(item.reviewStatus!=='APPROVED')continue;
  const numeric=typeof item.value==='number'&&Number.isFinite(item.value);
  const categorical=typeof item.value==='string'&&item.value.trim().length>0&&item.value.length<=150;
  if(!numeric&&!categorical)throw Error(def.id+'指标值必须是有效数字或分类文本');
  if(numeric&&([8,9,10,15,21,29,30,42,43,45,48,49].includes(id))&&item.value<0)throw Error(def.id+'不允许负值');
  if(numeric&&id===8&&(item.value>100||item.value<0))throw Error(def.id+'概率必须在0至100之间');
  accepted[id]={value:item.value,source:String(item.source).trim(),sourceDate:item.sourceDate,evidenceRef:String(item.evidenceRef).trim(),reviewedBy:String(item.reviewedBy).trim(),reviewStatus:'APPROVED',unit:def.unit,period:String(item.period||'专项实测期').slice(0,90),rule:'来自专项报告'+String(item.evidenceRef).trim(),quality:'待云端复核'};
 }
 return accepted;
}
function install(){
 const area=$('envHealth');if(!area)return;
 const bar=document.createElement('div');bar.id='specialDataImport';bar.style.cssText='border:1px solid #dfe7f1;background:#f8fbff;border-radius:6px;padding:10px;margin:8px 0;font-size:11px';
 const template={context:context(),records:[{id:21,value:4.2,unit:window.EA_METRIC_CATALOG?.[20]?.unit||'mg/(m²·d)',source:'项目盐沉积采样实验室',sourceDate:'2026-10-01',evidenceRef:'REPORT-DEMO-001',reviewedBy:'项目审核人员',reviewStatus:'DRAFT',period:'现场专项采样'}]};
 bar.innerHTML='<b>专项环境数据接入（本地复核资料）</b><p style="margin:4px 0">仅允许EA08/09/10、EA15、EA21、EA24/25、EA29/30、EA42/43/45、EA46、EA48/49/50。需来源、日期、报告编号、审核人；不可作为云端工程批准的替代。先设置正确项目坐标和周期。</p><input type="file" id="specialDataFile" accept=".json,application/json"><button type="button" id="specialExample">下载JSON格式样例</button><button type="button" id="specialClear">清除当前项目本地专项数据</button><div id="specialMessage" aria-live="polite">没有导入资料时按专项缺口处理。</div>';
 area.querySelector('.section-title')?.insertAdjacentElement('afterend',bar);
 const msg=t=>{$('specialMessage').textContent=t};
 $('specialExample').onclick=()=>{
  template.context=context();const payload=JSON.stringify(template,null,2);
  const blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='EA-specialty-data-example.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 $('specialDataFile').onchange=async()=>{
  const file=$('specialDataFile').files?.[0];if(!file)return;
  if(file.size>1024*1024)return msg('导入失败：文件不得超过1MB');
  try{
   const input=JSON.parse(await file.text()),fields=validate(input);
   localStorage.setItem(storageKey,JSON.stringify({context:context(),fields}));
   msg('已导入 '+Object.keys(fields).length+' 项经本地审核的专项记录；仅当前坐标与统计周期有效。风险阈值仍需管理员审批。');
   if(typeof renderEnv==='function')renderEnv();
  }catch(e){msg('导入失败：'+String(e.message||e))}
 };
 $('specialClear').onclick=()=>{localStorage.removeItem(storageKey);msg('当前项目本地专项记录已清除');if(typeof renderEnv==='function')renderEnv()};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();