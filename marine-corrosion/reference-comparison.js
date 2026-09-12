import {number} from './data-quality.js';
import {validationMetrics} from './calibration-v328.js';
import {corrosionClass} from './model-v328.js';
import {escapeHtml as esc,format} from './review-ui.js';
export function referencePair(record,result){
 const p=result.project,s=result.summary;
 if(Math.abs(record.latitude-p.latitude)>1e-8||Math.abs(record.longitude-p.longitude)>1e-8||Math.abs(record.height-p.height)>1e-8)throw new Error('实测点和计算点坐标/高度不一致');
 return {...record,predicted:number(s.isoFirstYearCorrosion),predictedClass:s.isoCorrosionClass,calibrationApplied:s.experienceCalibration.applied,calculationYears:p.years,modelVersion:result.inputSnapshot.modelVersion,inputQuality:result.qualityAssessment.inputGrade,condition:'空间参考比对；假定原始腐蚀结果单位μm/a、碳钢大气区；年代标记不等同准确测量期，非同期验证',status:number(s.isoFirstYearCorrosion)===null?'覆盖不足':'已计算'};
}
export function initReferenceComparison({snapshot,coordinator,chart,toast}){
 const $=s=>document.querySelector(s);let records=[],results=[],stopped=false;
 const key='marineSpatialReference328';try{results=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
 function render(){
  const usable=results.filter(r=>number(r.predicted)!==null),m=validationMetrics(usable),rows=results.map(r=>`<tr><td>${r.id}</td><td>${r.latitude}, ${r.longitude}</td><td>${r.height}</td><td>${esc(r.stamp)}</td><td>${r.observed}</td><td>${format(r.predicted)}</td><td>${esc(r.calculationYears?.join('/')||'—')}</td><td>${format(number(r.predicted)===null?null:r.predicted-r.observed)}</td><td>${esc(r.status)}</td></tr>`).join('');
  $('#referenceResults').innerHTML='<div class="table-scroll"><table class="table"><thead><tr><th>记录</th><th>坐标</th><th>高度m</th><th>年代</th><th>原始结果</th><th>本次估算 μm/a</th><th>计算年</th><th>条件偏差</th><th>状态</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  $('#referenceMetrics').textContent=usable.length?`空间参考比对（假定单位μm/a，非同期验证）：有效 ${m.n} 点；MAE ${format(m.mae)}；RMSE ${format(m.rmse)}；平均偏差 ${format(m.bias)}；MAPE ${format(m.mape)}%；R² ${format(m.r2,3)}；等级命中 ${format(100*usable.filter(r=>corrosionClass('carbon_steel',r.observed)===r.predictedClass).length/usable.length)}%。指标仅针对下表已计算记录，不代表全部121条或独立验证精度。`:'坐标和结果已接入；选择点位进行空间参考比对。准确测量期未核实，结果不用于正式同期校准。';
  if(usable.length)chart('referenceScatter',{tooltip:{trigger:'item'},xAxis:{type:'value',name:'原始结果（假定 μm/a）',nameLocation:'middle',nameGap:28},yAxis:{type:'value',name:'计算 μm/a'},series:[{type:'scatter',data:usable.map(r=>[r.observed,r.predicted])}]});
 }
 async function start(all){
  if(!$('#referenceAssumptions').checked)return toast('请先确认页面列出的参考比对假设');
  const todo=all?records:records.filter(r=>String(r.id)===$('#referencePoint').value);if(!todo.length)return;
  const base=snapshot({mode:'historical',material:'carbon_steel',exposureZone:'atmospheric',requestedYears:[Number($('#year').value)],validationMode:true});base.overrides={};base.calibrationModel=null;stopped=false;$('#referenceRun').disabled=$('#referenceAll').disabled=true;
  try{for(const r of todo){if(stopped)break;$('#referenceStatus').textContent=`正在计算记录 ${r.id}：${r.latitude}, ${r.longitude}，高度 ${r.height} m。可停止，已完成点位会保存。`;
   let row;try{const input=structuredClone(base);Object.assign(input.cfg,{latitude:r.latitude,longitude:r.longitude,height:r.height});row=referencePair(r,await coordinator.run(input))}catch(e){row={...r,predicted:null,status:e.name==='AbortError'?'已停止':'失败：'+e.message};if(e.name==='AbortError')stopped=true}
   results=results.filter(x=>x.id!==r.id);results.push(row);results.sort((a,b)=>a.id-b.id);localStorage.setItem(key,JSON.stringify(results));render();
  }}finally{$('#referenceRun').disabled=$('#referenceAll').disabled=false;$('#referenceStatus').textContent=stopped?'已停止；已完成点位已保留。':'所选点位比对结束。请查看假设、计算年份与有效样本数。'}
 }
 $('#referenceRun').onclick=()=>start(false).catch(e=>toast(e.message));$('#referenceAll').onclick=()=>start(true).catch(e=>toast(e.message));$('#referenceStop').onclick=()=>{stopped=true;coordinator.cancel()};
 $('#referenceExport').onclick=()=>{const blob=new Blob([JSON.stringify({modelVersion:'3.2.8',purpose:'spatial_reference_only',assumptions:'μm/a；碳钢大气区；非同期，禁止作为独立校准证据',records:results},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='corrosion-spatial-reference.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 fetch('./reference-points.json').then(r=>{if(!r.ok)throw new Error('实测点位文件加载失败');return r.json()}).then(d=>{records=d.records;$('#referencePoint').innerHTML=records.map(r=>`<option value="${r.id}">#${r.id} ${r.latitude}, ${r.longitude} / ${r.height}m / 原始${r.observed}</option>`).join('');$('#referenceStatus').textContent=`已载入${records.length}条去重记录；按原始坐标和高度计算。`}).catch(e=>{toast(e.message);$('#referenceStatus').textContent=e.message});render();
 return {cancel:()=>{stopped=true;coordinator.cancel()}};
}
