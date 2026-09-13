import {DEFAULTS,doseResponse,corrosionClass} from './model-v330.js';

export const APP_VERSION='3.3.1';
export const SCIENCE_MODEL_VERSION='3.3.0';
export const INPUT_STORAGE_KEY='marineV331Inputs';
export const APPLIED_HASH_KEY='marineV331AppliedHash';

const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const bool=v=>v===true||v==='true'||v===1||v==='1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function normalizeV331Inputs(raw={}){
  const mode=['auto','pc','pd'].includes(raw.so2Mode)?raw.so2Mode:'auto';
  return {
    so2Mode:mode,
    so2Pc:num(raw.so2Pc),
    so2Pd:num(raw.so2Pd),
    isoSd:num(raw.isoSd),
    gisEnabled:bool(raw.gisEnabled),
    gisDistanceToCoastKm:num(raw.gisDistanceToCoastKm),
    gisUpwindSeaDistanceKm:num(raw.gisUpwindSeaDistanceKm),
    gisFetchKm:num(raw.gisFetchKm),
    wetEnabled:bool(raw.wetEnabled),
    wetRatePerMm:num(raw.wetRatePerMm),
    wetHeightM:num(raw.wetHeightM)
  };
}

export function validateV331Inputs(raw={}){
  const x=normalizeV331Inputs(raw),errors=[];
  const inRange=(v,a,b)=>v===null||(v>=a&&v<=b);
  if(x.so2Mode==='pc'&&!inRange(x.so2Pc,0,2000))errors.push('SO₂ Pc需为0～2000 μg/m³');
  if(x.so2Mode==='pc'&&x.so2Pc===null)errors.push('已选择SO₂ Pc人工输入，请填写浓度');
  if(x.so2Mode==='pd'&&!inRange(x.so2Pd,0,1000))errors.push('SO₂ Pd需为0～1000 mg/(m²·d)');
  if(x.so2Mode==='pd'&&x.so2Pd===null)errors.push('已选择SO₂ Pd人工输入，请填写沉降率');
  if(!inRange(x.isoSd,0,5000))errors.push('ISO 9225 Sd需为0～5000 mg/(m²·d)');
  if(x.gisEnabled){
    if(!inRange(x.gisUpwindSeaDistanceKm,0,2000)||x.gisUpwindSeaDistanceKm===null)errors.push('GIS上风向海距需为0～2000 km');
    if(!inRange(x.gisFetchKm,0,2000)||x.gisFetchKm===null)errors.push('GIS有效Fetch需为0～2000 km');
    if(!inRange(x.gisDistanceToCoastKm,0,2000))errors.push('GIS最近距海需为0～2000 km');
  }
  if(x.wetEnabled){
    if(!inRange(x.wetRatePerMm,1e-8,100)||x.wetRatePerMm===null)errors.push('Wet清除系数需为1e-8～100 mm⁻¹');
    if(!inRange(x.wetHeightM,.1,10000)||x.wetHeightM===null)errors.push('Wet有效气柱高度需为0.1～10000 m');
  }
  return {inputs:x,errors,valid:errors.length===0};
}

export function deriveManagedOverrides(raw,current={}){
  const x=normalizeV331Inputs(raw),next={...current};
  delete next.so2Dep;delete next.isoChlorideDep;
  if(x.so2Mode==='pc'&&x.so2Pc!==null)next.so2Dep=x.so2Pc*(DEFAULTS.isoSo2ConcentrationFactor??0.8);
  if(x.so2Mode==='pd'&&x.so2Pd!==null)next.so2Dep=x.so2Pd;
  if(x.isoSd!==null)next.isoChlorideDep=x.isoSd;
  return next;
}

export function deriveManagedModelParams(raw,current={}){
  const x=normalizeV331Inputs(raw),next={...current};
  delete next.wetScavengingRatePerMm;delete next.wetScavengingHeightM;
  if(x.wetEnabled){next.wetScavengingRatePerMm=x.wetRatePerMm;next.wetScavengingHeightM=x.wetHeightM;}
  return next;
}

export function applyManualGisOverride(base,raw={}){
  const x=normalizeV331Inputs(raw);
  if(!x.gisEnabled||x.gisUpwindSeaDistanceKm===null||x.gisFetchKm===null)return base;
  const bins=[...Array(72)].map((_,i)=>({bearing:i*5,seaDistanceKm:x.gisUpwindSeaDistanceKm,fetchKm:x.gisFetchKm,directionalSpreadKm:0,fetchSpreadKm:0,manualOverride:true}));
  return {
    ...(base||{}),
    distanceToCoastKm:x.gisDistanceToCoastKm??base?.distanceToCoastKm??x.gisUpwindSeaDistanceKm,
    bearingBins:bins,
    gisUncertainty:{...(base?.gisUncertainty||{}),manualOverride:true,bearingResolutionDeg:5,complexCoast:false,note:'V3.3.1固定上风向海距/Fetch人工覆盖，仅用于工程Screening；正式复杂海岸仍需GSHHG Direct复核。'},
    provenance:{...(base?.provenance||{}),type:'OVERRIDE/SCREENING',source:'V3.3.1 manual GIS override',confidence:'C',note:'人工固定上风向海距与Fetch应用到全部风向，仅用于工程筛查；不可替代GSHHG高分辨率GIS。'}
  };
}

export function screeningCorrosion({material='carbon_steel',pd,engineeringCl,rh,t}={}){
  const values=[pd,engineeringCl,rh,t].map(num);
  if(values.some(v=>v===null))return {ready:false,rate:null,corrosionClass:'N/A'};
  const rate=doseResponse(material,values[0],values[1],values[2],values[3]);
  return {ready:Number.isFinite(rate),rate,corrosionClass:corrosionClass(material,rate),basis:'ENGINEERING_SCREENING',warning:'工程Cl⁻沉降直接用于相对腐蚀筛查；不是ISO 9225湿烛等效Sd，不能标记为正式ISO 9223结果。'};
}

export function inputReadiness(raw={}){
  const x=normalizeV331Inputs(raw);
  const manualPd=x.so2Mode==='pc'&&x.so2Pc!==null?x.so2Pc*(DEFAULTS.isoSo2ConcentrationFactor??0.8):x.so2Mode==='pd'?x.so2Pd:null;
  return {
    environmentScreening:true,
    manualPd,
    corrosionScreeningManualReady:manualPd!==null,
    formalIsoManualReady:manualPd!==null&&x.isoSd!==null,
    wetConfigured:x.wetEnabled&&x.wetRatePerMm!==null&&x.wetHeightM!==null,
    gisManual:x.gisEnabled
  };
}

export function stableInputHash(raw={}){
  const x=normalizeV331Inputs(raw);
  return JSON.stringify(x,Object.keys(x).sort());
}

export function sourceBadge(type){
  const t=String(type||'').toUpperCase();
  if(t.includes('OVERRIDE'))return 'OVERRIDE';
  if(t.includes('RAW')||t.includes('DATA'))return 'DATA';
  if(t.includes('CALC'))return 'CALC';
  return 'EST';
}
