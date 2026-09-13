import {DEFAULTS,doseResponse,computeModel} from './model-v330.js';

export const DIAGNOSTIC_VERSION='3.3.3';
export const SCIENCE_MODEL_VERSION='3.3.0';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const weighted=(rows,key)=>{const a=rows.filter(r=>Number.isFinite(r?.[key])&&Number(r.dt)>0),h=a.reduce((s,r)=>s+Number(r.dt),0);return h?a.reduce((s,r)=>s+Number(r[key])*Number(r.dt),0)/h:null};

export function doseTerms(material,pd,sd,rh,t){
  if([pd,sd,rh,t].some(v=>finite(v)===null)||pd<0||sd<0)return {so2:null,chloride:null,total:null};
  pd=Number(pd);sd=Number(sd);rh=Number(rh);t=Number(t);const m=String(material||'carbon_steel');let so2,chloride;
  if(m==='zinc'){const f=t<=10?.038*(t-10):-.071*(t-10);so2=.0129*Math.pow(pd,.44)*Math.exp(.046*rh+f);chloride=.0175*Math.pow(sd,.57)*Math.exp(.008*rh+.085*t)}
  else if(m==='copper'){const f=t<=10?.126*(t-10):-.080*(t-10);so2=.0053*Math.pow(pd,.26)*Math.exp(.059*rh+f);chloride=.01025*Math.pow(sd,.27)*Math.exp(.036*rh+.049*t)}
  else if(m==='aluminium'){const f=t<=10?.009*(t-10):-.043*(t-10);so2=.0042*Math.pow(pd,.73)*Math.exp(.025*rh+f);chloride=.0018*Math.pow(sd,.60)*Math.exp(.020*rh+.094*t)}
  else{const f=t<=10?.150*(t-10):-.054*(t-10);so2=1.77*Math.pow(pd,.52)*Math.exp(.020*rh+f);chloride=.102*Math.pow(sd,.62)*Math.exp(.033*rh+.040*t)}
  const total=so2+chloride,reference=doseResponse(m,pd,sd,rh,t);
  return {so2,chloride,total,reference,closureError:Number.isFinite(reference)?total-reference:null};
}

export function corrosionBasis(result){
  const s=result?.summary||{};
  if(Number.isFinite(s.isoFirstYearCorrosion))return {key:'ISO',rate:s.isoFirstYearCorrosion,sd:s.isoClDepMean,label:'Formal ISO 9223'};
  if(Number.isFinite(s.screeningFirstYearCorrosion))return {key:'SCREENING',rate:s.screeningFirstYearCorrosion,sd:s.clDepMean,label:'Engineering screening'};
  return {key:'MISSING',rate:null,sd:null,label:'No annual corrosion result'};
}

function annualDoseBreakdown(result,basisKey){
  const material=result?.summary?.material||result?.project?.material||'carbon_steel';
  const rows=(result?.annual||[]).filter(x=>x?.summary?.validForAnnualEstimate);
  const parts=rows.map(x=>{const s=x.summary,sd=basisKey==='ISO'?s.isoClDepMean:s.clDepMean;return doseTerms(material,s.meanSo2Dep,sd,s.meanRh,s.meanTemp)}).filter(x=>Number.isFinite(x.total));
  if(parts.length)return {so2:mean(parts.map(x=>x.so2)),chloride:mean(parts.map(x=>x.chloride)),total:mean(parts.map(x=>x.total)),years:parts.length};
  const s=result?.summary||{},sd=basisKey==='ISO'?s.isoClDepMean:s.clDepMean,t=doseTerms(material,s.meanSo2Dep,sd,s.meanRh,s.meanTemp);
  return {...t,years:0};
}

