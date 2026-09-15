/* Global Environment Platform - core environment trend analysis
 * Real-series only: reads existing cache/current/params without inventing data.
 */
(()=>{
'use strict';
const finite=v=>Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):NaN;
const cleanPairs=(times,values,transform)=>{
 const n=Math.min(Array.isArray(times)?times.length:0,Array.isArray(values)?values.length:0),out=[];
 for(let i=0;i<n;i++){
  const v=num(values[i]); if(!finite(v))continue;
  const d=new Date(times[i]); if(!Number.isFinite(d.getTime()))continue;
  const y=transform?transform(v,i):v; if(!finite(y))continue;
  out.push({time:d.toISOString(),ts:d.getTime(),value:Number(y)});
 }
 return dedupe(out);
};
function dedupe(points){const m=new Map();points.forEach(p=>m.set(p.ts,p));return [...m.values()].sort((a,b)=>a.ts-b.ts)}
function globals(){let c=null,cur={},p={};try{c=cache}catch{}try{cur=current||{}}catch{}try{p=params||{}}catch{}return{c,cur,p}}
function selectedYears(){const el=globalThis.document?.getElementById?.('years');const v=Number(el?.value);return [1,3,5].includes(v)?v:3}
function mean(a){return a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN}
function std(a){if(!a.length)return NaN;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length)}
function percentile(a,p){if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y),k=(s.length-1)*p,l=Math.floor(k),h=Math.ceil(k);return l===h?s[l]:s[l]+(s[h]-s[l])*(k-l)}
function median(a){return percentile(a,.5)}
function intervalHours(points){if(points.length<2)return NaN;const diffs=[];for(let i=1;i<points.length;i++){const h=(points[i].ts-points[i-1].ts)/36e5;if(h>0&&h<24*40)diffs.push(h)}return median(diffs)}
function startOfWeekUTC(d){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())),day=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-day);return x}
function bucketKey(d,gran){if(gran==='month')return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-01`;if(gran==='week')return startOfWeekUTC(d).toISOString().slice(0,10);return d.toISOString().slice(0,10)}
function aggregate(points,gran='day',mode='mean'){
 const g=new Map();points.forEach(p=>{const d=new Date(p.ts),k=bucketKey(d,gran);if(!g.has(k))g.set(k,[]);g.get(k).push(p.value)});
 return [...g.entries()].map(([k,a])=>{const d=new Date(k+'T00:00:00Z');let v=mode==='max'?Math.max(...a):mode==='min'?Math.min(...a):mode==='sum'?a.reduce((s,x)=>s+x,0):mean(a);return{time:d.toISOString(),ts:d.getTime(),value:v}}).sort((a,b)=>a.ts-b.ts);
}
function moving(points,n){if(!points.length)return[];const out=[],queue=[];let sum=0;for(const p of points){queue.push(p.value);sum+=p.value;if(queue.length>n)sum-=queue.shift();out.push({...p,value:sum/queue.length})}return out}
function sample(points,maxN=480){if(points.length<=maxN)return points;const out=[];for(let i=0;i<maxN;i++){const idx=Math.round(i*(points.length-1)/(maxN-1));out.push(points[idx])}return dedupe(out)}
function linearRegression(points){if(points.length<2)return{slopePerYear:NaN,intercept:NaN};const t0=points[0].ts,year=365.2425*864e5,x=points.map(p=>(p.ts-t0)/year),y=points.map(p=>p.value),xm=mean(x),ym=mean(y);let n=0,d=0;for(let i=0;i<x.length;i++){n+=(x[i]-xm)*(y[i]-ym);d+=(x[i]-xm)**2}const slope=d?n/d:NaN;return{slopePerYear:slope,intercept:finite(slope)?ym-slope*xm:NaN,t0}}
function erf(x){const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a);return sign*y}
function normalCdf(z){return .5*(1+erf(z/Math.SQRT2))}
function mannKendall(points){const a=sample(points,480).map(p=>p.value),n=a.length;if(n<8)return{z:NaN,p:NaN,s:NaN};let S=0;for(let i=0;i<n-1;i++)for(let j=i+1;j<n;j++)S+=Math.sign(a[j]-a[i]);const counts=new Map();a.forEach(v=>counts.set(v,(counts.get(v)||0)+1));let tie=0;counts.forEach(t=>{if(t>1)tie+=t*(t-1)*(2*t+5)});const varS=(n*(n-1)*(2*n+5)-tie)/18;if(varS<=0)return{z:0,p:1,s:S};const z=S>0?(S-1)/Math.sqrt(varS):S<0?(S+1)/Math.sqrt(varS):0,p=2*(1-normalCdf(Math.abs(z)));return{z,p:Math.max(0,Math.min(1,p)),s:S}}
function senSlope(points){const a=sample(points,480),year=365.2425*864e5,slopes=[];for(let i=0;i<a.length-1;i++)for(let j=i+1;j<a.length;j++){const dt=(a[j].ts-a[i].ts)/year;if(dt>0)slopes.push((a[j].value-a[i].value)/dt)}return median(slopes)}
function seasonalAnomalies(points){const monthly=aggregate(points,'month','mean');if(monthly.length<24)return monthly;const clim=Array.from({length:12},()=>[]);monthly.forEach(p=>clim[new Date(p.ts).getUTCMonth()].push(p.value));const cm=clim.map(mean);return monthly.map(p=>({...p,value:p.value-cm[new Date(p.ts).getUTCMonth()]}))}
function granularity(points,years){if(!points.length)return'day';const span=(points.at(-1).ts-points[0].ts)/(365.2425*864e5);if(span>=3.5||years>=5&&span>=2)return'month';if(span>=1.4||years>=3&&span>=1)return'week';return'day'}
function trendBasis(points,years){const span=points.length>1?(points.at(-1).ts-points[0].ts)/(365.2425*864e5):0;if(years>=3&&span>=2)return{points:seasonalAnomalies(points),label:'多年度去季节趋势'};return{points:aggregate(points,span>.7?'week':'day','mean'),label:span>=2?'多年度趋势':'周期内变化趋势'}}
function analyzeEnvironmentalTrend(points,{unit='',years=selectedYears()}={}){
 const p=dedupe(points||[]),vals=p.map(x=>x.value);if(vals.length<3)return{valid:false,count:vals.length};
 const avg=mean(vals),sd=std(vals),p95=percentile(vals,.95),p99=percentile(vals,.99),mx=Math.max(...vals),mn=Math.min(...vals),maxPoint=p.find(x=>x.value===mx),minPoint=p.find(x=>x.value===mn),basis=trendBasis(p,years),reg=linearRegression(basis.points),mk=mannKendall(basis.points),sen=senSlope(basis.points),slope=finite(sen)?sen:reg.slopePerYear;
 const significant=finite(mk.p)&&mk.p<.05,dir=significant?(slope>0?'上升':slope<0?'下降':'稳定'):'无显著趋势';
 const cv=Math.abs(avg)>1e-12?sd/Math.abs(avg):NaN,vol=!finite(cv)?'--':cv<.1?'低':cv<.3?'中':'高',ih=intervalHours(p),exceed=p.filter(x=>x.value>p95).length;
 return{valid:true,count:vals.length,current:vals.at(-1),mean:avg,min:mn,max:mx,p95,p99,std:sd,cv,slopePerYear:slope,linearSlopePerYear:reg.slopePerYear,trendDirection:dir,significant,pValue:mk.p,z:mk.z,volatility:vol,maxPoint,minPoint,exceedP95Count:exceed,exceedP95Hours:finite(ih)?exceed*ih:NaN,trendBasis:basis.label,unit};
}
function dailyEnergyFromHourly(times,vals,scale=1/1000){const pts=cleanPairs(times,vals,v=>v*scale);return aggregate(pts,'day','sum')}
function dailyBio(h){const t=h.time||[],T=h.temperature_2m||[],RH=h.relative_humidity_2m||[],n=Math.min(t.length,T.length,RH.length),pts=[];for(let i=0;i<n;i++){const d=new Date(t[i]);if(!finite(T[i])||!finite(RH[i])||!Number.isFinite(d.getTime()))continue;pts.push({time:d.toISOString(),ts:d.getTime(),value:Number(T[i])>20&&Number(RH[i])>80?1:0})}return aggregate(pts,'day','sum')}
function configFor(moduleName){
 const {c,p}=globals(),h=c?.w?.j?.hourly||{},d=c?.w?.j?.daily||{},aq=c?.aq?.j?.hourly||{},weatherTime=h.time||[],dailyTime=d.time||[],aqTime=aq.time||[];
 const base={module:moduleName,years:selectedYears(),mode:'Historical / cached real series'};
 switch(moduleName){
  case'温度':return{...base,metricKey:'temperature_2m',metricName:'2 m空气温度',unit:'℃',source:'ERA5 Archive',points:cleanPairs(weatherTime,h.temperature_2m),aggregation:'mean',design:{upper:num(p.capHigh),lower:num(p.capLow)},note:'温度趋势使用ERA5真实小时序列；3/5年趋势采用月尺度去季节异常。'};
  case'湿度':return{...base,metricKey:'relative_humidity_2m',metricName:'相对湿度',unit:'%',source:'ERA5 Archive',points:cleanPairs(weatherTime,h.relative_humidity_2m),aggregation:'mean',design:{upper:num(p.capRh)},note:'高湿风险卡片下钻为真实相对湿度序列；RH>90%时长仍由主模型统计。'};
  case'降雨':return{...base,metricKey:'precipitation_sum',metricName:'日降雨量',unit:'mm/d',source:'ERA5 Archive',points:cleanPairs(dailyTime,d.precipitation_sum),aggregation:'mean',design:{upper:num(p.capRainDay)},note:'使用ERA5真实逐日降雨量；图表聚合仅用于展示，统计仍基于逐日原始值。'};
  case'PM10 / 颗粒物':return{...base,metricKey:'pm10',metricName:'PM10浓度',unit:'μg/m³',source:'CAMS Global',points:cleanPairs(aqTime,aq.pm10),aggregation:'mean',design:{upper:num(p.capPm)},note:`当前主程序CAMS缓存窗口约${num(p.camsDays)||90}天；超出该窗口不伪造历史数据。`};
  case'风速':return{...base,metricKey:'wind_speed_10m',metricName:'10 m风速',unit:'m/s',source:'ERA5 Archive',points:cleanPairs(weatherTime,h.wind_speed_10m),aggregation:'mean',design:null,note:'当前ERA5请求未包含真实阵风序列，因此趋势图展示真实10 m平均风速，不用估算阵风冒充实测。'};
  case'盐雾':{const k=num(p.saltVd)*86400/1000*num(p.saltClFrac);return{...base,metricKey:'cl_dep_rate',metricName:'Cl⁻干沉降等效速率',unit:'mg/m²·d',source:'CAMS sea_salt_aerosol + 当前沉降参数',points:cleanPairs(aqTime,aq.sea_salt_aerosol,v=>v*k),aggregation:'mean',design:{upper:num(p.capCl)},note:`由真实CAMS海盐浓度逐小时按Vd=${num(p.saltVd)} m/s、fCl=${num(p.saltClFrac)}换算；当前CAMS窗口约${num(p.camsDays)||90}天。`}}
  case'海拔':return{...base,metricKey:'surface_pressure',metricName:'表面气压（海拔关联量）',unit:'kPa',source:'ERA5 Archive',points:cleanPairs(weatherTime,h.surface_pressure,v=>v/10),aggregation:'mean',design:null,note:'海拔是静态GIS属性，不存在时间趋势；此卡下钻展示与高海拔热管理直接相关的真实表面气压变化。'};
  case'SO₂ / 腐蚀气体':return{...base,metricKey:'sulphur_dioxide',metricName:'SO₂浓度',unit:'μg/m³',source:'CAMS Global',points:cleanPairs(aqTime,aq.sulphur_dioxide),aggregation:'mean',design:{upper:num(p.capSo2)},note:`当前主程序CAMS缓存窗口约${num(p.camsDays)||90}天；H₂S尚未接入，绝不生成模拟曲线。`};
  case'冰雪冻雨':return{...base,metricKey:'snowfall_sum',metricName:'日降雪量',unit:'cm/d',source:'ERA5 Archive',points:cleanPairs(dailyTime,d.snowfall_sum),aggregation:'mean',design:{upper:num(p.capSnow)},note:'真实覆冰厚度/冻雨事件尚未接入；本卡仅展示ERA5真实逐日降雪量趋势。'};
  case'太阳辐照':return{...base,metricKey:'solar_daily_energy',metricName:'日总短波辐照量',unit:'kWh/m²·d',source:'ERA5 shortwave_radiation',points:dailyEnergyFromHourly(weatherTime,h.shortwave_radiation),aggregation:'mean',design:null,note:'由真实ERA5小时短波辐射积分得到日总辐照量；不使用模拟太阳辐射。'};
  case'生物环境':return{...base,metricKey:'mold_potential_hours',metricName:'霉菌生长潜势小时',unit:'h/d',source:'ERA5温度 + 相对湿度（工程判据）',points:dailyBio(h),aggregation:'mean',design:null,note:'这是由真实温湿度按T>20℃且RH>80%的既有工程判据得到的潜势时长，不等同于现场霉菌观测。'};
  case'雷电':return{...base,metricKey:'lightning',metricName:'雷电',unit:'',source:'待接全球/区域雷电定位网',points:[],aggregation:'mean',design:null,note:'当前平台未接入真实雷电事件时间序列，因此不绘制、不估算、不生成模拟曲线。'};
  default:return{...base,metricKey:'unknown',metricName:moduleName,unit:'',source:'未配置',points:[],aggregation:'mean',design:null,note:'未找到对应真实时间序列。'};
 }
}
function prepare(moduleName){const cfg=configFor(moduleName),points=cfg.points||[],years=cfg.years,gran=granularity(points,years),display=aggregate(points,gran,cfg.aggregation||'mean'),smoothA=moving(display,gran==='month'?3:gran==='week'?4:7),smoothB=moving(display,gran==='month'?12:gran==='week'?13:30),analysis=analyzeEnvironmentalTrend(points,{unit:cfg.unit,years}),reg=linearRegression(display),trendLine=display.map(p=>{if(!finite(reg.slopePerYear))return{...p,value:NaN};const year=365.2425*864e5,x=(p.ts-display[0].ts)/year;return{...p,value:reg.intercept+reg.slopePerYear*x}});return{...cfg,granularity:gran,display,smoothA,smoothB,trendLine,analysis,coverage:points.length?{start:points[0].time,end:points.at(-1).time,count:points.length}:null,smoothLabels:gran==='month'?['3月均','12月均']:gran==='week'?['4周均','13周均']:['7日均','30日均']}}
function conclusion(ds){const a=ds.analysis;if(!a?.valid)return ds.note||'有效数据不足，暂无法判断趋势。';const years=ds.years,span=ds.coverage?(new Date(ds.coverage.end)-new Date(ds.coverage.start))/(365.2425*864e5):0,scope=years===1||span<2?'周期内':'多年度',sign=a.significant?`Mann-Kendall检验显著（p=${a.pValue.toFixed(3)}）`:`Mann-Kendall检验未达显著水平（p=${finite(a.pValue)?a.pValue.toFixed(3):'--'}）`,slope=finite(a.slopePerYear)?`${a.slopePerYear>=0?'+':''}${a.slopePerYear.toFixed(Math.abs(a.slopePerYear)<1?3:2)} ${ds.unit}/year`:'--';return `${scope}${ds.metricName}${a.trendDirection==='无显著趋势'?'未发现显著单调趋势':`呈${a.trendDirection}趋势`}，Sen斜率约 ${slope}，${sign}。波动程度${a.volatility}。${ds.note||''}`}
window.GETrendAnalysis={prepare,analyzeEnvironmentalTrend,aggregate,moving,conclusion,configFor,version:'2026.09.15-trend1'};
})();
