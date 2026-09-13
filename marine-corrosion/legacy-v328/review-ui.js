import {number,utcMs} from './data-quality.js';
import {CALIBRATION_META} from './calibration-v328.js';
import {corrosionClass,growthFactor,settlingVelocity} from './model-v328.js';
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const format=(v,d=1)=>number(v)===null?'—':Number(v).toFixed(d);
const $=s=>document.querySelector(s);
function table(headers,rows){return '<div class="table-scroll"><table class="table"><thead><tr>'+headers.map(x=>'<th>'+escapeHtml(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+escapeHtml(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
export function renderQuality(result){
 if(!result)return;const a=result.qualityAssessment,s=result.summary;
 $('#qualityOverview').textContent=`输入数据质量：${a.inputGrade}。${a.rules[a.inputGrade]}。模型验证证据：${a.modelEvidence}。${a.reasons.join('；')}。`;
 $('#qualityTable').innerHTML=table(['变量 / 单位','实际数据来源','原始有效覆盖','原始缺测','有效计算值','插值','估算','人工覆盖'],result.quality.map(q=>[q.label+' / '+q.unit,q.source,format(q.sourceCoveragePercent)+'%',format(q.originalMissingPercent)+'%',format(q.validPercent)+'%',format(q.interpolatedPercent)+'%',format(q.estimatedPercent)+'%',format(q.overridePercent)+'%']));
 const grids=[];for(const env of result.environmentByYear||[])for(const key of ['weather','cams','ocean']){const p=env[key];for(const g of [p?.grid,...(p?.grids||[])].filter(Boolean))grids.push([env.year||'Current',key,g.selection||'上游未说明',g.actual?.latitude??'未提供',g.actual?.longitude??'未提供',format(g.distanceKm,2)])}
 $('#gridDetails').innerHTML=grids.length?table(['年份','来源','海陆选格','数据格点纬度','数据格点经度','距项目点 / km'],grids):'<p>上游未提供实际格点坐标，不把项目坐标冒充数据格点。</p>';
 $('#periodDetails').textContent=`统计周期：${s.periodLabel}。预期 ${s.expectedHours} h；关键气象有效 ${format(s.hours,1)} h（${format(s.coveragePercent)}%）。累计量为有效覆盖时段积分，不自动补齐缺失时段。${s.stateContinuity.rule}`;
}
export function renderServices(health,result){
 const labels={era5:'ERA5 Direct',cams:'CAMS Direct',cmems:'CMEMS Direct'},rows=[],names={valid_data:'有效数据',partial_data:'部分有效数据',fallback_or_missing:'替代数据 / 估算',pending:'上游任务准备中'};
 if(result?.environmentByYear?.length){for(const env of result.environmentByYear)for(const [key,s] of Object.entries(env.services))rows.push([env.year||'Current',labels[key],names[s.status]||s.status,s.source,format(s.coveragePercent)+'%',s.first&&s.last?s.first+' ～ '+s.last:'无有效覆盖',s.lastSuccess||'暂无成功记录',s.error?`${s.error.code}：${s.error.message}`:'—'])}
 else for(const key of Object.keys(labels))rows.push(['—',labels[key],health?.reachable?(health.services?.[key]?.configured?'已配置，尚未验证本次数据':'未配置 / 未确认'):'不可达','尚未计算','—','—','—',health?.message||'等待检查']);
 const html=table(['年度','服务','本次状态','实际采用来源','Direct有效覆盖','Direct覆盖时间','最近数据成功时间（本机所有点位）','原因'],rows);
 $('#sourceTable').innerHTML=html;$('#directDataStatus').innerHTML=html;$('#oceanStatus').innerHTML=html;
 $('#sourceText').textContent=health?.reachable?'Direct健康检查已返回；数据状态见本次结果':(health?.message||'正在检查Direct');$('#sourceDot').className='dot '+(health?.reachable?'ok':'warn');
 $('#serviceHealth').textContent=`健康检查：${health?.checkedAt||'等待'}。${health?.reachable?'配置状态不代表已获得有效数据。':health?.message||'正在检查'} 本次数据与估算项分别列示。`;
}
const titles={wave:'有效波高',salinity:'盐度',so2:'SO₂沉降',airSalt:'空气海盐浓度',clDep:'Cl⁻沉降率',surfaceCl:'表面Cl⁻库存',tow:'ISO气象湿润时长',cond:'凝露时长',corrosion:'首年腐蚀估算',gis:'GIS与数据格点'};
export function traceData(result,metric,time=null){
 const r=(time?result.hourly.find(x=>utcMs(x.time)===utcMs(time)):result.hourly.find(x=>x.valid))||result.hourly[0],s=result.summary,P=result.inputSnapshot.cfg,parts=[];
 if(!r.valid)return {title:titles[metric]||metric,time:r.time,parts:[['状态',r.reason]],row:r};
 if(metric==='airSalt'){
  parts.push(['空气密度',`${format(r.p,3)} × 100 / [287.05 × (${format(r.t,3)} + 273.15)] = ${format(r.rho,6)} kg/m³`]);
  parts.push(['海盐来源',r.camsAvailable?'本小时三粒径质量混合比有效；经空气密度与高度系数换算':'本小时CAMS三粒径不完整，使用完整海盐代理，未将缺测当成零']);
  parts.push(['CAMS换算或代理组成',`背景粒径浓度 ${[r.ss1,r.ss2,r.ss3].map(x=>format(x,6)).join(' + ')} μg/m³；CAMS换算 C=q×ρ×10⁹×Fheight，Fheight=${format(r.backgroundHeightFactor,6)}`]);
  parts.push(['代理公式',`A×(max(U10,0.2)/5)^n×(Hs/2)^m×(S/35)×Fmarine×Ffetch×Fheight；A=${P.proxySaltCoeff}，n=${P.proxyWindExp}，m=${P.localSprayWaveExp}；Fmarine依据上风向海距 ${format(r.upwindSeaDist)} km，Fetch=${format(r.fetchKm)} km`]);
  parts.push(['局地粗颗粒 EST',`A×(max(U10,1)/8)^n×(Hs/1.5)^m×(S/35)×exp(-D/L)×Ffetch×Fheight；A=${P.localSprayCoeff}，n=${P.localSprayWindExp}，m=${P.localSprayWaveExp}，L=${P.localSprayScaleKm} km；结果 ${format(r.spray20,6)} μg/m³`]);
  parts.push(['本小时合计',`${format(r.ss1,6)} + ${format(r.ss2,6)} + ${format(r.ss3,6)} + ${format(r.spray20,6)} = ${format(r.airSalt,6)} μg/m³`]);
  parts.push(['周期统计',`有效小时均值 ${format(s.airSaltMean,6)}；P95 ${format(s.airSaltP95,6)}；P99 ${format(s.airSaltP99,6)} μg/m³，使用完整有效序列。`]);
 }else if(['wave','salinity','so2'].includes(metric)){
  const key={wave:'hs',salinity:'salinity',so2:'so2Dep'}[metric],q=result.quality.find(q=>q.key===key);
  parts.push(['定义',metric==='wave'?'有效波高；周期内有效计算值按实际Δt加权平均，单位m':metric==='salinity'?'盐度；缺测使用35 PSU工程估算，原始值保留null':'SO₂沉降率 Pd=Cso2×v×86.4，单位mg/(m²·d)；浓度由q×ρ×10⁹换算。缺测使用1 mg/(m²·d)工程估算。']);
  parts.push(['本小时',metric==='so2'?`Cso2=${format(r.so2Conc,6)} μg/m³，v=${P.so2DepVelocity} m/s；Pd=${format(r.so2Dep,6)} mg/(m²·d)`:`原始=${String(r.rawInputs[key])}；有效=${String(r.effectiveInputs[key])}；标记=${r.flags[key]}`]);
  parts.push(['周期均值',String(metric==='wave'?s.meanWaveHeight:metric==='salinity'?s.meanSalinity:s.meanSo2Dep)]);parts.push(['数据质量',JSON.stringify(q)]);
 }else if(metric==='clDep'){
  parts.push(['逐粒径干沉降',`Jdry=Σ(Ci×vdi)×86.4×captureFactor；86.4=86400 s/d ÷1000 μg/mg；captureFactor=${P.captureFactor}`]);
  parts.push(['撞击与湿沉降',`Jimp=Σ(Ci×U×η×orientation)×86.4×captureFactor；η=clamp[0.65 Stk/(1+Stk),0,0.75]；Jwet=Σ[Ci×(1-exp(-0.022 rain))×0.65]×captureFactor。湿沉降系数为待校准工程参数。`]);
  parts.push(['本小时各项',`干沉降 ${format(r.dryDep,6)} + 撞击 ${format(r.impactionDep,6)} + 湿沉降 ${format(r.wetDep,6)} = ${format(r.saltDep,6)} mg/(m²·d)`]);
  parts.push(['氯离子换算',`${format(r.saltDep,6)} × ${P.chlorideFraction} = ${format(r.clDep,6)} mg/(m²·d)`]);
  parts.push(['累计与年均',`Σ(JCl×Δt/24)/1000 = ${format(s.cumulativeCl,6)} g/m²；完整年度平均累计量 ${format(s.annualCl,6)} g/(m²·a)。标准湿烛法等效性尚待验证。`]);
 }else if(metric==='surfaceCl'){
  parts.push(['质量平衡',`Snext=Sprev+JCl×Δt/24−wash−resuspension，单位mg/m²`]);
  parts.push(['本小时代入',`${format(r.previousSurfaceCl,6)} + ${format(r.clDep,6)} × ${r.dt}/24 − ${format(r.washed,6)} − ${format(r.resuspended,6)} = ${format(r.surfaceCl,6)}`]);
  parts.push(['冲洗与再悬浮',`冲洗比例=1−[1−${P.washEfficiency}×(1−exp(-0.16 rain))]^Δt；无雨且U>12 m/s时，再悬浮比例=1−[1−clamp((U−12)×0.003,0,0.08)]^Δt`]);
  parts.push(['连续性',s.stateContinuity.rule]);
 }else if(metric==='tow'||metric==='cond'){
  parts.push(['判据',metric==='tow'?'T>0°C 且 RH>80%，按有效Δt累计':'Tsurface≤Tdew；表面温度采用现有简化估算模型，不代表实测壁温']);
  parts.push(['表面温度',`${format(r.t,4)}+0.0018×${format(r.sw,4)}−(1−${format(r.cloud,4)}/100)×1.7/(1+0.28×${format(r.wind,4)}) = ${format(r.ts,4)} °C`]);
  parts.push(['本小时',`T=${format(r.t)} °C，RH=${format(r.rh)}%，Tdew=${format(r.td)} °C；判定=${String(metric==='tow'?r.tow:r.cond)}；Δt=${r.dt} h`]);
  parts.push(['时长',`周期累计 ${format(metric==='tow'?s.towHours:s.condHours,1)} h；仅完整Historical周期可报告年均，Current不标h/a。`]);
 }else if(metric==='corrosion'){
  const formula={carbon_steel:'1.77 Pd^0.52 exp(0.020 RH+fT)+0.102 Sd^0.62 exp(0.033 RH+0.040 T)；fT=T≤10时0.150(T−10)，否则−0.054(T−10)',zinc:'0.0129 Pd^0.44 exp(0.046 RH+fT)+0.0175 Sd^0.57 exp(0.008 RH+0.085 T)；fT=T≤10时0.038(T−10)，否则−0.071(T−10)',copper:'0.0053 Pd^0.26 exp(0.059 RH+fT)+0.01025 Sd^0.27 exp(0.036 RH+0.049 T)；fT=T≤10时0.126(T−10)，否则−0.080(T−10)',aluminium:'0.0042 Pd^0.73 exp(0.025 RH+fT)+0.0018 Sd^0.60 exp(0.020 RH+0.094 T)；fT=T≤10时0.009(T−10)，否则−0.043(T−10)'};
  parts.push(['标准公式',formula[s.material]||'材料不适用']);parts.push(['输入与单位',`Pd=SO₂沉降，Sd=Cl⁻沉降，均为mg/(m²·d)；RH=%；T=°C；输出${s.material==='aluminium'?'g/(m²·a)':'μm/a'}`]);
  for(const a of result.annual)parts.push([String(a.year),`Pd=${format(a.summary.meanSo2Dep,6)}，Sd=${format(a.summary.clDepMean,6)}，RH=${format(a.summary.meanRh,4)}，T=${format(a.summary.meanTemp,4)} → r=${format(a.summary.firstYearCorrosion,6)}；有效覆盖${format(a.summary.coveragePercent)}%`]);
  parts.push(['结果口径',s.corrosionBasis]);parts.push(['两个不同统计量',`逐年估算均值=${format(s.firstYearCorrosion,6)}；多年气候均值代入值=${format(s.climateMeanCorrosion,6)}`]);parts.push(['工程校准',JSON.stringify(s.experienceCalibration)]);
 }else parts.push(['地理依据',JSON.stringify(result.inputData.gis)],['数据格点',JSON.stringify(result.environmentByYear?.map(e=>({year:e.year,weather:e.weather?.grid,ocean:e.ocean?.grid}))) ]);
 parts.push(['本次主要限制',result.qualityAssessment.reasons.join('；')]);parts.push(['变量来源与覆盖',result.quality.map(q=>q.label+'：'+q.source+'；有效'+format(q.validPercent)+'%；估算'+format(q.estimatedPercent)+'%；插值'+format(q.interpolatedPercent)+'%').join('\n')]);return {title:titles[metric]||metric,time:r.time,parts,row:r};
}
export function openTrace(result,metric){
 if(!result)return;const render=time=>{const trace=traceData(result,metric,time),r=trace.row;$('#drawerBody').innerHTML=`<h2>${escapeHtml(trace.title)}</h2><p>${escapeHtml(result.summary.periodLabel)}</p><label class="trace-time">查看计算小时（UTC）<input id="traceHour" type="datetime-local" step="3600" value="${trace.time.slice(0,16)}" min="${result.hourly[0].time.slice(0,16)}" max="${result.hourly.at(-1).time.slice(0,16)}"></label>`+trace.parts.map(([k,v])=>`<h3>${escapeHtml(k)}</h3><p class="trace-value">${escapeHtml(v)}</p>`).join('')+'<h3>原始归一化值与有效输入</h3>'+table(['变量','单位','原始归一化值','实际计算值','处理'],Object.entries(r.rawInputs||{}).map(([k,v])=>[k,result.quality.find(q=>q.key===k)?.unit||'—',number(v)!==null?String(v):'—',number(r.effectiveInputs?.[k])!==null?String(r.effectiveInputs[k]):'—',r.flags?.[k]||'MISSING']))+`<h3>参数快照</h3><pre class="trace-json">${escapeHtml(JSON.stringify(result.inputSnapshot,null,2))}</pre><h3>依据与限制</h3>`+result.references.map(ref=>`<p><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a>：${escapeHtml(ref.scope)}</p>`).join('');$('#traceHour').onchange=e=>{if(result.hourly.some(x=>utcMs(x.time)===utcMs(e.target.value)))render(e.target.value);else e.target.setCustomValidity('该时刻无计算记录，请选择整点UTC时间')}};render();$('#drawer').classList.add('open');
}
export function renderCalibration(model,chart){
 $('#calibrationEvidence').textContent=`原始${CALIBRATION_META.rawRows}行；去重${CALIBRATION_META.independentRows}条，${CALIBRATION_META.uniqueSites}个坐标。高度参考：空气海盐4组、沉降6组唯一配对；1个存在配对歧义的站点已排除。缺少${CALIBRATION_META.missing.join('、')}及测量方法。26点只做参考比对，不用于拟合。`;
 if(!model||model.status!=='fitted'){$('#calibrationStatus').textContent=model?.reason||'当前局地腐蚀校准未应用；没有满足同期元数据条件的校核记录。';$('#calibrationMetrics').innerHTML='';$('#calibrationScatter').textContent='导入合格同期记录并完成站点留出后显示校准前后对比。';$('#calibrationResidual').textContent='尚无可报告的独立验证残差。';return}
 const grade=rows=>{const a=rows.filter(p=>number(p.observed)!==null);return a.length?100*a.filter(p=>corrosionClass('carbon_steel',p.observed)===corrosionClass('carbon_steel',p.predicted)).length/a.length:null};
 $('#calibrationStatus').textContent=`已拟合局地修正因子 ${format(model.factor,4)}；训练区域${model.trainingGroups.length}个，留出区域${model.validationGroups.length}个。${model.scope}。下列统计为留出区域的参数迁移比对，不表示任意地点均可应用。`;
 $('#calibrationMetrics').innerHTML=table(['留出样本','有效点','MAE / μm/a','RMSE / μm/a','MAPE','R²','等级命中'],[['校准前',model.metricsBefore.n,format(model.metricsBefore.mae),format(model.metricsBefore.rmse),format(model.metricsBefore.mape)+'%',format(model.metricsBefore.r2,3),format(grade(model.validation.map(p=>({observed:p.observed,predicted:p.before}))))+'%'],['校准后',model.metricsAfter.n,format(model.metricsAfter.mae),format(model.metricsAfter.rmse),format(model.metricsAfter.mape)+'%',format(model.metricsAfter.r2,3),format(grade(model.validation.map(p=>({observed:p.observed,predicted:p.after}))))+'%']]);
 $('#calibrationScatter').textContent='';$('#calibrationResidual').textContent='';chart('calibrationScatter',{tooltip:{trigger:'item'},legend:{data:['校准前','校准后']},xAxis:{type:'value',name:'实测 μm/a'},yAxis:{type:'value',name:'估算 μm/a'},series:['before','after'].map((k,i)=>({name:i?'校准后':'校准前',type:'scatter',data:model.validation.map(p=>[p.observed,p[k]])}))});
 const errors=model.validation.flatMap(p=>[p.before-p.observed,p.after-p.observed]),lo=Math.min(...errors),hi=Math.max(...errors),width=(hi-lo||1)/8,labels=Array.from({length:8},(_,i)=>format(lo+i*width)+'～'+format(lo+(i+1)*width));chart('calibrationResidual',{tooltip:{trigger:'axis'},legend:{data:['校准前','校准后']},xAxis:{type:'category',data:labels,axisLabel:{rotate:30}},yAxis:{type:'value',name:'站点数'},series:['before','after'].map((k,i)=>({name:i?'校准后':'校准前',type:'bar',data:labels.map((_,j)=>model.validation.filter(p=>Math.min(7,Math.floor((p[k]-p.observed-lo)/width))===j).length)}))});
}