export function buildDiagnosticChain(result){
  if(!result?.summary)throw new Error('缺少平台计算结果');
  const s=result.summary,basis=corrosionBasis(result),rows=(result.hourly||[]).filter(r=>r?.valid),cfg=result.inputSnapshot?.cfg||{};
  const chlorideFraction=finite(cfg.chlorideFraction)??DEFAULTS.chlorideFraction;
  const drySalt=weighted(rows,'dryDep'),impactSalt=weighted(rows,'impactionDep'),wetSalt=weighted(rows,'wetDep');
  const annual=annualDoseBreakdown(result,basis.key),rainHours=rows.filter(r=>Number(r.rain)>0).reduce((a,r)=>a+Number(r.dt||0),0),wetMissingHours=rows.filter(r=>Number(r.rain)>0&&r.wetDepAvailable===false).reduce((a,r)=>a+Number(r.dt||0),0);
  const sourceQuality=(result.quality||[]).reduce((m,q)=>(m[q.key]=q,m),{});
  const warnings=[];
  if(wetMissingHours>0)warnings.push({code:'WET_DEP_DISABLED',severity:'high',message:'存在降雨小时，但湿沉降参数未配置，Wet deposition 未并入总盐沉降。',hours:wetMissingHours});
  if((s.wetHours||0)>0||(s.condHours||0)>0||(s.saltWetHours||0)>0)warnings.push({code:'WETNESS_NOT_COUPLED',severity:'high',message:'wet/cond/saltWet 已计算，但 V3.3.0 ISO/Screening 腐蚀率未使用这些状态量。'});
  if((s.proxySaltHours||0)>0)warnings.push({code:'SEA_SALT_PROXY',severity:'medium',message:'部分时段海盐使用 Proxy/EST，需与 CAMS Direct/局地监测核对。',hours:s.proxySaltHours});
  if(sourceQuality.so2?.originalMissingPercent>0)warnings.push({code:'SO2_MISSING',severity:'medium',message:'SO₂存在原始缺失；V3.3.2不再以 Pd=1 补齐。'});
  if(!Number.isFinite(s.isoClDepMean))warnings.push({code:'ISO_SD_MISSING',severity:'medium',message:'ISO 9225 等效 Sd 未建立，正式 ISO 通道不可用；当前仅可做工程Screening。'});
  if(Number(cfg.characteristicLength||DEFAULTS.characteristicLength)>=.5)warnings.push({code:'IMPACTION_LENGTH',severity:'medium',message:'惯性碰撞采用通用特征尺度，若实测试片/小构件尺度更小，需单独做几何敏感性分析。'});
  return {
    diagnosticVersion:DIAGNOSTIC_VERSION,scienceModelVersion:result.inputSnapshot?.modelVersion||SCIENCE_MODEL_VERSION,
    project:{...result.project},basis,
    source:{seaSalt:s.seaSaltSource,camsHours:s.camsHours,proxySaltHours:s.proxySaltHours,so2:result.provenance?.cams?.source||result.sources?.cams?.source||null,inputGrade:result.qualityAssessment?.inputGrade||null},
    atmosphere:{temperature:s.meanTemp,rh:s.meanRh,wind:null,waveHeight:s.meanWaveHeight,salinity:s.meanSalinity},
    seaSalt:{airSalt:s.airSaltMean,saltDep:s.saltDepMean,drySalt,impactSalt,wetSalt,chlorideFraction,engineeringCl:s.clDepMean,isoSd:s.isoClDepMean,cumulativeCl:s.cumulativeCl,surfaceClMean:s.surfaceClMean,surfaceClMax:s.surfaceClMax},
    pollutant:{pd:s.meanSo2Dep,pc:s.meanSo2Conc,physicalDeposition:s.meanPhysicalSo2Dep},
    wetness:{towHours:s.towHours,wetHours:s.wetHours,condHours:s.condHours,saltWetHours:s.saltWetHours,longestWet:s.longestWet,rainHours,wetDepMissingHours:wetMissingHours,coupledToDoseResponse:false},
    corrosion:{predicted:basis.rate,so2Term:annual.so2,chlorideTerm:annual.chloride,reconstructed:annual.total,material:s.material,class:basis.key==='ISO'?s.isoCorrosionClass:s.screeningCorrosionClass,years:annual.years},
    warnings
  };
}

export function buildBiasWaterfall(diagnostic,observed){
  const obs=finite(observed),pred=finite(diagnostic?.corrosion?.predicted),so2=finite(diagnostic?.corrosion?.so2Term),cl=finite(diagnostic?.corrosion?.chlorideTerm);
  if(obs===null||pred===null)return {ready:false,observed:obs,predicted:pred,bias:null,ratio:null,steps:[]};
  const gap=obs-pred;
  return {ready:true,observed:obs,predicted:pred,bias:pred-obs,underprediction:gap,ratio:obs!==0?pred/obs:null,steps:[
    {name:'SO₂项',delta:so2??0,end:so2??0,kind:'model'},
    {name:'Cl⁻项',delta:cl??Math.max(0,pred-(so2??0)),end:pred,kind:'model'},
    {name:'未解释参考差额',delta:gap,end:obs,kind:'residual'}
  ],note:'残差不是校准系数；仅表示参考值与当前模型输出之间尚未由已实现物理链解释的差额。'};
}

