import {clamp,settlingVelocity,camsAmbientDiameter,proxyAmbientDiameter} from './model-v330.js';

export const ISO_SD_LAYER_VERSION='3.4.0';
export const ISO_SD_STANDARD='ISO 9225:2012';
export const WET_CANDLE={diameterM:0.025,exposedAreaM2:0.01,exposedLengthM:0.12,orientationFactor:1/Math.PI,rainProtected:true};
const RHO_P=2160, MU=1.81e-5;
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const FLUX_GROUPS={dry:['ssDry1','ssDry2','ssDry3'],sed:['ssSed1','ssSed2','ssSed3'],wetConv:['ssWetConv1','ssWetConv2','ssWetConv3'],wetLs:['ssWetLs1','ssWetLs2','ssWetLs3']};

export function normalizeSdSettings(raw={}){
  const method=['auto_model','wet_candle_direct','standard_converted'].includes(raw.method)?raw.method:'auto_model';
  const direct=finite(raw.directSd),converted=finite(raw.convertedSd);
  return {method,directSd:direct,convertedSd:converted,source:String(raw.source||''),measurementHeightM:finite(raw.measurementHeightM),periodDays:finite(raw.periodDays)};
}

function splitSpray(row,cfg){
  const total=Math.max(0,finite(row.spray20)??0),d=Math.max(0,finite(row.upwindSeaDist)??0);
  const l35=Math.max(.1,finite(cfg.localSprayScale35Km)??12),l75=Math.max(.1,finite(cfg.localSprayScale75Km)??6);
  const a=.68*Math.exp(-d/l35),b=.32*Math.exp(-d/l75),sum=a+b;
  return sum>0?[total*a/sum,total*b/sum]:[total*.68,total*.32];
}

export function camsBulkDrySaltFluxMgM2Day(result,index){
  const cams=result?.inputData?.cams||{},cfg=result?.inputSnapshot?.cfg||{},factor=Math.max(1,finite(cfg.camsDryMassFactor)??4.3);
  const sums={};
  for(const [group,keys] of Object.entries(FLUX_GROUPS)){
    const vals=keys.map(k=>finite(cams?.[k]?.[index]));
    if(vals.some(v=>v===null))return null;
    sums[group]=vals.reduce((s,v)=>s+v,0)*86400*1e6/factor;
  }
  return {...sums,total:sums.dry+sums.sed+sums.wetConv+sums.wetLs,unit:'mg/(m²·d) dry sea salt',massConversionFactor:factor};
}

export function camsFluxEquivalentSd(result){
  const rows=result?.hourly||[],cfg=result?.inputSnapshot?.cfg||{},chlorideFraction=finite(cfg.chlorideFraction)??.55;
  let weighted=0,hours=0,validHours=0,dry=0,sed=0,wet=0;
  for(let i=0;i<rows.length;i++){
    const r=rows[i];if(!r?.valid||!Number(r.dt))continue;validHours+=Number(r.dt);
    const f=camsBulkDrySaltFluxMgM2Day(result,i);if(!f)continue;
    const dt=Number(r.dt),cl=f.total*chlorideFraction;weighted+=cl*dt;hours+=dt;dry+=f.dry*chlorideFraction*dt;sed+=f.sed*chlorideFraction*dt;wet+=(f.wetConv+f.wetLs)*chlorideFraction*dt;
  }
  const coverage=validHours?hours/validHours:0;
  return {ready:hours>0,sd:hours?weighted/hours:null,coveragePercent:100*coverage,dryCl:hours?dry/hours:null,sedimentationCl:hours?sed/hours:null,wetCl:hours?wet/hours:null,source:result?.inputData?.cams?.autoSeaSaltFlux?.source||null,productType:result?.inputData?.cams?.autoSeaSaltFlux?.productType||null,note:'CAMS dry + sedimentation + convective wet + large-scale wet sea-salt flux converted to dry sea salt (/4.3) then Cl⁻ fraction; this is an engineering deposition envelope, not an ISO 9225 field measurement.'};
}

