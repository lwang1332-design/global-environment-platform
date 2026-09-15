import {clamp,settlingVelocity,camsAmbientDiameter,proxyAmbientDiameter} from './model-v330.js';

export const ISO_SD_LAYER_VERSION='3.4.0';
export const ISO_SD_STANDARD='ISO 9225:2012';
export const WET_CANDLE={diameterM:0.025,exposedAreaM2:0.01,exposedLengthM:0.12,orientationFactor:1/Math.PI,rainProtected:true};
const RHO_P=2160, MU=1.81e-5;
const finite=v=>Number.isFinite(Number(v))?Number(v):null;

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
  const h=perHour.reduce((s,r)=>s+r.dt,0),sd=h?perHour.reduce((s,r)=>s+r.sd*r.dt,0)/h:null,directH=perHour.filter(r=>r.direct).reduce((s,r)=>s+r.dt,0);
  const directShare=h?directH/h:0;
  return {ready:Number.isFinite(sd),sd,method:'MODEL_WET_CANDLE',standard:ISO_SD_STANDARD,formalIso:false,traceability:'MODEL_EQUIVALENT',confidence:directShare>.9?'C':'D',coveragePercent:100,directSeaSaltSharePercent:directShare*100,collector:{...WET_CANDLE,diameterM:L,orientationFactor:orientation},note:'虚拟湿烛以标准湿式竖直圆柱的几何响应为目标；不使用腐蚀实测反推倍率，不能冒充现场ISO 9225实测。'};
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
