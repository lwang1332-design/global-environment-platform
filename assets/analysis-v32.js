/* Global Environment Platform V3.2 - metric science extensions
 * Adds unified coverage, design-gap, exceedance-event, confidence,
 * deseasonalized trend, correlation, range statistics and CSV export.
 */
(()=>{
'use strict';
const A=window.GETrendAnalysis;
if(!A||A.scienceV32)return;
const HOUR=36e5,DAY=864e5,YEAR=365.2425*DAY;
const finite=Number.isFinite;
const observed=v=>v!==null&&v!==''&&finite(Number(v));
const num=v=>observed(v)?Number(v):NaN;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
function pct(a,p){const s=(a||[]).filter(finite).slice().sort((x,y)=>x-y);if(!s.length)return NaN;const k=(s.length-1)*p,l=Math.floor(k),h=Math.ceil(k);return l===h?s[l]:s[l]+(s[h]-s[l])*(k-l)}
function isoDate(v){const d=new Date(v);return finite(d.getTime())?d.toISOString().slice(0,10):null}
function selectedYears(){return A.selectedYears?A.selectedYears():Number(document.getElementById('years')?.value)||1}
function requestWindow(){
 let end=null;
 try{end=window.cache?.w?.end||window.cache?.aq?.requestedEnd||window.cache?.aq?.end}catch{}
 const ed=end?new Date(end+'T23:59:59Z'):new Date(Date.now()-10*DAY);
 const st=new Date(ed);st.setUTCFullYear(st.getUTCFullYear()-selectedYears());
 return{start:st.getTime(),end:ed.getTime(),startText:isoDate(st),endText:isoDate(ed)};
}
function resolutionHours(points){
 const a=(points||[]).filter(p=>finite(p?.ts)).sort((x,y)=>x.ts-y.ts),d=[];
 for(let i=1;i<a.length;i++){const h=(a[i].ts-a[i-1].ts)/HOUR;if(h>0&&h<24*40)d.push(h)}
 return d.length?pct(d,.5):NaN;
}
function coverageMeta(i){
 const w=requestWindow(),c=i?.coverage,actualStart=c?.start?new Date(c.start).getTime():NaN,actualEnd=c?.end?new Date(c.end).getTime():NaN;
 let period=0;
 if(finite(actualStart)&&finite(actualEnd)){
   const overlap=Math.max(0,Math.min(w.end,actualEnd)-Math.max(w.start,actualStart));
   period=Math.max(0,Math.min(100,100*overlap/Math.max(1,w.end-w.start)));
 }
 let completeness=0;
 const raw=i?.raw||i?.series||[],rh=resolutionHours(raw);
 if(raw.length===1)completeness=100;
 else if(raw.length>1&&finite(rh)&&finite(actualStart)&&finite(actualEnd)){
   const expected=(actualEnd-actualStart)/(rh*HOUR)+1;
   completeness=Math.max(0,Math.min(100,100*raw.length/Math.max(1,expected)));
 }
 return{requestedStart:w.startText,requestedEnd:w.endText,actualStart:isoDate(actualStart),actualEnd:isoDate(actualEnd),periodCoveragePercent:period,dataCompletenessPercent:completeness,resolutionHours:rh};
}
function dataCode(i){
 const s=String(i?.originalDataClass||i?.dataClass||''),src=String(i?.source||'');
 if(s==='未接入'||String(i?.accessStatus||'').startsWith('E'))return'N/A';
 if(s.includes('GIS')||s.includes('静态'))return'GIS';
 if(s.includes('模型值'))return'ENG';
 if(s.includes('派生')||s.includes('统计'))return'DERIVED';
 if(/CAMS/i.test(src))return'MODEL';
 if(/ERA5|reanalysis|再分析|历史档案/i.test(src))return'REA';
 if(/站|观测|sensor|SCADA/i.test(src))return'OBS';
 if(s.includes('模式'))return'MODEL';
 return i?.trendAvailable?'DERIVED':'N/A';
}
function confidence(i,cov){
 const code=dataCode(i),base={OBS:95,REA:88,MODEL:82,DERIVED:80,ENG:72,GIS:90,'N/A':0}[code]??60;
 if(code==='N/A')return{score:0,grade:'N/A',label:'未接入'};
 const pc=finite(cov.periodCoveragePercent)?cov.periodCoveragePercent:0,dc=finite(cov.dataCompletenessPercent)?cov.dataCompletenessPercent:0;
 let score=base*(0.55+0.25*pc/100+0.20*dc/100);
 if(i?.confidence==='C')score-=12;if(i?.confidence==='D')score-=20;
 score=Math.max(0,Math.min(100,score));
 return{score,grade:score>=88?'A':score>=75?'B':score>=60?'C':'D',label:score>=88?'高':score>=75?'较高':score>=60?'中':'有限'};
}
function normalizeDesign(design){
 if(!design)return null;
 const d={...design};
 if(observed(d.upper)&&observed(d.lower))d.type='range';
 else if(observed(d.upper))d.type='upper';
 else if(observed(d.lower))d.type='lower';
 else if(observed(d.target))d.type='target';
 else if(typeof d.pass==='boolean')d.type='boolean';
 return d.type?d:null;
}
function designEval(value,design){
 const d=normalizeDesign(design);if(!observed(value)||!d)return null;const v=Number(value),out={type:d.type,value:v,pass:true,gap:0,margin:null,limitText:''};
 if(d.type==='upper'){const lim=Number(d.upper);out.gap=v-lim;out.pass=out.gap<=0;out.margin=lim-v;out.limit=lim;out.limitText='≤ '+lim}
 else if(d.type==='lower'){const lim=Number(d.lower);out.gap=lim-v;out.pass=out.gap<=0;out.margin=v-lim;out.limit=lim;out.limitText='≥ '+lim}
 else if(d.type==='range'){const lo=Number(d.lower),hi=Number(d.upper);out.lower=lo;out.upper=hi;out.limitText=lo+' ～ '+hi;if(v<lo){out.pass=false;out.gap=lo-v;out.margin=v-lo;out.side='lower'}else if(v>hi){out.pass=false;out.gap=v-hi;out.margin=hi-v;out.side='upper'}else{out.margin=Math.min(v-lo,hi-v)}}
 else if(d.type==='target'){const t=Number(d.target),tol=observed(d.tolerance)?Number(d.tolerance):0;out.limitText=t+' ± '+tol;out.gap=Math.abs(v-t)-tol;out.pass=out.gap<=0;out.margin=tol-Math.abs(v-t)}
 else if(d.type==='boolean'){out.pass=!!d.pass;out.gap=out.pass?0:1;out.margin=out.pass?1:0;out.limitText=d.label||'判据'}
 return out;
}
function pointViolation(p,design){const e=designEval(p?.value,design);return e&&!e.pass?Math.abs(e.gap):0}
function exceedanceEvents(points,design){
 const a=(points||[]).filter(p=>finite(p?.ts)&&observed(p?.value)).sort((x,y)=>x.ts-y.ts);
 if(!a.length||!design)return{count:0,totalHours:0,longestHours:0,maxGap:0,p95Gap:0,first:null,last:null,events:[]};
 const dt=finite(resolutionHours(a))?resolutionHours(a):1,events=[];let cur=null,total=0;
 for(const p of a){
   const gap=pointViolation(p,design),bad=gap>0;
   if(bad){
     total+=dt;
     if(!cur||p.ts-cur.lastTs>dt*HOUR*1.8){if(cur)events.push(cur);cur={start:p.ts,end:p.ts,lastTs:p.ts,hours:dt,maxGap:gap,gaps:[gap]}}
     else{cur.end=p.ts;cur.lastTs=p.ts;cur.hours+=dt;cur.maxGap=Math.max(cur.maxGap,gap);cur.gaps.push(gap)}
   }else if(cur){events.push(cur);cur=null}
 }
 if(cur)events.push(cur);
 events.forEach(e=>{e.p95Gap=pct(e.gaps,.95);delete e.lastTs;delete e.gaps;e.startText=new Date(e.start).toISOString();e.endText=new Date(e.end).toISOString()});
 return{count:events.length,totalHours:total,longestHours:events.length?Math.max(...events.map(e=>e.hours)):0,maxGap:events.length?Math.max(...events.map(e=>e.maxGap)):0,p95Gap:events.length?pct(events.flatMap(e=>[e.p95Gap]),.95):0,first:events[0]?.startText||null,last:events.at(-1)?.endText||null,events};
}
function monthlyAnomaly(points){
 const a=(points||[]).filter(p=>finite(p?.ts)&&observed(p?.value));if(!a.length)return[];
 const groups=new Map();
 for(const p of a){const d=new Date(p.ts),k=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(Number(p.value))}
 const monthly=[...groups.entries()].map(([k,v])=>{const y=Number(k.slice(0,4)),m=Number(k.slice(5,7))-1,ts=Date.UTC(y,m,15);return{ts,time:new Date(ts).toISOString(),month:m,value:mean(v)}}).sort((x,y)=>x.ts-y.ts);
 const clim=new Map();for(let m=0;m<12;m++){const vals=monthly.filter(x=>x.month===m).map(x=>x.value);if(vals.length)clim.set(m,mean(vals))}
 return monthly.map(p=>({...p,value:p.value-(clim.get(p.month)??0)}));
}
function trendMeta(i){
 const raw=i?.raw||i?.series||[],months=monthlyAnomaly(raw);
 const a=months.length>=8&&A.analyzeEnvironmentalTrend?A.analyzeEnvironmentalTrend(months,{unit:i.unit}):null;
 return{displaySeries:'raw',statSeries:'monthly-deseasonalized',monthlyPoints:months.length,analysis:a,method:'原始时序用于显示；月均去季节化异常序列用于Mann-Kendall / Sen slope'};
}
function subset(points,start,end){return(points||[]).filter(p=>finite(p?.ts)&&p.ts>=start&&p.ts<=end&&observed(p?.value))}
function rangeStats(i,start,end){
 const a=subset(i?.raw||i?.series||[],start,end),v=a.map(p=>Number(p.value));if(!v.length)return{count:0};
 const design=i?.design;const ev=exceedanceEvents(a,design);
 return{count:v.length,start:new Date(a[0].ts).toISOString(),end:new Date(a.at(-1).ts).toISOString(),mean:mean(v),min:Math.min(...v),max:Math.max(...v),p95:pct(v,.95),p99:pct(v,.99),events:ev};
}
function normalizeSeries(points,mode='minmax'){
 const a=(points||[]).filter(p=>observed(p?.value));if(!a.length)return[];
 const v=a.map(p=>Number(p.value)),lo=Math.min(...v),hi=Math.max(...v),m=mean(v),sd=Math.sqrt(mean(v.map(x=>(x-m)**2)))||1;
 return a.map(p=>({...p,rawValue:Number(p.value),value:mode==='zscore'?(Number(p.value)-m)/sd:hi===lo?0.5:(Number(p.value)-lo)/(hi-lo)}));
}
function nearest(points,ts,tol){
 if(!points?.length)return null;let lo=0,hi=points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(points[mid].ts<ts)lo=mid+1;else hi=mid}const a=points[lo],b=lo>0?points[lo-1]:null,p=!b||Math.abs(a.ts-ts)<Math.abs(b.ts-ts)?a:b;return p&&Math.abs(p.ts-ts)<=tol?p:null;
}
function pearson(x,y){
 if(x.length<3||y.length!==x.length)return NaN;const mx=mean(x),my=mean(y);let top=0,dx=0,dy=0;for(let i=0;i<x.length;i++){const a=x[i]-mx,b=y[i]-my;top+=a*b;dx+=a*a;dy+=b*b}return dx&&dy?top/Math.sqrt(dx*dy):NaN;
}
function alignSeries(a,b,lagHours=0){
 const A0=(a?.raw||a?.series||[]).filter(p=>finite(p?.ts)&&observed(p?.value)).sort((x,y)=>x.ts-y.ts),B0=(b?.raw||b?.series||[]).filter(p=>finite(p?.ts)&&observed(p?.value)).sort((x,y)=>x.ts-y.ts);
 const ra=resolutionHours(A0),rb=resolutionHours(B0),tol=Math.max(finite(ra)?ra:1,finite(rb)?rb:1)*HOUR*1.7,lag=lagHours*HOUR,x=[],y=[];
 for(const p of A0){const q=nearest(B0,p.ts+lag,tol);if(q){x.push(Number(p.value));y.push(Number(q.value))}}
 return{x,y,count:x.length};
}
function correlation(a,b){
 const z=alignSeries(a,b,0);return{r:pearson(z.x,z.y),count:z.count};
}
function lagCorrelation(a,b,lags=[-168,-72,-24,0,24,72,168]){
 const rows=lags.map(l=>{const z=alignSeries(a,b,l);return{lagHours:l,r:pearson(z.x,z.y),count:z.count}}).filter(x=>finite(x.r));
 rows.sort((x,y)=>Math.abs(y.r)-Math.abs(x.r));return{best:rows[0]||null,rows};
}
function csvEscape(v){const s=String(v??'');return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(indicators,start,end){
 const inds=(indicators||[]).filter(i=>i?.trendAvailable),timestamps=new Set();
 inds.forEach(i=>subset(i.raw||i.series||[],start,end).forEach(p=>timestamps.add(p.ts)));
 const ts=[...timestamps].sort((a,b)=>a-b),rows=[['timestamp',...inds.map(i=>i.name+' ['+i.unit+']')]];
 const maps=inds.map(i=>new Map((i.raw||i.series||[]).map(p=>[p.ts,p.value])));
 ts.forEach(t=>rows.push([new Date(t).toISOString(),...maps.map(m=>m.has(t)?m.get(t):'')]));
 rows.push([]);rows.push(['metadata']);inds.forEach(i=>rows.push([i.name,i.source,i.dataCode,i.accessStatus,'confidence '+(i.confidenceMeta?.grade||''),'formula '+(i.formula||''),'requested '+(i.coverageMeta?.requestedStart||'')+'~'+(i.coverageMeta?.requestedEnd||''),'actual '+(i.coverageMeta?.actualStart||'')+'~'+(i.coverageMeta?.actualEnd||'')]));
 return rows.map(r=>r.map(csvEscape).join(',')).join('\n');
}

function globalParams(){try{return window.params||params||{}}catch{return{}}}
function globalCache(){try{return window.cache||cache||{}}catch{return{}}}
function supplemental(module,key){
 const p=globalParams(),cc=globalCache(),H=cc?.w?.j?.hourly||{},D=cc?.w?.j?.daily||{};
 const mk=(name,unit,raw,summaryValue,opts={})=>({module,key,id:module+'::'+key,name,unit,summaryUnit:unit,dataClass:opts.dataClass||'统计派生值',originalDataClass:opts.originalDataClass||opts.dataClass||'统计派生值',source:opts.source||'统一Metric Registry派生',sourceVariable:opts.sourceVariable||'',raw,series:raw,trendAvailable:raw.length>0,summaryValue:observed(summaryValue)?Number(summaryValue):null,staticValue:null,coverage:raw.length?{start:raw[0].time,end:raw.at(-1).time,count:raw.length,resolution:opts.resolution||'按源数据'}:null,accessStatus:opts.accessStatus||'A 已接入',confidence:opts.confidence||'A',design:opts.design||null,formula:opts.formula||'',method:opts.method||'',note:opts.note||'',axisGroup:opts.axisGroup||unit});
 if(module==='温度'&&key==='temp_design_p99'){
   const raw=A.cleanPairs?.(D.time||[],D.temperature_2m_max||[])||[],v=raw.map(x=>x.value),summary=pct(v,.99);
   return mk('设计高温P99','℃',raw,summary,{source:'ERA5逐日最高温',sourceVariable:'temperature_2m_max',resolution:'1 d',design:{upper:num(p.capHigh),label:'最高设计温度'},formula:'P99(Tmax_day)',method:'逐日最高温形成序列后取P99，与绝对最高温Max分开。'});
 }
 if(module==='温度'&&key==='temp_low_p1'){
   const base=originalPrepare('温度','temp_min'),raw=base?.raw||base?.series||[],summary=pct(raw.map(x=>x.value),.01);
   return mk('设计低温P1','℃',raw,summary,{source:'ERA5 2 m小时温度',sourceVariable:'temperature_2m',design:{lower:num(p.capLow),label:'最低设计温度'},formula:'P1(T_hour)',method:'低温设计统计值，与绝对最低温Min分开。'});
 }
 if(module==='湿度'&&key==='rh_max'){
   const base=originalPrepare('湿度','rh_mean'),raw=base?.raw||base?.series||[],v=raw.map(x=>x.value),summary=v.length?Math.max(...v):NaN;
   return mk('最大相对湿度','%',raw,summary,{source:'ERA5 2 m相对湿度',sourceVariable:'relative_humidity_2m',design:{upper:num(p.capRh),label:'最大RH能力'},formula:'max(RH_hour)',method:'设计能力校核使用最大RH，不再用平均RH代替。'});
 }
 if(module==='海拔'&&key==='heat_loss'){
   const base=originalPrepare('海拔','air_density'),src=base?.raw||base?.series||[],rho0=101325/(287.05*288.15),raw=src.map(x=>({...x,value:Math.max(0,(1-Number(x.value)/rho0)*100)})),v=raw.map(x=>x.value),summary=v.length?Math.max(...v):NaN;
   return mk('空气密度散热衰减','%',raw,summary,{dataClass:'工程模型值',source:'ERA5气压+温度 → 空气密度修正',sourceVariable:'surface_pressure + temperature_2m',design:{upper:num(p.capHeatLoss),label:'最大散热衰减能力'},formula:'HeatLoss=(1−ρ/ρ0)×100%',method:'V3.3统一采用线性空气密度修正作为平台基准；指数模型不再并行使用。',accessStatus:'C 可模型计算',confidence:'B'});
 }
 return null;
}
const supplementalKeys={'温度':['temp_design_p99','temp_low_p1'],'湿度':['rh_max'],'海拔':['heat_loss']};

const originalPrepare=A.prepareIndicator.bind(A);
function externalOverride(module,key,base){
 const v33=window.GEDataSourcesV33?.state||{};
 if(module==='温度'&&key==='surface_temp_p99'&&v33.skinTemperature?.ok&&v33.skinTemperature.series?.length){
   const raw=v33.skinTemperature.series.slice(),vals=raw.map(p=>Number(p.value)).filter(finite),summary=pct(vals,.99);
   return{...base,module,key,id:module+'::'+key,name:'暴晒最高地表温度P99',unit:'℃',summaryUnit:'℃',dataClass:'模式数据',originalDataClass:'模式数据',source:'NASA POWER Earth Skin Temperature (TS)',sourceVariable:'TS',raw,series:raw,trendAvailable:true,summaryValue:summary,staticValue:null,coverage:{start:raw[0].time,end:raw.at(-1).time,count:raw.length,resolution:'1 d'},accessStatus:'A 已接入',formula:'P99(TS_daily)',note:'NASA POWER日尺度地表/skin temperature；不再用空气温度替代。'};
 }
 if(module==='太阳辐照'&&key==='uv_b_dose'&&v33.uvb?.ok&&v33.uvb.series?.length){
   const raw=v33.uvb.series.map(p=>({...p,value:Number(p.value)*1e6})),summary=raw.reduce((s,p)=>s+p.value,0);
   return{...base,module,key,id:module+'::'+key,name:'UV-B紫外剂量',unit:'J/m²·d',summaryUnit:'J/m²/期',dataClass:'模式数据',originalDataClass:'模式数据',source:'NASA POWER ALLSKY_SFC_UVB',sourceVariable:'ALLSKY_SFC_UVB',raw,series:raw,trendAvailable:true,summaryValue:summary,staticValue:null,coverage:{start:raw[0].time,end:raw.at(-1).time,count:raw.length,resolution:'1 d'},accessStatus:'A 已接入',formula:'E_UVB,daily = ALLSKY_SFC_UVB [MJ/m²/day] × 10^6',note:'NASA POWER返回ALLSKY_SFC_UVB单位为MJ/m²/day；转换为J/m²/day后累计，填充值-999不参与计算。'};
 }
 if(module==='盐雾'&&key==='coast_distance'&&v33.coast?.ok&&observed(v33.coast.value)){
   const val=Number(v33.coast.value);
   return{...base,module,key,id:module+'::'+key,name:'距海岸距离',unit:'km',summaryUnit:'km',dataClass:'GIS/静态数据',originalDataClass:'GIS/静态数据',source:v33.coast.source,sourceVariable:'dist',raw:[],series:[],trendAvailable:false,summaryValue:val,staticValue:val,coverage:null,accessStatus:'A 已接入',formula:'nearest-coast distance grid lookup',note:'0.04°全球距岸栅格点查询；作为环境元数据，不作为盐雾经验衰减公式。'};
 }
 return base;
}

function enhance(i){
 if(!i)return null;const cov=coverageMeta(i),code=dataCode(i),conf=confidence(i,cov),design=normalizeDesign(i.design),summary=i.summaryValue??i.staticValue;
 const de=designEval(summary,design),events=exceedanceEvents(i.raw||i.series||[],design),tm=trendMeta(i);
 return{...i,design,dataCode:code,coverageMeta:cov,confidenceMeta:conf,designEvaluation:de,exceedance:events,trendStats:tm};
}
function prepareIndicator(module,key){const base=externalOverride(module,key,originalPrepare(module,key));return enhance(base||supplemental(module,key))}
function prepareModule(module){
 const def=A.moduleCatalog().find(x=>x.module===module);if(!def)return null;
 const indicators=[...(def.indicators||[]).map(x=>prepareIndicator(module,x.key)),...((supplementalKeys[module]||[]).map(k=>prepareIndicator(module,k))].filter(Boolean),available=indicators.filter(i=>i.trendAvailable);
 const defaults=(def.indicators||[]).filter(i=>i.defaultSelected).slice(0,3).map(i=>module+'::'+i.key);
 return{module,requestedYears:selectedYears(),indicators,defaultSelected:defaults.length?defaults:available.slice(0,3).map(i=>i.id)};
}
function prepareAll(){return A.moduleCatalog().map(x=>prepareModule(x.module)).filter(Boolean)}
function sourceStatus(){
 let c={};try{c=window.cache||{}}catch{}
 const rows=[];
 const push=(id,name,status,source,start,end,note='')=>rows.push({id,name,status,source,start,end,note});
 push('era5','ERA5','A','Open-Meteo ERA5',c.w?.start,c.w?.end,'气象再分析');
 push('cams','CAMS',c.aq?.ok?'A':'E',c.aq?.sourceMeta?.source||'Open-Meteo CAMS Global',c.aq?.start,c.aq?.end,c.aq?.sourceMeta?.note||'空气质量/海盐');
 const gs=c.w?.v31Sources?.gust;push('gust','Gust Archive',gs?.status||'B',gs?.source||'Open-Meteo gust archive',gs?.start,gs?.end,'真实/档案阵风');
 const v33=window.GEDataSourcesV33?.state||{};
 push('coast','Distance to Coast',v33.coast?.ok?'A':'B','NASA OBPG / PacIOOS ERDDAP',null,null,v33.coast?.ok?'已按点查询':'可直接接入');
 push('uvb','UV-B',v33.uvb?.ok?'A':'B','NASA POWER',v33.uvb?.start,v33.uvb?.end,v33.uvb?.ok?'已按点查询':'可直接接入');
 push('landcover','Land Cover',v33.landcover?.ok?'A':'B','ESA WorldCover 10 m',null,null,v33.landcover?.ok?'已按点识别':'公开数据存在，点查询依赖外部服务/本地COG');
 push('lightning','Lightning',v33.lightning?.ok?'A':'B','NASA LIS/OTD climatology',null,null,v33.lightning?.ok?'已接长期气候场':'公开气候场存在，当前无稳定无鉴权点API');
 return rows;
}
A.prepareIndicator=prepareIndicator;A.prepareModule=prepareModule;A.prepareAll=prepareAll;
A.rangeStats=rangeStats;A.normalizeSeries=normalizeSeries;A.correlation=correlation;A.lagCorrelation=lagCorrelation;A.exportCsv=exportCsv;A.designEval=designEval;A.exceedanceEvents=exceedanceEvents;A.monthlyAnomaly=monthlyAnomaly;A.sourceStatus=sourceStatus;A.scienceV32='3.2.0';
})();