export function virtualWetCandleSd(result,options={}){
  const rows=(result?.hourly||[]).filter(r=>r?.valid&&Number(r.dt)>0),cfg=result?.inputSnapshot?.cfg||{};
  if(!rows.length)return {ready:false,sd:null,method:'MODEL_WET_CANDLE',formalIso:false,confidence:'D',reason:'无有效小时数据'};
  const chlorideFraction=finite(options.chlorideFraction)??finite(cfg.chlorideFraction)??.55;
  const L=finite(options.collectorDiameterM)??WET_CANDLE.diameterM;
  const orientation=finite(options.orientationFactor)??WET_CANDLE.orientationFactor;
  const perHour=[];
  for(const r of rows){
    const rh=finite(r.rh)??80,u=Math.max(.1,finite(r.wind)??finite(r.u10)??.1),[spray35,spray75]=splitSpray(r,cfg);
    const c=[finite(r.ss1)??0,finite(r.ss2)??0,finite(r.ss3)??0,spray35,spray75];
    const directBins=Number(r.camsBinCount)>=3;
    const d=[0,1,2].map(j=>directBins?camsAmbientDiameter(j,rh,finite(cfg.kappa)??1.1):proxyAmbientDiameter(j,rh,finite(cfg.kappa)??1.1,finite(cfg.camsRadiusRatio80ToDry)??2));
    d.push(35,75);
    let saltFlux=0;
    for(let j=0;j<c.length;j++){
      const diam=Math.max(.01,d[j]||.01),vTurb=.00018+.00006*u;
      const stk=RHO_P*(diam*1e-6)**2*u/(18*MU*Math.max(L,.005));
      const eta=clamp(.65*stk/(1+stk),0,.9);
      const flux=c[j]*(vTurb+u*eta*orientation)*86.4;
      saltFlux+=flux;
    }
    perHour.push({dt:Number(r.dt),sd:saltFlux*chlorideFraction,direct:directBins});
  }
  const h=perHour.reduce((s,r)=>s+r.dt,0),collectorSd=h?perHour.reduce((s,r)=>s+r.sd*r.dt,0)/h:null,directH=perHour.filter(r=>r.direct).reduce((s,r)=>s+r.dt,0);
  const directShare=h?directH/h:0,bulk=camsFluxEquivalentSd(result),mode=result?.project?.mode||result?.summary?.mode||'historical';
  const fluxUsable=bulk.ready&&(mode==='current'||bulk.coveragePercent>=90),sd=fluxUsable?Math.max(collectorSd??0,bulk.sd??0):collectorSd;
  const driver=fluxUsable&&Number.isFinite(bulk.sd)&&bulk.sd>(collectorSd??-Infinity)?'CAMS_BULK_FLUX':'VIRTUAL_WET_CANDLE';
  return {ready:Number.isFinite(sd),sd,method:fluxUsable?'MODEL_WET_CANDLE_CAMS_FLUX_ENVELOPE':'MODEL_WET_CANDLE',standard:ISO_SD_STANDARD,formalIso:false,traceability:fluxUsable?'MODEL_EQUIVALENT+CAMS_FLUX':'MODEL_EQUIVALENT',confidence:directShare>.9&&(!bulk.ready||bulk.coveragePercent>=90)?'C':'D',coveragePercent:100,directSeaSaltSharePercent:directShare*100,collectorModelSd:collectorSd,camsBulkFluxSd:bulk.sd,camsFluxCoveragePercent:bulk.coveragePercent,camsFluxComponents:{dryCl:bulk.dryCl,sedimentationCl:bulk.sedimentationCl,wetCl:bulk.wetCl},envelopeDriver:driver,collector:{...WET_CANDLE,diameterM:L,orientationFactor:orientation},fluxEvidence:bulk,note:'Model-equivalent Sd uses a conservative envelope: virtual wet-candle aerosol capture versus CAMS direct dry+sedimentation+wet deposition Cl⁻ flux. It never uses corrosion observations to tune a multiplier and cannot be presented as an ISO 9225 field measurement.'};
}

export function establishIsoSd(result,rawSettings={}){
  const s=normalizeSdSettings(rawSettings),model=virtualWetCandleSd(result),overrideSd=finite(result?.inputSnapshot?.overrides?.isoChlorideDep);
  const directSd=s.directSd??overrideSd,convertedSd=s.convertedSd??overrideSd;
  if(s.method==='wet_candle_direct'&&directSd!==null)return {ready:true,sd:directSd,method:'WET_CANDLE_DIRECT',standard:ISO_SD_STANDARD,formalIso:true,traceability:'A',confidence:'A',source:s.source||'User supplied ISO 9225 wet-candle result',measurementHeightM:s.measurementHeightM,periodDays:s.periodDays,modelEquivalent:model};
  if(s.method==='standard_converted'&&convertedSd!==null)return {ready:true,sd:convertedSd,method:'STANDARD_CONVERTED',standard:ISO_SD_STANDARD,formalIso:true,traceability:'B',confidence:'B',source:s.source||'User supplied ISO 9225 method-equivalent converted result',measurementHeightM:s.measurementHeightM,periodDays:s.periodDays,modelEquivalent:model};
  return {...model,selected:true};
}

export function wetCandleMonthlyAverage(records=[]){
  const valid=records.map(r=>({sd:finite(r.sd),days:finite(r.days)})).filter(r=>r.sd!==null&&r.days!==null&&r.days>0);
  const days=valid.reduce((s,r)=>s+r.days,0);return days?valid.reduce((s,r)=>s+r.sd*r.days,0)/days:null;
}
