import {number,utcMs} from './data-quality.js';
import {corrosionClass} from './model-v330.js';
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
export const format=(v,d=1)=>number(v)===null?'—':Number(v).toFixed(d);
const $=s=>document.querySelector(s);
function table(headers,rows){return '<div class="table-scroll"><table class="table"><thead><tr>'+headers.map(x=>'<th>'+escapeHtml(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+escapeHtml(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}

export function renderQuality(result){
 if(!result)return;const a=result.qualityAssessment,s=result.summary;
 $('#qualityOverview').textContent=`V3.3.0 输入数据质量：${a.inputGrade}。${a.rules[a.inputGrade]}。模型验证：${a.modelEvidence}。${a.reasons.join('；')}。`;
 $('#qualityTable').innerHTML=table(['变量 / 单位','实际数据来源','有效覆盖','缺测','计算有效','插值','估算','人工覆盖'],result.quality.map(q=>[q.label+' / '+q.unit,q.source,format(q.sourceCoveragePercent)+'%',format(q.originalMissingPercent)+'%',format(q.validPercent)+'%',format(q.interpolatedPercent)+'%',format(q.estimatedPercent)+'%',format(q.overridePercent)+'%']));
 const grids=[];for(const env of result.environmentByYear||[])for(const key of ['weather','cams','ocean']){const p=env[key];for(const g of [p?.grid,...(p?.grids||[])].filter(Boolean))grids.push([env.year||'Current',key,g.selection||'上游未说明',g.actual?.latitude??'未提供',g.actual?.longitude??'未提供',format(g.distanceKm,2)])}
 $('#gridDetails').innerHTML=grids.length?table(['年份','来源','海陆选格','数据格点纬度','数据格点经度','距项目点 / km'],grids):'<p>上游未提供实际格点坐标，不把项目坐标冒充数据格点。</p>';
 $('#periodDetails').textContent=`统计周期：${s.periodLabel}。预期 ${s.expectedHours} h；有效 ${format(s.hours,1)} h（${format(s.coveragePercent)}%）。V3.3.0正式ISO值仅在Pd与ISO等效Sd均可追溯时输出。${s.stateContinuity.rule}`;
}

export function renderServices(health,result){
 const labels={era5:'ERA5 Direct',cams:'CAMS Direct',cmems:'CMEMS Direct'},rows=[],names={valid_data:'有效数据',partial_data:'部分有效数据',fallback_or_missing:'替代数据 / 估算',pending:'上游任务准备中'};
 if(result?.environmentByYear?.length){for(const env of result.environmentByYear)for(const [key,s] of Object.entries(env.services))rows.push([env.year||'Current',labels[key],names[s.status]||s.status,s.source,format(s.coveragePercent)+'%',s.first&&s.last?s.first+' ～ '+s.last:'无有效覆盖',s.lastSuccess||'暂无成功记录',s.error?`${s.error.code}：${s.error.message}`:'—'])}
 else for(const key of Object.keys(labels))rows.push(['—',labels[key],health?.reachable?(health.services?.[key]?.configured?'已配置，尚未验证本次数据':'未配置 / 未确认'):'不可达','尚未计算','—','—','—',health?.message||'等待检查']);
 const html=table(['年度','服务','本次状态','实际采用来源','Direct有效覆盖','Direct覆盖时间','最近成功时间','原因'],rows);
 for(const id of ['sourceTable','directDataStatus','oceanStatus'])if($('#'+id))$('#'+id).innerHTML=html;
 if($('#sourceText'))$('#sourceText').textContent=health?.reachable?'Direct健康检查已返回；是否有本次有效数据见下表':(health?.message||'正在检查Direct');if($('#sourceDot'))$('#sourceDot').className='dot '+(health?.reachable?'ok':'warn');
 if($('#serviceHealth'))$('#serviceHealth').textContent=`健康检查：${health?.checkedAt||'等待'}。V3.3.0严格区分Direct、Fallback、Proxy与MISSING。`;
}

const titles={wave:'有效波高',salinity:'盐度',so2:'SO₂ / ISO Pd',airSalt:'空气海盐浓度',clDep:'工程Cl⁻与ISO Sd',surfaceCl:'表面Cl⁻库存',tow:'ISO气象湿润时长',cond:'凝露时长',corrosion:'ISO 9223首年腐蚀',gis:'GIS与数据格点'};
export function traceData(result,metric,time=null){
 const r=(time?result.hourly.find(x=>utcMs(x.time)===utcMs(time)):result.hourly.find(x=>x.valid))||result.hourly[0],s=result.summary,P=result.inputSnapshot.cfg,parts=[];
 if(!r?.valid)return {title:titles[metric]||metric,time:r?.time||result.hourly[0]?.time,parts:[['状态',r?.reason||'无有效小时']],row:r||{}};
 if(metric==='airSalt'){
  parts.push(['空气密度',`${format(r.p,3)}×100/[287.05×(${format(r.t,3)}+273.15)] = ${format(r.rho,6)} kg/m³`]);
  parts.push(['CAMS RH80质量基准',`有效CAMS Bin ${r.camsBinCount}/3。CAMS Bin按 q80÷${P.camsDryMassFactor}×ρ×10⁹×Fheight 转为干盐质量；缺失Bin单独用Proxy补齐。`]);
  parts.push(['粒径湿度基准','CAMS代表粒径按RH80定义，进入沉降前使用 d(RH)=d80×GF(RH)/GF(80)，避免把RH80粒径再次完整吸湿增长。']);
  parts.push(['Proxy',`K×FU×FHs×FS×Fdistance×Ffetch×Fheight；D=${format(r.upwindSeaDist)} km，Fdistance=${format(r.distanceFactor,5)}，Fetch=${format(r.fetchKm)} km，Ffetch=${format(r.fetchFactor,5)}。Fetch仅作用一次。`]);
  parts.push(['Local Spray',`35 μm与75 μm分别使用衰减尺度 ${P.localSprayScale35Km} km / ${P.localSprayScale75Km} km；二者均为待校准CONFIG。粗颗粒合计=${format(r.spray20,6)} μg/m³。`]);
  parts.push(['本小时合计',`${format(r.ss1,6)} + ${format(r.ss2,6)} + ${format(r.ss3,6)} + ${format(r.spray20,6)} = ${format(r.airSalt,6)} μg/m³`]);
 }else if(metric==='so2'){
  parts.push(['SO₂浓度',`Cso₂=q×ρ×10⁹ = ${format(r.so2Conc,6)} μg/m³。SO₂缺失时保持MISSING，不再自动令Pd=1。`]);
  parts.push(['ISO 9223接口',`Pd,ISO=${P.isoSo2ConcentrationFactor}×Pc = ${format(r.isoSo2Dep,6)} mg/(m²·d)，或使用明确实测Override。`]);
  parts.push(['物理沉降（诊断）',`Cso₂×${P.so2DepVelocity} m/s×86.4 = ${format(r.physicalSo2Dep,6)} mg/(m²·d)。该值与ISO等效Pd分列，不混用。`]);
  parts.push(['周期均值',`Pd,ISO=${format(s.meanSo2Dep,6)}；Cso₂=${format(s.meanSo2Conc,6)} μg/m³。`]);
 }else if(metric==='clDep'){
  parts.push(['Dry',`Jdry=Σ(Ci×vdi)×86.4×captureFactor = ${format(r.dryDep,6)} mg/(m²·d)`]);
  parts.push(['Impaction',`Jimp=Σ(Ci×U×η×orientation)×86.4×captureFactor = ${format(r.impactionDep,6)} mg/(m²·d)`]);
  parts.push(['Wet V3.3',r.wetDepAvailable?`量纲闭合Wet已启用：C×Heff×[1-exp(-ΛΔt)]，本小时=${format(r.wetDep,6)} mg/(m²·d)`:'Wet参数未完成校准；降雨Wet项不使用旧量纲不闭合公式，也不并入总沉降。']);
  parts.push(['工程Cl⁻',`Jsalt=${format(r.saltDep,6)} × chlorideFraction ${P.chlorideFraction} → JCl,equipment=${format(r.clDep,6)} mg/(m²·d)`]);
  parts.push(['ISO Sd',`Sd,ISO=${format(r.isoClDep,6)} mg/(m²·d)。默认必须来自ISO 9225等效实测Override或经验证转换系数；JCl,equipment不能自动当作Sd。`]);
 }else if(metric==='surfaceCl'){
  parts.push(['质量平衡',`Snext=Sprev+JCl×Δt/24−wash−resuspension；${format(r.previousSurfaceCl,6)} + ${format(r.clDep,6)}×${r.dt}/24 − ${format(r.washed,6)} − ${format(r.resuspended,6)} = ${format(r.surfaceCl,6)} mg/m²`]);
  parts.push(['用途','Surface-Cl是设备表面工程状态量，不等于ISO 9225湿烛Sd。']);
 }else if(metric==='tow'||metric==='cond'){
  parts.push(['判据',metric==='tow'?'T>0°C 且 RH>80%，按实际Δt累计':'Tsurface≤Tdew；Tsurface仍是简化工程估算，并非实测壁温']);
  parts.push(['本小时',`T=${format(r.t)} °C，RH=${format(r.rh)}%，Tdew=${format(r.td)} °C，Tsurface=${format(r.ts)} °C，判定=${String(metric==='tow'?r.tow:r.cond)}`]);
 }else if(metric==='corrosion'){
  parts.push(['正式ISO输入',`Pd=${format(s.meanSo2Dep,6)} mg/(m²·d)；Sd=${format(s.isoClDepMean,6)} mg/(m²·d)；RH=${format(s.meanRh,3)}%；T=${format(s.meanTemp,3)}°C。`]);
  parts.push(['正式ISO结果',Number.isFinite(s.isoFirstYearCorrosion)?`r=${format(s.isoFirstYearCorrosion,6)}；${s.isoCorrosionClass}`:'未输出：SO₂标准输入或ISO 9225等效Sd不完整。']);
  parts.push(['工程Screening',Number.isFinite(s.screeningFirstYearCorrosion)?`使用工程Cl⁻而非ISO等效Sd，仅用于筛查：${format(s.screeningFirstYearCorrosion,6)}；${s.screeningCorrosionClass}`:'Screening输入也不完整。']);
  parts.push(['校准状态','V3.3.0科学接口已变化，V3.2.8腐蚀残差校准禁止沿用；Vietnam 46.4与26点只作为诊断/参考，不能反向拟合。']);
 }else if(metric==='wave'||metric==='salinity'){
  const key=metric==='wave'?'hs':'salinity';parts.push(['本小时',`原始=${String(r.rawInputs?.[key])}；有效=${String(r.effectiveInputs?.[key])}；标记=${r.flags?.[key]||'—'}`]);parts.push(['周期',metric==='wave'?`平均Hs=${format(s.meanWaveHeight,5)} m`:`平均盐度=${format(s.meanSalinity,5)} PSU`]);
 }else{
  parts.push(['GIS',JSON.stringify(result.inputData.gis)]);parts.push(['V3.3方向处理',`模型按实际WD在5°或Direct bearing bins之间插值；本小时D_upwind=${format(r.upwindSeaDist,3)} km，Fetch=${format(r.fetchKm,3)} km，方向离散度=${format(r.directionalSpreadKm,3)} km。复杂海岸需GSHHG Direct。`]);
 }
 parts.push(['本次主要限制',result.qualityAssessment.reasons.join('；')]);
 parts.push(['变量来源与覆盖',result.quality.map(q=>q.label+'：'+q.source+'；有效'+format(q.validPercent)+'%；估算'+format(q.estimatedPercent)+'%').join('\n')]);
 return {title:titles[metric]||metric,time:r.time,parts,row:r};
}

export function openTrace(result,metric){
 if(!result)return;const render=time=>{const trace=traceData(result,metric,time),r=trace.row;$('#drawerBody').innerHTML=`<h2>${escapeHtml(trace.title)}</h2><p>V3.3.0 · ${escapeHtml(result.summary.periodLabel)}</p><label class="trace-time">查看计算小时（UTC）<input id="traceHour" type="datetime-local" step="3600" value="${trace.time?.slice(0,16)||''}" min="${result.hourly[0].time.slice(0,16)}" max="${result.hourly.at(-1).time.slice(0,16)}"></label>`+trace.parts.map(([k,v])=>`<h3>${escapeHtml(k)}</h3><p class="trace-value">${escapeHtml(v)}</p>`).join('')+'<h3>原始归一化值与有效输入</h3>'+table(['变量','单位','原始归一化值','实际计算值','处理'],Object.entries(r.rawInputs||{}).map(([k,v])=>[k,result.quality.find(q=>q.key===k)?.unit||'—',number(v)!==null?String(v):'—',number(r.effectiveInputs?.[k])!==null?String(r.effectiveInputs[k]):'—',r.flags?.[k]||'MISSING']))+`<h3>参数快照</h3><pre class="trace-json">${escapeHtml(JSON.stringify(result.inputSnapshot,null,2))}</pre><h3>依据与限制</h3>`+(result.references||[]).map(ref=>`<p><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a>：${escapeHtml(ref.scope)}</p>`).join('');if($('#traceHour'))$('#traceHour').onchange=e=>{if(result.hourly.some(x=>utcMs(x.time)===utcMs(e.target.value)))render(e.target.value);else e.target.setCustomValidity('该时刻无计算记录，请选择整点UTC时间')}};render();$('#drawer').classList.add('open');
}

export function renderCalibration(model,chart){
 if($('#calibrationEvidence'))$('#calibrationEvidence').textContent='V3.3.0改变了CAMS RH80基准、SO₂标准接口和Cl⁻标准等效接口，因此V3.2.8腐蚀残差校准全部失效。只有准确起止日期、单位、材料、区带、测量方法、同期预测完整的记录才允许重建训练/留出验证。';
 if($('#calibrationStatus'))$('#calibrationStatus').textContent='V3.3.0生产局地腐蚀校准：DISABLED / recalibration required。Vietnam 10.9,106.6 / 46.4及26点不参与拟合。';
 if($('#calibrationMetrics'))$('#calibrationMetrics').innerHTML='';
 if($('#calibrationScatter'))$('#calibrationScatter').textContent='等待V3.3.0同期合格数据后重新建立训练区域与独立留出区域。';
 if($('#calibrationResidual'))$('#calibrationResidual').textContent='尚无V3.3.0可报告的独立验证残差。';
}
