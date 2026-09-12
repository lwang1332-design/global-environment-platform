import {number,distanceKm} from './data-quality.js';
export const CALIBRATION_META={version:'3.2.8',source:'corrosionCalcData.csv',rawRows:641,independentRows:121,uniqueSites:110,status:'reference_only',missing:['准确测量起止日期','原始字段单位及测量方法','材料','暴露区带'],derivedParameters:{airSaltHeightDecayPerM:0.0023260094673319444,settlementHeightDecayPerM:0.0039938428329617005,airPairs:4,settlementPairs:6},note:'高度比值属于探索性参数证据；局地腐蚀率尚未完成同期独立验证。'};
export function heightCalibrationFactors(height,enabled=true){const h=Math.max(0,Number(height)-10),p=CALIBRATION_META.derivedParameters;return {background:enabled?Math.exp(-p.airSaltHeightDecayPerM*h):1,localSpray:enabled?Math.exp(-p.settlementHeightDecayPerM*h):1,evidence:'reference-derived; not independently validated'}}
export function validationMetrics(pairs){
  const a=pairs.filter(p=>number(p.observed)!==null&&number(p.predicted)!==null),n=a.length;if(!n)return {n:0,mae:null,rmse:null,mape:null,r2:null,bias:null};
  const avg=a.reduce((s,p)=>s+p.observed,0)/n,ss=a.reduce((s,p)=>s+(p.observed-avg)**2,0),positive=a.filter(p=>p.observed>0);
  return {n,mae:a.reduce((s,p)=>s+Math.abs(p.predicted-p.observed),0)/n,rmse:Math.sqrt(a.reduce((s,p)=>s+(p.predicted-p.observed)**2,0)/n),bias:a.reduce((s,p)=>s+p.predicted-p.observed,0)/n,mape:positive.length?100*positive.reduce((s,p)=>s+Math.abs(p.predicted-p.observed)/p.observed,0)/positive.length:null,mapeN:positive.length,r2:n>1&&ss>0?1-a.reduce((s,p)=>s+(p.predicted-p.observed)**2,0)/ss:null};
}
export function eligiblePair(p){
  return p?.metadataVerified===true&&p.material==='carbon_steel'&&p.exposureZone==='atmospheric'&&p.unit==='μm/a'&&p.measurementMethod&&p.sourceId&&number(p.height)!==null&&p.height>=2&&p.height<=150&&number(p.latitude)!==null&&Math.abs(p.latitude)<=90&&number(p.longitude)!==null&&Math.abs(p.longitude)<=180&&p.startDate&&p.endDate&&Date.parse(p.endDate)>Date.parse(p.startDate)&&p.startDate===p.predictionStartDate&&p.endDate===p.predictionEndDate&&p.modelVersion==='3.2.8'&&number(p.observed)>0&&number(p.rawPrediction)>0&&p.dataset!=='benchmark26';
}
export function siteGroup(p){return `${Math.floor(p.latitude)}:${Math.floor(p.longitude)}`}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function buildCalibration(records){
  const usable=records.filter(eligiblePair).map(p=>({...p,latitude:Number(p.latitude),longitude:Number(p.longitude),height:Number(p.height),observed:Number(p.observed),rawPrediction:Number(p.rawPrediction)})),unique=new Map();for(const p of usable){const key=[p.latitude,p.longitude,p.height,p.startDate,p.endDate,p.material,p.exposureZone].join('|');if(!unique.has(key))unique.set(key,{...p,group:siteGroup(p)})}
  const groups=[...new Set([...unique.values()].map(p=>p.group))].sort((a,b)=>hash(a)-hash(b)||a.localeCompare(b));
  if(groups.length<4)return {applied:false,status:'insufficient_metadata_or_sites',eligible:unique.size,groups:groups.length,requiredGroups:4,reason:'至少需要4个互不重叠的1°站点区域及完整同期元数据'};
  const held=new Set(groups.slice(0,Math.max(1,Math.floor(groups.length*.25)))),training=[...unique.values()].filter(p=>!held.has(p.group)),validation=[...unique.values()].filter(p=>held.has(p.group));
  const ratios=training.map(p=>Math.log(p.observed/p.rawPrediction)).sort((a,b)=>a-b),mid=(ratios.length-1)/2,k=Math.exp((ratios[Math.floor(mid)]+ratios[Math.ceil(mid)])/2);
  const before=validation.map(p=>({observed:p.observed,predicted:p.rawPrediction})),after=validation.map(p=>({observed:p.observed,predicted:p.rawPrediction*k}));
  return {applied:false,status:'fitted',version:'3.2.8',method:'训练区域对数残差中位数；独立1°区域留出，验证集不参与拟合',factor:k,trainingGroups:groups.filter(g=>!held.has(g)),validationGroups:[...held],training,validation:validation.map((p,i)=>({...p,before:before[i].predicted,after:after[i].predicted})),metricsBefore:validationMetrics(before),metricsAfter:validationMetrics(after),scope:'仅碳钢大气区、距训练站10 km内、设备高度相差不超过10 m；不用于26点Benchmark',createdAt:new Date().toISOString()};
}
export function localExperienceCalibration({latitude,longitude,height,rawCorrosion,material='carbon_steel',exposureZone='atmospheric',mode='historical',validationMode=false},model=null){
  if(validationMode||mode!=='historical'||material!=='carbon_steel'||exposureZone!=='atmospheric')return {applied:false,reason:'outside_scope'};
  if(!model||model.status!=='fitted'||model.version!=='3.2.8')return {applied:false,reason:'measurement_metadata_missing',note:CALIBRATION_META.note};
  if(model.validationGroups.includes(siteGroup({latitude,longitude})))return {applied:false,reason:'held_out_region_not_used_for_production_calibration'};
  const nearest=model.training.map(p=>({...p,distance:distanceKm(latitude,longitude,p.latitude,p.longitude)})).filter(p=>p.distance<=10&&Math.abs(p.height-height)<=10).sort((a,b)=>a.distance-b.distance)[0];
  if(!nearest||number(rawCorrosion)===null)return {applied:false,reason:'outside_training_station_support'};
  return {applied:true,calibratedCorrosion:rawCorrosion*model.factor,factor:model.factor,sourceId:nearest.sourceId,distanceKm:nearest.distance,heightDifferenceM:Math.abs(nearest.height-height),method:model.method,validation:model.metricsAfter,note:'局地经验修正值另列；ISO公式原值保留，不代表标准试片实测值。'};
}
