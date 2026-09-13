import {number,valid,RANGES,utcMs,HOUR,fieldQuality} from './data-quality.js';
import {heightCalibrationFactors,localExperienceCalibration,CALIBRATION_META} from './calibration-v328.js';
const G=9.80665, MU=1.81e-5, RHO_P=2160, RD=287.05;
export const DEFAULTS={kappa:1.1,chlorideFraction:0.55,washEfficiency:0.65,captureFactor:1.0,characteristicLength:1.0,so2DepVelocity:0.005,localSprayScaleKm:12,localSprayCoeff:5.5,localSprayWindExp:2.7,localSprayWaveExp:0.9,proxySaltCoeff:35,proxyWindExp:3.41,terrainFactor:1.0,genericImpactionOrientation:0.5,experienceHeightCalibration:true};
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function mean(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
export function sum(a){return a.filter(Number.isFinite).reduce((s,v)=>s+v,0);}
export function pct(a,p){const x=a.filter(Number.isFinite).sort((m,n)=>m-n);if(!x.length)return null;const k=(x.length-1)*p,f=Math.floor(k),c=Math.ceil(k);return f===c?x[f]:x[f]*(c-k)+x[c]*(k-f);}
export function degDiff(a,b){let d=Math.abs((a-b)%360);return d>180?360-d:d;}
export function maxContiguous(flags){let best=0,cur=0;for(const f of flags){cur=f?cur+1:0;best=Math.max(best,cur);}return best;}
export function magnusRH(t,td){const a=17.625,b=243.04;return clamp(100*Math.exp((a*td)/(b+td)-(a*t)/(b+t)),0,100);}
export function airDensity(tempC,pressureHpa){return (pressureHpa*100)/(RD*(tempC+273.15));}
export function growthFactor(rh,kappa=1.1){const x=clamp(rh,1,98.5)/100;return clamp(Math.pow(1+kappa*x/(1-x),1/3),1,2.8);}
export function settlingVelocity(dpUm){const d=Math.max(dpUm,0.01)*1e-6,lambda=.066e-6;const cc=1+(2*lambda/d)*(1.257+.4*Math.exp(-1.1*d/(2*lambda)));return ((RHO_P-1.2)*G*d*d*cc)/(18*MU);}
export function windAtHeight(u10,u100,height){height=clamp(Number(height||10),2,150);if(!Number.isFinite(u100)||u100<=0||!Number.isFinite(u10)||u10<=0)return Math.max(0.1,u10||0.1);if(height<=10)return Math.max(0.1,u10);const alpha=clamp(Math.log(u100/u10)/Math.log(10),0.03,0.5);return Math.max(.1,u10*Math.pow(height/10,alpha));}
export function doseResponse(material,pd,sd,rh,t){if([pd,sd,rh,t].some(v=>number(v)===null)||pd<0||sd<0)return null;pd=Number(pd);sd=Number(sd);rh=Number(rh);t=Number(t);const m=String(material||'carbon_steel');if(m==='zinc'){const f=t<=10?.038*(t-10):-.071*(t-10);return .0129*Math.pow(pd,.44)*Math.exp(.046*rh+f)+.0175*Math.pow(sd,.57)*Math.exp(.008*rh+.085*t);}if(m==='copper'){const f=t<=10?.126*(t-10):-.080*(t-10);return .0053*Math.pow(pd,.26)*Math.exp(.059*rh+f)+.01025*Math.pow(sd,.27)*Math.exp(.036*rh+.049*t);}if(m==='aluminium'){const f=t<=10?.009*(t-10):-.043*(t-10);return .0042*Math.pow(pd,.73)*Math.exp(.025*rh+f)+.0018*Math.pow(sd,.60)*Math.exp(.020*rh+.094*t);}const f=t<=10?.150*(t-10):-.054*(t-10);return 1.77*Math.pow(pd,.52)*Math.exp(.020*rh+f)+.102*Math.pow(sd,.62)*Math.exp(.033*rh+.040*t);}
export function corrosionClass(material,r){if(!Number.isFinite(r))return 'N/A';const m=String(material||'carbon_steel');if(m==='zinc'){if(r<=.1)return'C1';if(r<=.7)return'C2';if(r<=2.1)return'C3';if(r<=4.2)return'C4';if(r<=8.4)return'C5';return'CX';}if(m==='copper'){if(r<=.1)return'C1';if(r<=.6)return'C2';if(r<=1.3)return'C3';if(r<=2.8)return'C4';if(r<=5.6)return'C5';return'CX';}if(m==='aluminium'){if(r<=.6)return'C2';if(r<=2)return'C3';if(r<=5)return'C4';if(r<=10)return'C5';return'CX';}if(r<=1.3)return'C1';if(r<=25)return'C2';if(r<=50)return'C3';if(r<=80)return'C4';if(r<=200)return'C5';return'CX';}
export function chlorideClass(s){if(!Number.isFinite(s))return 'N/A';if(s<=3)return'S0';if(s<=60)return'S1';if(s<=300)return'S2';return'S3';}
export function isoTowClass(h){if(h<=10)return'τ1';if(h<=250)return'τ2';if(h<=2500)return'τ3';if(h<=5500)return'τ4';return'τ5';}
function nearestBearingBin(gis,wd){if(!gis?.bearingBins?.length)return null;let best=null,bestD=999;for(const b of gis.bearingBins){const d=degDiff(Number(b.bearing),wd);if(d<bestD){best=b;bestD=d;}}return best;}

export const MODEL_VERSION='3.2.8';
const FIELD_LABELS={t:'气温',td:'露点',rh:'相对湿度',rain:'降水',pressure:'气压',cloud:'云量',u10:'10 m风速',u100:'100 m风速',wd:'风向',sw:'短波辐射',blh:'边界层高度',hs:'有效波高',tp:'波周期',salinity:'盐度',ss1:'CAMS细粒海盐',ss2:'CAMS中粒海盐',ss3:'CAMS粗粒海盐',so2:'SO₂'};
const FIELD_UNITS={t:'°C',td:'°C',rh:'%',rain:'mm/h',pressure:'hPa',cloud:'%',u10:'m/s',u100:'m/s',wd:'°',sw:'W/m²',blh:'m',hs:'m',tp:'s',salinity:'PSU',ss1:'kg/kg',ss2:'kg/kg',ss3:'kg/kg',so2:'kg/kg'};
export const REFERENCES=[
 {title:'ISO 9223:2012 大气腐蚀性分类与估算',url:'https://www.iso.org/standard/53499.html',scope:'标准金属首年腐蚀剂量响应；输入需满足测量代表性。设备表面沉降与标准测法等效性尚待验证。'},
 {title:'Open-Meteo 历史气象接口',url:'https://open-meteo.com/en/docs/historical-weather-api',scope:'ERA5再分析、小时数据、单位及海陆格点选择'},
 {title:'Open-Meteo 海洋接口',url:'https://open-meteo.com/en/docs/marine-weather-api',scope:'波浪数据及格点位置'},
 {title:'corrosionCalcData.csv 数据审计',url:'./calibration-audit.json',scope:'高度比值参数探索；准确日期、单位、材料及测量方法未确认'}
];
function readValue(obj,key,i){return valid(obj?.[key]?.[i],RANGES[key]);}
function nearestWeatherBin(gis,wd){return nearestBearingBin(gis,wd);}
function weighted(rows,key){const a=rows.filter(x=>Number.isFinite(x[key])&&x.dt>0),h=a.reduce((s,x)=>s+x.dt,0);return h?a.reduce((s,x)=>s+x[key]*x.dt,0)/h:null;}
function cumulative(rows,key,scale=1){const a=rows.filter(x=>Number.isFinite(x[key]));return a.length?a.reduce((s,x)=>s+x[key]*x.dt*scale,0):null;}
function maximum(rows,key){const a=rows.map(x=>x[key]).filter(Number.isFinite);return a.length?Math.max(...a):null;}
function continuousWet(rows){let longest=0,current=0,last=null;for(const r of rows){const ms=utcMs(r.time);if(last!==null&&ms-last>1.01*HOUR)current=0;current=r.wet===true?current+r.dt:0;longest=Math.max(longest,current);last=ms}return longest;}
function sumFlag(rows,key){const a=rows.filter(x=>typeof x[key]==='boolean');return a.length?a.reduce((s,x)=>s+(x[key]?x.dt:0),0):null;}
function periodSummary(rows,cfg,expectedHours){
 const validRows=rows.filter(x=>x.valid),hours=validRows.reduce((s,x)=>s+x.dt,0),coverage=expectedHours?hours/expectedHours:0,complete=coverage>=(cfg.minCoverage??.95);
 const material=cfg.material||'carbon_steel',atmospheric=(cfg.exposureZone||'atmospheric')==='atmospheric',historical=cfg.mode==='historical';
 const vals=k=>rows.map(x=>x[k]).filter(Number.isFinite),temp=weighted(validRows,'t'),rh=weighted(validRows,'rh'),cl=weighted(validRows,'clDep'),pd=weighted(validRows,'so2Dep');
 const rate=historical&&atmospheric&&complete&&[temp,rh,cl,pd].every(Number.isFinite)?doseResponse(material,pd,cl,rh,temp):null;
 const salt=weighted(validRows,'saltDep'),air=weighted(validRows,'airSalt'),tow=sumFlag(rows,'tow');
 return {hours,expectedHours,coveragePercent:coverage*100,validForAnnualEstimate:historical&&complete,mode:cfg.mode,exposureZone:cfg.exposureZone||'atmospheric',material,height:cfg.height,designLife:cfg.designLife,airSaltMean:air,airSaltP95:pct(vals('airSalt'),.95),airSaltP99:pct(vals('airSalt'),.99),saltDepMean:salt,clDepMean:cl,clDepP95:pct(vals('clDep'),.95),clDepP99:pct(vals('clDep'),.99),cumulativeCl:cumulative(rows,'clDep',1/24/1000),cumulativeSalt:cumulative(rows,'saltDep',1/24/1000),surfaceClMean:weighted(validRows,'surfaceCl'),surfaceClP95:pct(vals('surfaceCl'),.95),surfaceClMax:maximum(rows,'surfaceCl'),towHours:tow,condHours:sumFlag(rows,'cond'),fogHours:sumFlag(rows,'fog'),wetHours:sumFlag(rows,'wet'),saltWetHours:sumFlag(rows,'saltWet'),longestWet:continuousWet(rows),wetDryCycles:Math.min(rows.filter(x=>x.wetStart).length,rows.filter(x=>x.dryStart).length),meanTemp:temp,meanRh:rh,meanBlh:weighted(validRows,'blh'),meanWaveHeight:weighted(validRows,'hs'),meanSalinity:weighted(validRows,'sal'),meanSo2Dep:pd,meanSo2Conc:weighted(validRows,'so2Conc'),firstYearCorrosion:rate,climateMeanCorrosion:rate,corrosionClass:corrosionClass(material,rate),chlorideClass:chlorideClass(cl),marineRatio:weighted(validRows,'marinePercent'),effectiveFetchP95:pct(vals('fetchKm'),.95),upwindSeaDistanceP50:pct(vals('upwindSeaDist'),.5),coarseContributionMean:weighted(validRows,'coarsePct'),effectiveBulkDepositionVelocity:air>0&&salt!==null?salt*1000/(air*86400):null,legacyBulkDepositionVelocityMedian:.0023023232836495034,isoTowClass:historical&&complete&&tow!==null?isoTowClass(tow):'—'};
}
export function validateParameters(cfg,overrides={}){
 const ranges={height:[2,150],kappa:[0,3],chlorideFraction:[0,1],washEfficiency:[0,1],captureFactor:[0,10],characteristicLength:[.01,100],so2DepVelocity:[0,.1],localSprayScaleKm:[.1,500],localSprayCoeff:[0,1000],localSprayWindExp:[0,8],localSprayWaveExp:[0,5],proxySaltCoeff:[0,10000],proxyWindExp:[0,8],terrainFactor:[0,10],genericImpactionOrientation:[0,1],minCoverage:[.5,1],designLife:[1,100]};
 for(const [k,range] of Object.entries(ranges))if(cfg[k]!==undefined&&valid(cfg[k],range)===null)throw new Error('参数超出范围：'+k+'（'+range.join('～')+'）');
 const limits={waveHeight:[0,50],salinity:[0,50],camsSs1:[0,.001],camsSs2:[0,.001],camsSs3:[0,.001],camsSo2:[0,.001],so2Dep:[0,1000]};
 for(const [k,v] of Object.entries(overrides))if(!limits[k]||valid(v,limits[k])===null)throw new Error('覆盖参数无效：'+k);
}
export function computeModel({weather,cams,ocean,gis,cfg={},overrides={},calibrationModel=null}){
 const P={...DEFAULTS,height:10,designLife:25,mode:'historical',exposureZone:'atmospheric',minCoverage:.95,...cfg};validateParameters(P,overrides);
 const time=weather?.time||[];if(!time.length)throw new Error('没有可计算的小时数据');
 const times=time.map(utcMs);if(times.some((t,i)=>!Number.isFinite(t)||(i>0&&t<=times[i-1])))throw new Error('计算时间轴必须按UTC递增且没有重复时间');
 const steps=times.slice(1).map((t,i)=>(t-times[i])/HOUR).filter(d=>d>0&&d<=1),nominalStep=steps.length?pct(steps,.5):1;
 const qualityValues={},qualityFlags={};for(const k of Object.keys(FIELD_LABELS)){qualityValues[k]=[];qualityFlags[k]=[]}
 let surfaceCl=0,previousWet=false,previousTime=null,stateContinuity=true,segments=1,sampleRecorded=false;const out=[];
 const choose=(obj,key,i,fallback=null,overrideKey=null,overrideValue=null)=>{
  const raw=readValue(obj,key,i);let value=raw,flag=raw===null?'MISSING':(obj?.flags?.[key]?.[i]||'RAW');
  if(overrideKey&&number(overrides[overrideKey])!==null){value=number(overrides[overrideKey]);flag='OVERRIDE'}
  else if(value===null&&number(overrideValue)!==null){value=number(overrideValue);flag='CALC'}
  else if(value===null&&fallback!==null){value=fallback;flag='EST'}
  qualityValues[key]?.push(value);qualityFlags[key]?.push(flag);return {raw,value,flag};
 };
 for(let i=0;i<time.length;i++){
  const ms=times[i],delta=i+1<time.length?(times[i+1]-ms)/HOUR:nominalStep,dt=Math.min(nominalStep,delta);
  if(previousTime!==null&&(ms-previousTime)/HOUR>nominalStep*1.01){surfaceCl=null;previousWet=null;stateContinuity=false;segments++}
  previousTime=ms;
  const rawT=readValue(weather,'t',i),rawTd=readValue(weather,'td',i),rawRh=readValue(weather,'rh',i);
  const rhDerived=rawT!==null&&rawTd!==null?magnusRH(rawT,rawTd):null;
  const tdDerived=rawT!==null&&rawRh>0?243.04*(Math.log(rawRh/100)+17.625*rawT/(243.04+rawT))/(17.625-Math.log(rawRh/100)-17.625*rawT/(243.04+rawT)):null;
  const values={},flags={},rawInputs={};
  const put=(key,result)=>{values[key]=result.value;flags[key]=result.flag;rawInputs[key]=result.raw;return result.value};
  const t=put('t',choose(weather,'t',i)),td=put('td',choose(weather,'td',i,null,null,tdDerived)),rh=put('rh',choose(weather,'rh',i,null,null,rhDerived)),rain=put('rain',choose(weather,'rain',i)),u10=put('u10',choose(weather,'u10',i)),wd=put('wd',choose(weather,'wd',i));
  const p=put('pressure',choose(weather,'pressure',i,1013.25)),cloud=put('cloud',choose(weather,'cloud',i,50)),sw=put('sw',choose(weather,'sw',i,0)),u100=put('u100',choose(weather,'u100',i,u10)),blh=put('blh',choose(weather,'blh',i,800));
  const hs=put('hs',choose(ocean,'hs',i,1.5,'waveHeight')),tp=put('tp',choose(ocean,'tp',i,7)),sal=put('salinity',choose(ocean,'salinity',i,35,'salinity'));
  const mixes=['ss1','ss2','ss3'].map((key,j)=>put(key,choose(cams,key,i,null,'camsSs'+(j+1)))),so2Mix=put('so2',choose(cams,'so2',i,null,'camsSo2'));
  const validHour=[t,rh,rain,u10,wd].every(Number.isFinite);
  if(!validHour){surfaceCl=null;stateContinuity=false;previousWet=null;out.push({time:new Date(ms).toISOString(),dt,valid:false,t,td,rh,rain,flags,rawInputs,effectiveInputs:values,reason:'缺少气温、湿度、风速、风向或降水；未以0补齐'});continue}
  const u=windAtHeight(u10,u100,P.height),rho=airDensity(t,p),bin=nearestWeatherBin(gis,wd);
  const upwindSeaDist=number(bin?.seaDistanceKm)??number(gis?.distanceToCoastKm)??50,fetchKm=number(bin?.fetchKm)??0,marine=upwindSeaDist<=100,marineFactor=marine?clamp(Math.exp(-upwindSeaDist/35)*(.55+.45*clamp(fetchKm/250,0,1)),.08,1):.02;
  const hc=heightCalibrationFactors(P.height,P.experienceHeightCalibration!==false),blhMod=clamp(Math.exp(-.08*Math.max(0,P.height-10)/Math.max(80,blh)),.92,1),backgroundHeightFactor=hc.background*blhMod,sprayHeightFactor=hc.localSpray*blhMod;
  const camsAvailable=mixes.every(Number.isFinite),ci=[0,0,0,0,0];
  if(camsAvailable)mixes.forEach((mix,j)=>{ci[j]=mix*rho*1e9*backgroundHeightFactor});
  else{const proxy=P.proxySaltCoeff*Math.pow(Math.max(u10,.2)/5,P.proxyWindExp)*Math.pow(hs/2,P.localSprayWaveExp)*(sal/35)*marineFactor*(.35+.65*clamp(fetchKm/250,0,1))*backgroundHeightFactor;[.18,.42,.4].forEach((fraction,j)=>{ci[j]=proxy*fraction})}
  const localSpray=P.localSprayCoeff*Math.pow(Math.max(u10,1)/8,P.localSprayWindExp)*Math.pow(hs/1.5,P.localSprayWaveExp)*(sal/35)*Math.exp(-upwindSeaDist/P.localSprayScaleKm)*clamp(.25+.75*fetchKm/100,.15,1.3)*sprayHeightFactor;
  ci[3]=localSpray*.68;ci[4]=localSpray*.32;
  let saltDep=0,coarseDep=0,dryDep=0,impactionDep=0,wetDep=0;const bins=[];
  [0.2,2,10,35,75].forEach((diameter,j)=>{
   const dp=diameter*growthFactor(rh,P.kappa),vd=Math.min(.16,settlingVelocity(dp)+.00018+.00006*u),dry=ci[j]*vd*86.4,stk=RHO_P*(dp*1e-6)**2*u/(18*MU*Math.max(P.characteristicLength,.05)),eta=clamp(.65*stk/(1+stk),0,.75),imp=ci[j]*u*eta*P.genericImpactionOrientation*86.4,wet=ci[j]*(1-Math.exp(-.022*rain))*.65,d=(dry+imp+wet)*P.captureFactor;
   dryDep+=dry*P.captureFactor;impactionDep+=imp*P.captureFactor;wetDep+=wet*P.captureFactor;saltDep+=d;if(dp>=10)coarseDep+=d;bins.push({diameter,wetDiameter:dp,concentration:ci[j],vd,stk,eta,dry,imp,wet,deposition:d});
  });
  const airSalt=ci.reduce((s,v)=>s+v,0),clDep=saltDep*P.chlorideFraction,previousSurfaceCl=surfaceCl,inputCl=clDep*dt/24,washFraction=rain>0?1-Math.pow(1-P.washEfficiency*(1-Math.exp(-.16*rain)),dt):0,resuspFraction=u>12&&rain===0?1-Math.pow(1-clamp((u-12)*.003,0,.08),dt):0;
  const washed=surfaceCl===null?null:surfaceCl*washFraction,resuspended=surfaceCl===null?null:surfaceCl*resuspFraction;
  surfaceCl=surfaceCl===null?null:Math.max(0,surfaceCl+inputCl-washed-resuspended);
  const ts=t+.0018*sw-(1-cloud/100)*1.7/(1+.28*u),cond=td===null?null:ts<=td,tow=t>0&&rh>80,fog=td===null?null:rh>=97&&(t-td)<=.6&&u<12,saltDeliq=surfaceCl===null?null:surfaceCl>20&&rh>75;
  const wet=tow||cond===true||rain>0||saltDeliq===true||fog===true?true:([cond,saltDeliq,fog].includes(null)?null:false),saltWet=surfaceCl===null||wet===null?null:wet&&surfaceCl>20;
  const wetStart=wet===true&&previousWet===false,dryStart=wet===false&&previousWet===true;previousWet=wet;
  const so2Conc=so2Mix===null?null:so2Mix*rho*1e9,so2Dep=number(overrides.so2Dep)??(so2Conc===null?1:so2Conc*P.so2DepVelocity*86.4);
  const row={time:new Date(ms).toISOString(),dt,valid:true,t,td,rh,rain,p,cloud,sw,u10,u100,wind:u,wd,blh,rho,hs,tp,sal,upwindSeaDist,fetchKm,marinePercent:marine?100:0,airSalt,ss1:ci[0],ss2:ci[1],ss3:ci[2],spray20:ci[3]+ci[4],saltDep,clDep,previousSurfaceCl,inputCl,washed,resuspended,surfaceCl,ts,cond,tow,fog,wet,saltWet,wetStart,dryStart,so2Conc,so2Dep,coarsePct:saltDep?100*coarseDep/saltDep:0,dryDep,impactionDep,wetDep,backgroundHeightFactor,sprayHeightFactor,camsAvailable,flags,rawInputs,effectiveInputs:values};
  if(!sampleRecorded){row.bins=bins;sampleRecorded=true}
  out.push(row);
 }
 const requestedYears=P.requestedYears||[...new Set(out.map(x=>new Date(x.time).getUTCFullYear()))],historical=P.mode==='historical';
 const expectedHours=historical?requestedYears.reduce((s,y)=>s+(Date.UTC(y+1,0,1)-Date.UTC(y,0,1))/HOUR,0):(P.expectedHours??((times.at(-1)-times[0])/HOUR+nominalStep));
 const s=periodSummary(out,P,expectedHours),annual=historical?requestedYears.map(year=>{const rows=out.filter(x=>new Date(x.time).getUTCFullYear()===year),summary=periodSummary(rows,P,(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/HOUR);return {year,summary}}):[];
 const completeYears=annual.filter(x=>x.summary.validForAnnualEstimate),allYears=historical&&completeYears.length===requestedYears.length;
 s.annualCl=allYears?s.cumulativeCl/requestedYears.length:null;s.annualSalt=allYears?s.cumulativeSalt/requestedYears.length:null;s.annualTowHours=allYears?s.towHours/requestedYears.length:null;
 s.firstYearCorrosion=allYears&&s.exposureZone==='atmospheric'?mean(annual.map(x=>x.summary.firstYearCorrosion)):null;s.isoFirstYearCorrosion=s.firstYearCorrosion;s.corrosionClass=corrosionClass(s.material,s.firstYearCorrosion);s.isoCorrosionClass=s.corrosionClass;
 if(!allYears){s.climateMeanCorrosion=null;s.isoTowClass='—'}
 else s.isoTowClass=isoTowClass(s.annualTowHours);
 s.periodLabel=historical?requestedYears.join(' / ')+' 年（UTC）':out[0].time+' 至 '+out.at(-1).time+'（UTC窗口）';
 s.corrosionBasis=historical?(requestedYears.length>1?'各完整年度首年腐蚀估算的算术平均':'完整年度气候输入的首年腐蚀估算'):'短期窗口不输出年度腐蚀率或长期寿命结论';
 s.stateContinuity={continuous:stateContinuity,segments,initialSurfaceCl:0,rule:'仅统计周期起点盐库存设为0；连续年份不重置。缺测或时间断档后库存未知，不编造恢复值。'};
 s.seaSaltSource=out.some(x=>x.valid&&x.camsAvailable)?'CAMS_WITH_EST_SPRAY':'EST_PROXY';s.camsHours=out.filter(x=>x.valid&&x.camsAvailable).reduce((a,x)=>a+x.dt,0);s.proxySaltHours=s.hours-s.camsHours;s.zoneModelStatus=s.exposureZone==='atmospheric'?'ENGINEERING_ESTIMATE':'SCREENING';
 s.distanceToCoastKm=number(gis?.distanceToCoastKm);s.coastBearing=number(gis?.coastBearing);s.elevation=number(gis?.elevation);s.legacyDepositionVelocityRatio=s.effectiveBulkDepositionVelocity===null?null:s.effectiveBulkDepositionVelocity/.0023023232836495034;
 const quality=Object.keys(FIELD_LABELS).map(key=>{
  const obj=['hs','tp','salinity'].includes(key)?ocean:['ss1','ss2','ss3','so2'].includes(key)?cams:weather;
  const q=fieldQuality(qualityValues[key],qualityFlags[key],{key,label:FIELD_LABELS[key],unit:FIELD_UNITS[key],...obj?.fieldMeta?.[key]});
  const raw=(obj?.[key]||[]).map(v=>valid(v,RANGES[key])),observed=raw.filter((v,i)=>Number.isFinite(v)&&(obj?.flags?.[key]?.[i]||'RAW')==='RAW').length;q.sourceCoveragePercent=time.length?100*observed/time.length:0;q.source=q.source||obj?.provenance?.source||'无有效数据';q.originalMissingPercent=100-q.sourceCoveragePercent;q.alignment=obj?.audit||null;return q;
 });
 for(const [key,label,unit,flag] of [['airSalt','空气海盐浓度（含代理与粗颗粒）','μg/m³',r=>r.valid?'EST':'MISSING'],['clDep','Cl⁻沉降（含工程估算项）','mg/(m²·d)',r=>r.valid?'EST':'MISSING'],['so2Dep','SO₂沉降','mg/(m²·d)',r=>!r.valid?'MISSING':number(overrides.so2Dep)!==null?'OVERRIDE':r.so2Conc===null?'EST':'CALC']]){const q=fieldQuality(out.map(r=>r[key]??null),out.map(flag),{key,label,unit,source:key==='so2Dep'?'CAMS浓度换算 / 1 mg/(m²·d)工程估算 / 人工覆盖':'CAMS背景或海盐代理 + 局地粗颗粒工程项'});q.sourceCoveragePercent=key==='so2Dep'?100*out.filter(r=>r.valid&&r.so2Conc!==null).length/out.length:0;q.originalMissingPercent=100-q.sourceCoveragePercent;quality.push(q)}
 const reasons=[];if(s.coveragePercent<95)reasons.push('关键气象有效覆盖率低于95%');if(!allYears&&historical)reasons.push('所选年度未全部满足有效数据要求');if(s.proxySaltHours>0)reasons.push('海盐代理参与 '+s.proxySaltHours+' 小时');if(quality.some(q=>q.estimated>0))reasons.push('存在工程估算输入');if(!stateContinuity)reasons.push('缺测或断档使后续表面盐库存无法完整追踪');if(gis?.provenance?.source?.includes('Natural Earth'))reasons.push('GIS采用低分辨率海岸线');reasons.push('局地粗颗粒、撞击/湿沉降、表面盐参数及标准测法等效性仍需实测验证');
 const inputGrade=s.coveragePercent<95?'D':quality.some(q=>q.estimated>0)||s.proxySaltHours>0?'C':quality.some(q=>q.interpolatedPercent>10)?'B':'A';
 const experience=localExperienceCalibration({latitude:P.latitude,longitude:P.longitude,height:P.height,rawCorrosion:s.firstYearCorrosion,material:s.material,exposureZone:s.exposureZone,mode:P.mode,validationMode:P.validationMode},calibrationModel);
 s.experienceCalibration=experience;s.engineeringFirstYearCorrosion=experience.applied?experience.calibratedCorrosion:s.firstYearCorrosion;s.engineeringCorrosionClass=corrosionClass(s.material,s.engineeringFirstYearCorrosion);
 return {summary:s,hourly:out,timeline:out.filter((_,i)=>i%Math.max(1,Math.ceil(out.length/1100))===0),annual,_annual:annual,quality,qualityAssessment:{inputGrade,rules:{A:'关键气象覆盖≥95%，无工程估算，单变量插值≤10%',B:'关键气象覆盖≥95%，无工程估算，部分变量插值>10%',C:'关键气象覆盖≥95%，存在估算或海盐代理',D:'关键气象覆盖<95%，不提供年度腐蚀定量结论'},reasons,modelEvidence:experience.applied?'局地校准已应用；详见独立留出统计':'尚无满足同期元数据条件的独立验证',confidenceInterval:null,confidenceIntervalReason:'未建立经验证的统计误差分布，不生成95%置信区间'},
 project:{latitude:P.latitude,longitude:P.longitude,height:P.height,material:s.material,exposureZone:s.exposureZone,mode:P.mode,designLife:P.designLife,years:historical?requestedYears:[],year:historical&&requestedYears.length===1?requestedYears[0]:null,periodYears:historical?requestedYears.length:null,name:P.projectName||''},inputSnapshot:{modelVersion:MODEL_VERSION,cfg:P,overrides:structuredClone(overrides),calibrationVersion:calibrationModel?.createdAt||null},inputData:{weather,cams,ocean,gis},calibrationModel:structuredClone(calibrationModel),provenance:{weather:weather.provenance,cams:cams?.provenance||{type:'EST',source:'海盐工程代理'},ocean:ocean?.provenance||{type:'MISSING',source:'海洋数据不可用'},gis:gis?.provenance||{type:'MISSING'},corrosion:{type:'CALC',source:'ISO 9223公式工程估算'},experienceLocal:{type:experience.applied?'CALIBRATED':'REFERENCE_ONLY',applied:experience.applied,reason:experience.reason}},
 formulas:[{name:'空气密度',expr:'ρ=P×100/[287.05×(T+273.15)]',type:'物理公式'},{name:'CAMS质量浓度换算',expr:'C=q×ρ×10⁹；局地>20 μm项另标EST',type:'单位换算'},{name:'沉降与氯离子',expr:'Jdry=C×vd×86.4；JCl=(Jdry+Jimp+Jwet)×fCl',type:'物理与经验组合；待测法等效校准'},{name:'表面库存',expr:'Snext=Sprev+JCl×Δt/24−wash−resuspension',type:'状态模型'},{name:'凝露与湿润',expr:'Tsurface≤Tdew；ISO TOW: T>0°C 且 RH>80%',type:'表面温度估算与气象判据'},{name:'大气腐蚀',expr:'r=f(Pd,Sd,RH,T)，按完整年度输入计算；多年结果分列气候均值代入值',type:'ISO 9223剂量响应'}],references:REFERENCES};
}