export function doseSensitivity(result,fractions=[-.2,-.1,.1,.2]){
  const s=result?.summary||{},basis=corrosionBasis(result),material=s.material||'carbon_steel',base={pd:s.meanSo2Dep,sd:basis.sd,rh:s.meanRh,t:s.meanTemp};
  const baseRate=doseResponse(material,base.pd,base.sd,base.rh,base.t);if(!Number.isFinite(baseRate))return [];
  const variables=[['Pd','pd','mul'],['Cl/Sd','sd','mul'],['RH','rh','addPctPoint'],['T','t','addDegC']];
  const out=[];
  for(const [name,key,mode] of variables){for(const f of fractions){const x={...base};if(mode==='mul')x[key]=Math.max(0,base[key]*(1+f));else if(mode==='addPctPoint')x[key]=clamp(base[key]+f*10,0,100);else x[key]=base[key]+f*10;const rate=doseResponse(material,x.pd,x.sd,x.rh,x.t);out.push({parameter:name,fraction:f,input:x[key],rate,changePercent:Number.isFinite(rate)?100*(rate/baseRate-1):null,basis:'dose_response_only'})}}
  return out;
}

const PARAMS=[
  ['proxySaltCoeff','海盐Proxy系数'],['proxyWindExp','Proxy风速指数'],['localSprayCoeff','Local Spray系数'],['localSprayScale35Km','35 μm Spray衰减长度'],['localSprayScale75Km','75 μm Spray衰减长度'],['localSprayWindExp','Spray风速指数'],['localSprayWaveExp','Spray波高指数'],['chlorideFraction','Cl质量占比'],['kappa','吸湿κ'],['characteristicLength','惯性碰撞特征尺度'],['genericImpactionOrientation','撞击方向因子'],['captureFactor','捕集系数'],['washEfficiency','雨洗效率'],['height','设备高度']
];

export function availableSensitivityParameters(){return PARAMS.map(([key,label])=>({key,label}));}

export function rerunSensitivity(result,{fractions=[-.2,.2],parameters=PARAMS.map(x=>x[0])}={}){
  if(!result?.inputData||!result?.inputSnapshot?.cfg)throw new Error('当前结果缺少可复算输入快照');
  const baseBasis=corrosionBasis(result),baseRate=baseBasis.rate;if(!Number.isFinite(baseRate))return {baseRate:null,rows:[],reason:'当前无年度ISO/Screening腐蚀率'};
  const rows=[];
  for(const [key,label] of PARAMS){if(!parameters.includes(key))continue;const base=Number(result.inputSnapshot.cfg[key]);if(!Number.isFinite(base))continue;
    for(const f of fractions){let value=base*(1+f);if(key==='height')value=clamp(value,2,150);if(['chlorideFraction','genericImpactionOrientation','washEfficiency'].includes(key))value=clamp(value,0,1);if(value===base)continue;
      const cfg={...result.inputSnapshot.cfg,[key]:value};const rerun=computeModel({weather:result.inputData.weather,cams:result.inputData.cams,ocean:result.inputData.ocean,gis:result.inputData.gis,cfg,overrides:result.inputSnapshot.overrides||{},calibrationModel:null});const b=corrosionBasis(rerun),rate=b.rate;
      rows.push({parameter:key,label,fraction:f,baseValue:base,value,baseRate,rate,changePercent:Number.isFinite(rate)?100*(rate/baseRate-1):null,clDepMean:rerun.summary.clDepMean,pd:rerun.summary.meanSo2Dep,basis:b.key});
    }
  }
  const ranked=[...new Set(rows.map(r=>r.parameter))].map(key=>{const r=rows.filter(x=>x.parameter===key),max=Math.max(...r.map(x=>Math.abs(x.changePercent||0)));return {parameter:key,label:r[0]?.label,maxAbsChangePercent:max}}).sort((a,b)=>b.maxAbsChangePercent-a.maxAbsChangePercent);
  return {baseRate,rows,ranked,note:'仅在同一环境原始数据快照上改变一个现有模型参数；不使用实测值，不拟合系数。'};
}

export function structuralGaps(diagnostic){
  const w=diagnostic?.warnings||[];return w.map(x=>({code:x.code,severity:x.severity,message:x.message,quantifiedHours:x.hours??null}));
}
