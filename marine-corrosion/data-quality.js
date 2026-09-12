export const DATA_VERSION='3.2.8';
export const HOUR=3600000;
export function number(v){
  if(v===null||v===undefined||!['number','string'].includes(typeof v)||(typeof v==='string'&&!v.trim()))return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
}
export function utcMs(t){
  if(typeof t!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t))return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(t)?t:t+'Z');
}
export function hourAxis(year){const start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1);return Array.from({length:(end-start)/HOUR},(_,i)=>new Date(start+i*HOUR).toISOString());}
export const RANGES={t:[-100,70],td:[-110,70],rh:[0,100],rain:[0,1000],pressure:[300,1100],cloud:[0,100],u10:[0,150],u100:[0,150],wd:[0,360],wd100:[0,360],sw:[0,1800],blh:[0,10000],hs:[0,50],tp:[0,60],wdir:[0,360],salinity:[0,50],sst:[-5,50],ss1:[0,.001],ss2:[0,.001],ss3:[0,.001],so2:[0,.001]};
export function valid(v,range){const n=number(v);return n===null||(range&&(n<range[0]||n>range[1]))?null:n;}
export function alignSeries(baseTimes,source,fields,{circularFields=[],accumulatedFields=[],maxGapHours=3,fieldGapHours={},ranges=RANGES}={}){
  const out={time:baseTimes,flags:{},audit:{duplicates:0,invalidTimes:0,outOfOrder:0,sourceCount:source?.time?.length||0}},seen=new Set(),samples=[];let previous=null;
  for(let i=0;i<(source?.time?.length||0);i++){
    const ms=utcMs(source.time[i]);if(!Number.isFinite(ms)){out.audit.invalidTimes++;continue}
    if(previous!==null&&ms<previous)out.audit.outOfOrder++;previous=ms;
    if(seen.has(ms)){out.audit.duplicates++;continue}seen.add(ms);samples.push({ms,i});
  }
  samples.sort((a,b)=>a.ms-b.ms);const steps=samples.slice(1).map((x,i)=>(x.ms-samples[i].ms)/HOUR).sort((a,b)=>a-b);out.audit.stepHours={min:steps[0]??null,max:steps.at(-1)??null,median:steps.length?steps[Math.floor(steps.length/2)]:null};out.audit.interpolationPolicy={maxGapHours,fieldGapHours,accumulatedFields,circularFields,extrapolation:false};const circle=new Set(circularFields),accumulated=new Set(accumulatedFields);
  const lower=ms=>{let lo=0,hi=samples.length-1,result=-1;while(lo<=hi){const m=(lo+hi)>>1;if(samples[m].ms<=ms){result=m;lo=m+1}else hi=m-1}return result};
  for(const field of fields){out.flags[field]=[];out[field]=baseTimes.map(t=>{
    let flag='MISSING',value=null;const ms=utcMs(t),a=lower(ms),left=samples[a],right=samples[a+1];
    if(Number.isFinite(ms)&&left){
      const va=valid(source[field]?.[left.i],ranges[field]);
      if(left.ms===ms){value=va;if(value!==null)flag=source.flags?.[field]?.[left.i]||'RAW'}
      else if(right&&!accumulated.has(field)&&(right.ms-left.ms)/HOUR<=(fieldGapHours[field]??maxGapHours)){
        const vb=valid(source[field]?.[right.i],ranges[field]);
        if(va!==null&&vb!==null){const f=(ms-left.ms)/(right.ms-left.ms);value=circle.has(field)?(va+f*((vb-va+540)%360-180)+360)%360:va+f*(vb-va);flag='INTERPOLATED'}
      }
    }
    out.flags[field].push(flag);return value;
  })}
  return out;
}
export function fieldQuality(values,flags=[],meta={}){
  const total=values.length,counts={valid:0,raw:0,interpolated:0,estimated:0,overridden:0,calculated:0,missing:0};
  values.forEach((v,i)=>{if(number(v)===null){counts.missing++;return}counts.valid++;const f=flags[i]||'RAW';if(f==='INTERPOLATED')counts.interpolated++;else if(f==='EST')counts.estimated++;else if(f==='OVERRIDE')counts.overridden++;else if(f==='CALC')counts.calculated++;else counts.raw++});
  const pct=n=>total?100*n/total:0;
  return {...meta,total,...counts,validPercent:pct(counts.valid),missingPercent:pct(counts.missing),interpolatedPercent:pct(counts.interpolated),estimatedPercent:pct(counts.estimated),overridePercent:pct(counts.overridden)};
}
export function distanceKm(lat1,lon1,lat2,lon2){if([lat1,lon1,lat2,lon2].some(v=>number(v)===null))return null;const r=Math.PI/180,a=Math.sin((lat2-lat1)*r/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin((lon2-lon1)*r/2)**2;return 12742*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}
export function gridInfo(d,lat,lon,selection){return {requested:{latitude:lat,longitude:lon},actual:{latitude:number(d.latitude),longitude:number(d.longitude)},distanceKm:distanceKm(lat,lon,number(d.latitude),number(d.longitude)),selection,elevation:number(d.elevation)};}
export function stableStringify(value){if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';return JSON.stringify(value);}
export function abortError(){return new DOMException('计算已取消','AbortError')}
export function checkAbort(signal){if(signal?.aborted)throw abortError()}
export function delay(ms,signal){return new Promise((resolve,reject)=>{checkAbort(signal);const onAbort=()=>{clearTimeout(timer);reject(abortError())};const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve()},ms);signal?.addEventListener('abort',onAbort,{once:true})})}
