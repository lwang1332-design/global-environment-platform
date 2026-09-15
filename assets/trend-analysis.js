/* Global Environment Platform - secondary-indicator trend analysis V2
 * Config-driven: module -> indicators -> real/derived series -> aggregation -> trend -> design gap.
 * Never fabricates unavailable observations.
 */
(()=>{
'use strict';
const YEAR_MS=365.2425*864e5;
const observed=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
const n=v=>observed(v)?Number(v):NaN;
const finite=Number.isFinite;
const selectedYears=()=>{const v=Number(document.getElementById('years')?.value);return[1,3,5].includes(v)?v:3};
function globals(){let c=null,p={},cur={};try{c=cache}catch{}try{p=params||{}}catch{}try{cur=current||{}}catch{}return{c,p,cur}}
function point(time,value,extra={}){const d=new Date(time),v=n(value);return finite(d.getTime())&&finite(v)?{time:d.toISOString(),ts:d.getTime(),value:v,...extra}:null}
function dedupe(points){const m=new Map();(points||[]).forEach(p=>{if(p&&finite(p.ts)&&finite(p.value))m.set(p.ts,p)});return[...m.values()].sort((a,b)=>a.ts-b.ts)}
function cleanPairs(times,values,transform){const out=[],len=Math.min(Array.isArray(times)?times.length:0,Array.isArray(values)?values.length:0);for(let i=0;i<len;i++){if(!observed(values[i]))continue;const d=new Date(times[i]);if(!finite(d.getTime()))continue;const v=transform?transform(Number(values[i]),i):Number(values[i]);if(!observed(v))continue;out.push({time:d.toISOString(),ts:d.getTime(),value:Number(v)})}return dedupe(out)}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
function percentile(a,p){const s=(a||[]).filter(finite).sort((x,y)=>x-y);if(!s.length)return NaN;const k=(s.length-1)*p,l=Math.floor(k),h=Math.ceil(k);return l===h?s[l]:s[l]+(s[h]-s[l])*(k-l)}
const median=a=>percentile(a,.5);
function std(a){const v=(a||[]).filter(finite);if(!v.length)return NaN;const m=mean(v);return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length)}
function periodKey(ts,gran){const d=new Date(ts);if(gran==='year')return String(d.getUTCFullYear());return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`}
function periodTime(key,gran){return gran==='year'?Date.UTC(Number(key),0,1):Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1)}
function aggregate(points,gran='month',mode='mean'){
 const groups=new Map();dedupe(points).forEach(p=>{const k=periodKey(p.ts,gran);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p.value)});
 const calc=a=>mode==='max'?Math.max(...a):mode==='min'?Math.min(...a):mode==='sum'?a.reduce((s,v)=>s+v,0):mode==='p95'?percentile(a,.95):mode==='p99'?percentile(a,.99):mode==='ratio100'?mean(a)*100:mode==='count'?a.reduce((s,v)=>s+(v?1:0),0):mean(a);
 return[...groups.entries()].map(([k,a])=>{const ts=periodTime(k,gran);return{time:new Date(ts).toISOString(),ts,value:calc(a),period:k}}).filter(p=>finite(p.value)).sort((a,b)=>a.ts-b.ts)
}
function moving(points,window=3){const a=dedupe(points),out=[],q=[],sum={v:0};for(const p of a){q.push(p.value);sum.v+=p.value;if(q.length>window)sum.v-=q.shift();out.push({...p,value:sum.v/q.length})}return out}
function sample(points,maxN=480){const a=dedupe(points);if(a.length<=maxN)return a;const out=[];for(let i=0;i<maxN;i++)out.push(a[Math.round(i*(a.length-1)/(maxN-1))]);return dedupe(out)}
function linearRegression(points){const a=dedupe(points);if(a.length<2)return{slopePerYear:NaN,intercept:NaN,t0:NaN};const t0=a[0].ts,x=a.map(p=>(p.ts-t0)/YEAR_MS),y=a.map(p=>p.value),xm=mean(x),ym=mean(y);let top=0,bot=0;for(let i=0;i<x.length;i++){top+=(x[i]-xm)*(y[i]-ym);bot+=(x[i]-xm)**2}const slope=bot?top/bot:NaN;return{slopePerYear:slope,intercept:finite(slope)?ym-slope*xm:NaN,t0}}
function erf(x){const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a);return sign*y}
const normalCdf=z=>.5*(1+erf(z/Math.SQRT2));
function mannKendall(points){const a=sample(points,480).map(p=>p.value),len=a.length;if(len<8)return{z:NaN,p:NaN,s:NaN};let S=0;for(let i=0;i<len-1;i++)for(let j=i+1;j<len;j++)S+=Math.sign(a[j]-a[i]);const counts=new Map();a.forEach(v=>counts.set(v,(counts.get(v)||0)+1));let ties=0;counts.forEach(t=>{if(t>1)ties+=t*(t-1)*(2*t+5)});const variance=(len*(len-1)*(2*len+5)-ties)/18;if(variance<=0)return{z:0,p:1,s:S};const z=S>0?(S-1)/Math.sqrt(variance):S<0?(S+1)/Math.sqrt(variance):0;return{z,p:Math.max(0,Math.min(1,2*(1-normalCdf(Math.abs(z))))),s:S}}
function senSlope(points){const a=sample(points,360),slopes=[];for(let i=0;i<a.length-1;i++)for(let j=i+1;j<a.length;j++){const dt=(a[j].ts-a[i].ts)/YEAR_MS;if(dt>0)slopes.push((a[j].value-a[i].value)/dt)}return median(slopes)}
function seasonalAnomalies(points){const a=dedupe(points);if(a.length<24)return a;const buckets=Array.from({length:12},()=>[]);a.forEach(p=>buckets[new Date(p.ts).getUTCMonth()].push(p.value));const climatology=buckets.map(mean);return a.map(p=>({...p,value:p.value-climatology[new Date(p.ts).getUTCMonth()]}))}
function analyzeEnvironmentalTrend(points,{unit='',years=selectedYears(),design=null}={}){
 const a=dedupe(points),vals=a.map(p=>p.value);if(vals.length<3)return{valid:false,count:vals.length,unit};
 const spanYears=(a.at(-1).ts-a[0].ts)/YEAR_MS,longTerm=years>=3&&spanYears>=1.8,basis=longTerm?seasonalAnomalies(a):a,reg=linearRegression(basis),mk=mannKendall(basis),sen=senSlope(basis),slope=finite(sen)?sen:reg.slopePerYear,significant=finite(mk.p)&&mk.p<.05;
 const mx=Math.max(...vals),mn=Math.min(...vals),avg=mean(vals),sd=std(vals),cv=Math.abs(avg)>1e-12?sd/Math.abs(avg):NaN,trendDirection=significant?(slope>0?'上升':slope<0?'下降':'稳定'):'无显著趋势',viol=[];
 if(design){a.forEach(p=>{let amount=0,type='';if(finite(design.upper)&&p.value>design.upper){amount=p.value-design.upper;type='upper'}if(finite(design.lower)&&p.value<design.lower){amount=design.lower-p.value;type='lower'}if(amount>0)viol.push({...p,amount,type})})}
 return{valid:true,count:vals.length,current:vals.at(-1),mean:avg,min:mn,max:mx,p95:percentile(vals,.95),p99:percentile(vals,.99),std:sd,cv,volatility:!finite(cv)?'--':cv<.1?'低':cv<.3?'中':'高',slopePerYear:slope,linearSlopePerYear:reg.slopePerYear,trendDirection,significant,pValue:mk.p,z:mk.z,trendBasis:longTerm?'多年度去季节趋势':'周期内变化趋势',maxPoint:a.find(p=>p.value===mx),minPoint:a.find(p=>p.value===mn),designViolations:viol,designViolationCount:viol.length,maxDesignExceedance:viol.length?Math.max(...viol.map(v=>v.amount)):0,unit}
}
function absoluteHumidityPoints(h){const t=h.time||[],T=h.temperature_2m||[],RH=h.relative_humidity_2m||[],out=[],len=Math.min(t.length,T.length,RH.length);for(let i=0;i<len;i++){if(!observed(T[i])||!observed(RH[i]))continue;const temp=Number(T[i]),rh=Number(RH[i]),es=6.112*Math.exp(17.67*temp/(temp+243.5)),ah=216.7*(rh/100*es)/(temp+273.15),p=point(t[i],ah);if(p)out.push(p)}return dedupe(out)}
function dailyRangePoints(d){const t=d.time||[],mx=d.temperature_2m_max||[],mn=d.temperature_2m_min||[],out=[],len=Math.min(t.length,mx.length,mn.length);for(let i=0;i<len;i++){if(!observed(mx[i])||!observed(mn[i]))continue;const p=point(t[i],Number(mx[i])-Number(mn[i]));if(p)out.push(p)}return dedupe(out)}
function temperatureRatePoints(h){const t=h.time||[],T=h.temperature_2m||[],out=[];for(let i=1;i<Math.min(t.length,T.length);i++){if(!observed(T[i])||!observed(T[i-1]))continue;const a=new Date(t[i-1]),b=new Date(t[i]),dt=(b-a)/36e5;if(!(dt>0&&dt<=6))continue;const p=point(t[i],Math.abs(Number(T[i])-Number(T[i-1]))/dt);if(p)out.push(p)}return dedupe(out)}
function conditionPoints(h,test){const time=h.time||[],out=[];for(let i=0;i<time.length;i++){const d=new Date(time[i]);if(!finite(d.getTime()))continue;const v=test(i);if(v===null||v===undefined)continue;out.push({time:d.toISOString(),ts:d.getTime(),value:v?1:0})}return dedupe(out)}
function condensationStatePoints(h,p){
 const time=h.time||[],T=h.temperature_2m||[],Td=h.dew_point_2m||[],V=h.wind_speed_10m||[],G=h.shortwave_radiation||[],len=Math.min(time.length,T.length,Td.length),out=[];if(!len)return out;
 const sigma=5.670374419e-8,rho=observed(p.rho)?Number(p.rho):7850,Cp=observed(p.cp)?Number(p.cp):500,delta=(observed(p.delta)?Number(p.delta):10)/1000,eps=observed(p.eps)?Number(p.eps):.85,alpha=observed(p.alpha)?Number(p.alpha):.6,sky=observed(p.sky)?Number(p.sky):6,CA=Math.max(1,rho*Cp*delta),subMin=Math.max(5,Math.min(60,observed(p.condDtMin)?Number(p.condDtMin):10)),subN=Math.max(1,Math.round(60/subMin)),dt=3600/subN,film=observed(p.condFilmMargin)?Number(p.condFilmMargin):0;
 let Ts=observed(T[0])?Number(T[0]):20;
 for(let i=0;i<len;i++){
  if(!observed(T[i])||!observed(Td[i]))continue;const ta=Number(T[i]),td=Number(Td[i]),vv=observed(V[i])?Math.max(0,Number(V[i])):0,gg=observed(G[i])?Math.max(0,Number(G[i])):0,hc=5.7+3.8*vv;
  for(let k=0;k<subN;k++){const TsK=Ts+273.15,TaK=ta+273.15,qconv=hc*(ta-Ts),qsolar=alpha*gg,qrad=eps*sigma*(Math.pow(TsK,4)-Math.pow(TaK-sky,4)),dT=dt*(qconv+qsolar-qrad)/CA;Ts+=Math.max(-5/subN,Math.min(5/subN,dT))}
  const pnt=point(time[i],Ts-td<=film?1:0);if(pnt)out.push(pnt)
 }
 return dedupe(out)
}
function airDensityPoints(h){const t=h.time||[],P=h.surface_pressure||[],T=h.temperature_2m||[],out=[],len=Math.min(t.length,P.length,T.length);for(let i=0;i<len;i++){if(!observed(P[i])||!observed(T[i]))continue;const rho=Number(P[i])*100/(287.05*(Number(T[i])+273.15)),p=point(t[i],rho);if(p)out.push(p)}return dedupe(out)}
function pmAnnualInPoints(aq,p){const time=aq.time||[],pm=aq.pm10||[],Q=observed(p.Q)?Number(p.Q):100000,eta=Math.max(0,Math.min(1,observed(p.filterEta)?Number(p.filterEta):.9)),bypass=Math.max(0,Math.min(1,observed(p.filterBypass)?Number(p.filterBypass):.03)),hours=Math.max(0,Math.min(8760,observed(p.opHours)?Number(p.opHours):8760)),penetration=(1-eta)*(1-bypass)+bypass,k=Q*hours/1e9*penetration;return cleanPairs(time,pm,v=>v*k)}
function solarHourlyEnergyPoints(h){return cleanPairs(h.time||[],h.shortwave_radiation||[],v=>v/1000)}
function moldPotentialPoints(h){const T=h.temperature_2m||[],RH=h.relative_humidity_2m||[];return conditionPoints(h,i=>observed(T[i])&&observed(RH[i])?Number(T[i])>20&&Number(RH[i])>80:null)}
function metric(key,name,unit,dataClass,source,build,agg,opts={}){return{key,name,unit,dataClass,source,build,aggregation:{month:agg?.month||agg||'mean',year:agg?.year||agg||'mean'},axisGroup:opts.axisGroup||unit||key,defaultSelected:!!opts.defaultSelected,design:opts.design||null,note:opts.note||'',staticValue:opts.staticValue,supplemental:!!opts.supplemental,availableWhen:opts.availableWhen||null}}
function moduleCatalog(){
 const{c,p}=globals(),h=c?.w?.j?.hourly||{},d=c?.w?.j?.daily||{},aq=c?.aq?.j?.hourly||{};
 const hp=()=>cleanPairs(h.time||[],h.temperature_2m||[]),rh=()=>cleanPairs(h.time||[],h.relative_humidity_2m||[]),rainDay=()=>cleanPairs(d.time||[],d.precipitation_sum||[]),rainHour=()=>cleanPairs(h.time||[],h.precipitation||[]),pm=()=>cleanPairs(aq.time||[],aq.pm10||[]),wind=()=>cleanPairs(h.time||[],h.wind_speed_10m||[]),sea=()=>cleanPairs(aq.time||[],aq.sea_salt_aerosol||[]),so2=()=>cleanPairs(aq.time||[],aq.sulphur_dioxide||[]),snow=()=>cleanPairs(d.time||[],d.snowfall_sum||[]),press=()=>cleanPairs(h.time||[],h.surface_pressure||[],v=>v/10);
 const clFactor=(observed(p.saltVd)?Number(p.saltVd):NaN)*86400/1000*(observed(p.saltClFrac)?Number(p.saltClFrac):NaN),dryFactor=(observed(p.saltVd)?Number(p.saltVd):NaN)*86400/1000;
 const un=(key,name,unit,source,note='当前未接入真实时间序列。')=>metric(key,name,unit,'未接入',source,()=>[],{month:'mean',year:'mean'},{note});
 return[
 {module:'温度',indicators:[
  metric('temp_max','极端最高温','℃','真实数据','ERA5 2 m小时温度',hp,{month:'max',year:'max'},{axisGroup:'temp_abs',defaultSelected:true,design:{upper:()=>n(p.capHigh),label:'最高设计温度'}}),
  metric('temp_min','极端最低温','℃','真实数据','ERA5 2 m小时温度',hp,{month:'min',year:'min'},{axisGroup:'temp_abs',defaultSelected:true,design:{lower:()=>n(p.capLow),label:'最低设计温度'}}),
  metric('temp_mean','年平均温度','℃','真实数据','ERA5 2 m小时温度',hp,{month:'mean',year:'mean'},{axisGroup:'temp_abs',defaultSelected:true}),
  metric('day_range_p95','日温差P95','K','工程派生','ERA5逐日最高/最低温',()=>dailyRangePoints(d),{month:'p95',year:'p95'},{axisGroup:'temp_delta',design:{upper:()=>n(p.capDayRange),label:'最大日温差'}}),
  metric('temp_rate_p95','温变速率P95','K/h','工程派生','ERA5小时温度',()=>temperatureRatePoints(h),{month:'p95',year:'p95'},{axisGroup:'temp_rate',design:{upper:()=>n(p.capTempRate),label:'最大温变速率'}}),
  un('surface_temp_p99','暴晒最高地表温度','℃','待接地表温度/表面热平衡模型','当前平台未接入真实地表温度时间序列；禁止用空气温度冒充地表温度。')
 ]},
 {module:'湿度',indicators:[
  metric('rh_mean','年平均相对湿度','%','真实数据','ERA5 2 m相对湿度',rh,{month:'mean',year:'mean'},{axisGroup:'rh',defaultSelected:true,design:{upper:()=>n(p.capRh),label:'最大RH'}}),
  metric('rh90_ratio','高湿时间比例','%','工程派生','ERA5相对湿度',()=>conditionPoints(h,i=>observed(h.relative_humidity_2m?.[i])?Number(h.relative_humidity_2m[i])>90:null),{month:'ratio100',year:'ratio100'},{axisGroup:'rh',defaultSelected:true}),
  metric('ah_mean','平均绝对湿度','g/m³','工程派生','ERA5温度+相对湿度',()=>absoluteHumidityPoints(h),{month:'mean',year:'mean'},{axisGroup:'abs_humidity',defaultSelected:true}),
  metric('ah_max','最大绝对湿度','g/m³','工程派生','ERA5温度+相对湿度',()=>absoluteHumidityPoints(h),{month:'max',year:'max'},{axisGroup:'abs_humidity'}),
  metric('cond_hours','年凝露时间',g=>g==='year'?'h/y':'h/月','工程派生','ERA5温湿度+现有瞬态凝露模型',()=>condensationStatePoints(h,p),{month:'sum',year:'sum'},{axisGroup:'cond_hours',note:'逐小时复用现有金属表面热惯性/露点凝露判据后按月或年累计。'})
 ]},
 {module:'降雨',indicators:[
  metric('rain_daily_max','最大日降雨','mm/d','真实数据','ERA5逐日降雨',rainDay,{month:'max',year:'max'},{axisGroup:'rain_day',defaultSelected:true,design:{upper:()=>n(p.capRainDay),label:'最大日降雨能力'}}),
  metric('rain_hour_p99','小时强降雨P99','mm/h','真实数据','ERA5小时降雨',rainHour,{month:'p99',year:'p99'},{axisGroup:'rain_hour',defaultSelected:true,design:{upper:()=>n(p.capRainHour),label:'最大小时降雨能力'}}),
  metric('rain_total','年降雨量',g=>g==='year'?'mm/y':'mm/月','真实数据','ERA5逐日降雨',rainDay,{month:'sum',year:'sum'},{axisGroup:'rain_total',defaultSelected:true}),
  un('rain_ph','雨水pH','pH','待接降水化学监测'),un('freezing_rain_count','冻雨频次','次/期','待接冻雨观测/天气现象编码'),un('wet_snow_count','湿雪频次','次/期','待接湿雪观测/液态含水量')
 ]},
 {module:'PM10 / 颗粒物',indicators:[
  metric('pm10_mean','PM10平均','μg/m³','真实数据','CAMS Global小时PM10',pm,{month:'mean',year:'mean'},{axisGroup:'pm',defaultSelected:true,design:{upper:()=>n(p.capPm),label:'PM10设计限值'}}),
  metric('pm10_p95','PM10 P95','μg/m³','真实数据','CAMS Global小时PM10',pm,{month:'p95',year:'p95'},{axisGroup:'pm',defaultSelected:true,design:{upper:()=>n(p.capPm),label:'PM10设计限值'}}),
  metric('dust_mass_year','年进入质量','kg/y','工程派生','CAMS PM10+设备Q/过滤/旁通/运行时长',()=>pmAnnualInPoints(aq,p),{month:'mean',year:'mean'},{axisGroup:'particle_mass',defaultSelected:true,note:'以各月/各年的PM10平均浓度换算等效年进入颗粒质量，用于比较趋势。'}),
  un('dust_d50','沙尘粒径D50','μm','待接粒径谱监测'),un('sand_flux','沙蚀通量','kg/m²·s','待接颗粒通量/粒径/撞击角数据'),un('duststorm_hours','沙尘暴时间','h/y','待接沙尘暴事件库'),un('sio2_ratio','硅砂比例','%','待接颗粒化学成分监测'),un('mineral_composition','矿物组成','-','待接矿物数据库/现场样品')
 ]},
 {module:'风速',indicators:[
  metric('wind_mean','平均风速','m/s','真实数据','ERA5 10 m小时风速',wind,{month:'mean',year:'mean'},{axisGroup:'wind',defaultSelected:true}),
  metric('wind_design','设计阵风','m/s','工程派生','管理员设计能力参数',()=>[],{month:'mean',year:'mean'},{staticValue:()=>n(p.capWind),note:'设计能力静态参考，不伪装为气象趋势。'}),
  un('gust_p99','阵风P99','m/s','未接入真实阵风时间序列','当前ERA5请求未包含真实阵风序列，不使用gustFactor代理值冒充实测。'),
  un('ti_p95','湍流强度P95','%','未接入10分钟/高频风速数据'),un('wind_risk_score','极端风风险评分','0-100','待真实阵风序列后计算')
 ]},
 {module:'盐雾',indicators:[
  metric('cl_dep_rate','Cl⁻沉积速率','mg/m²·d','工程派生','CAMS海盐+Vd+Cl⁻质量比例',()=>finite(clFactor)?cleanPairs(aq.time||[],aq.sea_salt_aerosol||[],v=>v*clFactor):[],{month:'mean',year:'mean'},{axisGroup:'salt_dep',defaultSelected:true,design:{upper:()=>n(p.capCl),label:'Cl⁻沉积设计限值'},note:'工程模型值，不等同于现场沉积片实测值。'}),
  metric('tow','润湿时间','%','工程派生','ERA5温度+相对湿度',()=>conditionPoints(h,i=>observed(h.temperature_2m?.[i])&&observed(h.relative_humidity_2m?.[i])?Number(h.temperature_2m[i])>n(p.towTmin)&&Number(h.temperature_2m[i])<n(p.towTmax)&&Number(h.relative_humidity_2m[i])>n(p.towRh):null),{month:'ratio100',year:'ratio100'},{axisGroup:'tow',defaultSelected:true,design:{upper:()=>n(p.capTow),label:'TOW允许占比'}}),
  metric('seasalt_p95','海盐浓度P95','μg/m³','真实数据','CAMS Global sea_salt_aerosol',sea,{month:'p95',year:'p95'},{axisGroup:'seasalt',defaultSelected:true}),
  metric('seasalt_p99','海盐浓度P99','μg/m³','真实数据','CAMS Global sea_salt_aerosol',sea,{month:'p99',year:'p99'},{axisGroup:'seasalt'}),
  metric('dry_dep_rate','干盐沉降速率','mg/m²·d','工程派生','CAMS海盐+Vd',()=>finite(dryFactor)?cleanPairs(aq.time||[],aq.sea_salt_aerosol||[],v=>v*dryFactor):[],{month:'mean',year:'mean'},{axisGroup:'salt_dep',note:'工程沉降换算值。'})
 ]},
 {module:'海拔',indicators:[
  metric('altitude','海拔高度','m','真实数据','Open-Meteo Elevation / ERA5回退',()=>[],{month:'mean',year:'mean'},{staticValue:()=>n(c?.elev),note:'场址静态属性，不绘制虚假的时间趋势。'}),
  metric('pressure_mean','平均气压','kPa','真实数据','ERA5表面气压',press,{month:'mean',year:'mean'},{axisGroup:'pressure',defaultSelected:true}),
  metric('air_density','空气密度','kg/m³','工程派生','ERA5表面气压+温度',()=>airDensityPoints(h),{month:'mean',year:'mean'},{axisGroup:'air_density',defaultSelected:true,supplemental:true}),
  metric('altitude_margin','设计能力裕量','m','工程派生','设计海拔能力-场址高程',()=>[],{month:'mean',year:'mean'},{staticValue:()=>n(p.capAltitude)-n(c?.elev),note:'静态设计裕量，不绘制时间趋势。'})
 ]},
 {module:'SO₂ / 腐蚀气体',indicators:[
  metric('so2_p95','SO₂ P95','μg/m³','真实数据','CAMS Global sulphur_dioxide',so2,{month:'p95',year:'p95'},{axisGroup:'so2',defaultSelected:true,design:{upper:()=>n(p.capSo2),label:'SO₂ P95限值'}}),
  metric('so2_p99','SO₂ P99','μg/m³','真实数据','CAMS Global sulphur_dioxide',so2,{month:'p99',year:'p99'},{axisGroup:'so2',defaultSelected:true,design:{upper:()=>n(p.capSo2),label:'SO₂设计参考'}}),
  un('h2s_p95','H₂S P95','μg/m³','待接H₂S监测/再分析数据'),un('h2s_p99','H₂S P99','μg/m³','待接H₂S监测/再分析数据')
 ]},
 {module:'冰雪冻雨',indicators:[
  un('ice_hours','年覆冰小时数','h/y','待接真实覆冰事件/传感器数据','温湿条件不能替代覆冰事实。'),un('ice_thickness_p95','覆冰厚度P95','mm','待接覆冰厚度监测/液态含水量模型'),un('ice_thickness_p99','覆冰厚度P99','mm','待接覆冰厚度监测/液态含水量模型'),
  metric('snow_daily_max','最大日降雪','cm/d','真实数据','ERA5逐日降雪',snow,{month:'max',year:'max'},{axisGroup:'snow',defaultSelected:true,design:{upper:()=>n(p.capSnow),label:'最大日降雪能力'},supplemental:true,note:'作为冰雪环境真实参考；不等同于覆冰厚度或冻雨事件。'}),
  metric('snow_total','累计降雪',g=>g==='year'?'cm/y':'cm/月','真实数据','ERA5逐日降雪',snow,{month:'sum',year:'sum'},{axisGroup:'snow_total',supplemental:true})
 ]},
 {module:'太阳辐照',indicators:[
  metric('solar_total','年总辐照量',g=>g==='year'?'kWh/m²·y':'kWh/m²·月','真实数据','ERA5 shortwave_radiation',()=>solarHourlyEnergyPoints(h),{month:'sum',year:'sum'},{axisGroup:'solar',defaultSelected:true}),
  metric('solar_extreme','极端高辐照','W/m²','真实数据','ERA5 shortwave_radiation',()=>cleanPairs(h.time||[],h.shortwave_radiation||[]),{month:'p99',year:'p99'},{axisGroup:'solar_power',defaultSelected:true,supplemental:true}),
  un('uv_b_dose','UV-B紫外剂量','J/m²','待接UV-B光谱辐照数据')
 ]},
 {module:'生物环境',indicators:[
  metric('mold_hours','霉菌年生长小时数',g=>g==='year'?'h/y':'h/月','工程派生','ERA5温度+相对湿度',()=>moldPotentialPoints(h),{month:'sum',year:'sum'},{axisGroup:'mold',defaultSelected:true,note:'准确含义为“霉菌生长潜势小时”，不等同于实际霉菌观测。'}),
  un('bio_risk_score','飞絮/昆虫风险得分','0-100','待接物候/植被/虫情数据库')
 ]},
 {module:'雷电',indicators:[un('lightning_density','地闪密度','次/km²·y','待接全球/区域雷电定位网'),un('thunder_hours','年雷电小时数','h/y','待接雷电事件时间序列'),un('lightning_count','雷电次数','次/期','待接雷电事件时间序列')]}
 ]
}
function unitOf(ind,gran){return typeof ind.unit==='function'?ind.unit(gran):ind.unit}
function designOf(ind){if(!ind.design)return null;const out={label:ind.design.label||'设计能力'};if(typeof ind.design.upper==='function')out.upper=ind.design.upper();else if(observed(ind.design.upper))out.upper=Number(ind.design.upper);if(typeof ind.design.lower==='function')out.lower=ind.design.lower();else if(observed(ind.design.lower))out.lower=Number(ind.design.lower);if(!finite(out.upper))delete out.upper;if(!finite(out.lower))delete out.lower;return Object.keys(out).length>1?out:null}
function prepareIndicator(moduleName,key,{granularity='month'}={}){
 const mod=moduleCatalog().find(m=>m.module===moduleName);if(!mod)return null;const ind=mod.indicators.find(x=>x.key===key);if(!ind)return null;let raw=[];try{raw=dedupe(ind.build?.()||[])}catch(e){console.error('[GE Trend V2] series build failed',moduleName,key,e)}const mode=ind.aggregation?.[granularity]||'mean',series=aggregate(raw,granularity,mode),unit=unitOf(ind,granularity),design=designOf(ind),analysis=analyzeEnvironmentalTrend(series,{unit,years:selectedYears(),design}),staticValue=typeof ind.staticValue==='function'?ind.staticValue():ind.staticValue,coverage=raw.length?{start:raw[0].time,end:raw.at(-1).time,count:raw.length}:null,trendAvailable=series.length>=1;
 return{...ind,module:moduleName,unit,granularity,raw,series,analysis,design,staticValue:observed(staticValue)?Number(staticValue):null,coverage,trendAvailable,requestedYears:selectedYears(),aggregationMethod:mode}
}
function prepareModule(moduleName,{granularity='month'}={}){const mod=moduleCatalog().find(m=>m.module===moduleName);if(!mod)return null;const indicators=mod.indicators.map(i=>prepareIndicator(moduleName,i.key,{granularity}));const available=indicators.filter(i=>i?.trendAvailable),defaults=available.filter(i=>i.defaultSelected).slice(0,3).map(i=>i.key);return{module:moduleName,granularity,requestedYears:selectedYears(),indicators,defaultSelected:defaults.length?defaults:available.slice(0,3).map(i=>i.key)}}
function coreModuleNames(){const core=window.GE_CORE_ENVIRONMENT_DATA?.modules;if(Array.isArray(core)&&core.length)return core.map(x=>x.module);return moduleCatalog().map(x=>x.module)}
function syncCoreTrendMetadata(){const core=window.GE_CORE_ENVIRONMENT_DATA?.modules;if(!Array.isArray(core))return false;const cat=moduleCatalog();core.forEach(cm=>{const mod=cat.find(m=>m.module===cm.module);if(!mod)return;(cm.indicators||[]).forEach(ci=>{const ind=mod.indicators.find(i=>i.name===ci.name);if(ind)ci.trend={metricKey:ind.key,trendAvailable:ind.dataClass!=='未接入',dataClass:ind.dataClass,trendAggregation:ind.aggregation,rawDataSource:ind.source,designLimit:ind.design?.label||null}})});return true}
function conclusion(prepared){if(!prepared)return'无有效指标。';if(prepared.dataClass==='未接入')return `${prepared.name}当前未接入真实时间序列，不生成模拟趋势。`;if(prepared.staticValue!==null&&!prepared.series.length)return `${prepared.name}为静态参考值 ${prepared.staticValue} ${prepared.unit}，不绘制虚假的时间趋势。`;const a=prepared.analysis;if(!a?.valid)return `${prepared.name}有效周期数据不足，暂无法判断趋势。`;const slope=finite(a.slopePerYear)?`${a.slopePerYear>=0?'+':''}${a.slopePerYear.toFixed(Math.abs(a.slopePerYear)<1?3:2)} ${prepared.unit}/year`:'--',sig=a.significant?'达到统计显著':'未达到统计显著';let gap='';if(prepared.design&&a.designViolationCount){gap=`；有 ${a.designViolationCount} 个${prepared.granularity==='year'?'年度':'月度'}统计周期超出设计能力，最大超限 ${a.maxDesignExceedance.toFixed(2)} ${prepared.unit}`;}else if(prepared.design)gap='；当前统计周期未发现设计能力超限';return `${prepared.requestedYears===1?'本评估周期内':'多年度'}${prepared.name}${a.trendDirection==='无显著趋势'?'未发现显著趋势':`呈${a.trendDirection}趋势`}，Sen斜率 ${slope}，Mann-Kendall ${sig}${finite(a.pValue)?`（p=${a.pValue.toFixed(3)}）`:''}${gap}。`}
window.GETrendAnalysis={version:'2.0.0-secondary-indicators',dataQualityGuard:'null-excluded',coreModuleNames,moduleCatalog,prepareModule,prepareIndicator,analyzeEnvironmentalTrend,aggregate,moving,percentile,cleanPairs,conclusion,syncCoreTrendMetadata,selectedYears};
setTimeout(syncCoreTrendMetadata,0);setTimeout(syncCoreTrendMetadata,1200);
})();
