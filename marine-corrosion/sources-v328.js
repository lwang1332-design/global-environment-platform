import {alignSeries,number,utcMs,hourAxis,gridInfo,checkAbort,delay,abortError} from './data-quality.js';
export {alignSeries};
export const DIRECT_URL='https://global-marine-corrosion-direct-v322-lwang1332-4885.vercel.app/api/direct';
export class SourceError extends Error{constructor(code,message,status=null){super(message);this.name='SourceError';this.code=code;this.status=status}}
export function classifyError(status,body=''){
  if(status===401||status===403)return 'AUTH';if(status===404)return /DEPLOYMENT_NOT_FOUND/.test(body)?'DEPLOYMENT_MISSING':'NOT_FOUND';if(status===429)return 'RATE_LIMIT';if(status>=500)return 'UPSTREAM';return 'DATA_UNAVAILABLE';
}
const errorLabels={NOT_CONFIGURED:'Direct工作服务尚未配置',AUTH:'访问凭据或服务权限不可用',DEPLOYMENT_MISSING:'Direct 部署不存在',NOT_FOUND:'接口或请求的数据不存在',RATE_LIMIT:'服务限流',UPSTREAM:'上游服务故障',DATA_UNAVAILABLE:'数据暂不可用',TIMEOUT:'请求超时',NETWORK:'网络连接失败',INVALID_RESPONSE:'接口未返回有效 JSON 数据',PENDING:'数据任务仍在准备，可稍后重试'};
export async function requestJson(url,{signal,timeout=30000,retries=1,...options}={}){
  for(let attempt=0;;attempt++){
    checkAbort(signal);const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,timeout);
    try{
      const r=await fetch(url,{...options,signal:controller.signal});const body=await r.text();
      if(!r.ok){let code=classifyError(r.status,body);try{const detail=JSON.parse(body);if(['NOT_CONFIGURED','TIMEOUT','AUTH','RATE_LIMIT','INVALID_RESPONSE'].includes(detail.error?.code))code=detail.error.code}catch{}throw new SourceError(code,errorLabels[code],r.status)}
      let data;try{data=JSON.parse(body)}catch{throw new SourceError('INVALID_RESPONSE',errorLabels.INVALID_RESPONSE)}
      return {data,status:r.status};
    }catch(error){
      if(signal?.aborted)throw abortError();
      const e=error instanceof SourceError?error:new SourceError(error.name==='AbortError'?'TIMEOUT':'NETWORK',error.name==='AbortError'?errorLabels.TIMEOUT:errorLabels.NETWORK);
      if(attempt>=retries||!['TIMEOUT','NETWORK','RATE_LIMIT','UPSTREAM'].includes(e.code))throw e;
      await delay(1000*(attempt+1),signal);
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
  }
}
export async function fetchDirectGateway({lat,lon,mode,year,height,signal,onProgress=()=>{},resumeJob=null,url=DIRECT_URL}){
  const payload={lat,lon,mode,height,...(year?{year}:{})};
  let response=await requestJson(resumeJob?`${url}?job=${encodeURIComponent(resumeJob)}`:url,{method:resumeJob?'GET':'POST',...(!resumeJob?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{}),signal,timeout:20000,retries:0});
  const started=Date.now();
  while(response.status===202||['accepted','queued','running'].includes(response.data.status)){
    const job=response.data.jobId;
    if(typeof job!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(job))throw new SourceError('INVALID_RESPONSE','Direct 任务缺少有效编号');
    onProgress({status:response.data.status||'running',jobId:job,detail:'Direct 正在准备数据，可取消或稍后恢复'});
    if(Date.now()-started>300000){const e=new SourceError('PENDING',errorLabels.PENDING);e.jobId=job;throw e}
    await delay(Math.max(2000,Math.min(15000,Number(response.data.retryAfterSeconds||3)*1000)),signal);
    response=await requestJson(`${url}?job=${encodeURIComponent(job)}`,{signal,timeout:20000});
  }
  if(response.data.status==='failed')throw new SourceError('DATA_UNAVAILABLE','Direct 数据任务失败');
  const data=response.data.result||response.data;
  if(!data||typeof data!=='object'||(!data.weather&&!data.cams&&!data.ocean&&!data.services))throw new SourceError('INVALID_RESPONSE','Direct 未返回数据或逐服务状态');
  return data;
}
export async function fetchDirectHealth({signal}={}){
  try{const {data}=await requestJson(DIRECT_URL,{signal,timeout:6000,retries:0});return {reachable:true,checkedAt:new Date().toISOString(),services:data.services||{era5:{configured:!!data.era5},cams:{configured:!!data.cams},cmems:{configured:!!data.cmems}},note:'健康状态仅表示配置可用；有效数据以本次结果为准'}}
  catch(e){if(e.name==='AbortError')throw e;return {reachable:false,checkedAt:new Date().toISOString(),code:e.code||'NETWORK',message:e.message,services:{}}}
}
const weatherFields=['t','td','rh','rain','pressure','cloud','u10','wd','u100','wd100','sw','blh'];
const fieldNames={t:'temperature_2m',td:'dew_point_2m',rh:'relative_humidity_2m',rain:'precipitation',pressure:'surface_pressure',cloud:'cloud_cover',u10:'wind_speed_10m',wd:'wind_direction_10m',u100:'wind_speed_100m',wd100:'wind_direction_100m',sw:'shortwave_radiation',blh:'boundary_layer_height'};
export const UNITS={t:'°C',td:'°C',rh:'%',rain:'mm',pressure:'hPa',cloud:'%',u10:'m/s',wd:'°',u100:'m/s',wd100:'°',sw:'W/m²',blh:'m',hs:'m',tp:'s',wdir:'°',salinity:'PSU',sst:'°C',ss1:'kg/kg',ss2:'kg/kg',ss3:'kg/kg',so2:'kg/kg'};
export function convertUnit(v,from,to){const n=number(v);if(n===null)return null;const f=String(from||to).replaceAll(' ','');
  if(f===to.replaceAll(' ','')||['degree','degrees'].includes(f)&&to==='°'||['celsius','degC'].includes(f)&&to==='°C'||['psu','g/kg','1e-3'].includes(f)&&to==='PSU'||f==='kgkg**-1'&&to==='kg/kg')return n;
  if(f==='K'&&to==='°C')return n-273.15;if(f==='Pa'&&to==='hPa')return n/100;if(['km/h','kmh'].includes(f)&&to==='m/s')return n/3.6;if(f==='m'&&to==='mm')return n*1000;
  throw new SourceError('UNITS',`不支持的单位换算：${from} → ${to}`);
}
function attachMeta(series,source,units,extra={}){
  const fields=Object.keys(series.flags||{});series.provenance={type:'DATA',source,...extra};series.fieldMeta=Object.fromEntries(fields.map(f=>[f,{source,unit:UNITS[f],originalUnit:units?.[f]||UNITS[f],unitBasis:units?.[f]?'response_metadata':'adapter_contract',resolution:extra.resolution||'1 h'}]));return series;
}
function sortedAxis(time){const valid=(time||[]).map(utcMs).filter(Number.isFinite);if(!valid.length)return[];const lo=Math.min(...valid),hi=Math.max(...valid);return Array.from({length:Math.floor((hi-lo)/3600000)+1},(_,i)=>new Date(lo+i*3600000).toISOString());}
async function fetchWeather(lat,lon,year,{signal,selection='nearest'}={}){
  const historical=Number.isInteger(year);const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),hourly:Object.values(fieldNames).join(','),wind_speed_unit:'ms',timezone:'UTC',cell_selection:selection});
  if(historical){q.set('start_date',`${year}-01-01`);q.set('end_date',`${year}-12-31`);q.set('models','era5')}else{q.set('past_days','1');q.set('forecast_days','7')}
  const {data:d}=await requestJson(`https://${historical?'archive-api':'api'}.open-meteo.com/v1/${historical?'archive':'forecast'}?${q}`,{signal,timeout:60000});
  if(!d.hourly?.time?.length)throw new SourceError('DATA_UNAVAILABLE','气象服务未返回小时数据');
  const raw={time:d.hourly.time},units={};for(const [f,key] of Object.entries(fieldNames)){units[f]=d.hourly_units?.[key];raw[f]=(d.hourly[key]||[]).map(v=>convertUnit(v,units[f],UNITS[f]))}
  const aligned=alignSeries(historical?hourAxis(year):sortedAxis(raw.time),raw,weatherFields,{circularFields:['wd','wd100'],accumulatedFields:['rain'],maxGapHours:2});
  aligned.originalData={time:d.hourly.time,values:d.hourly,units:d.hourly_units};return attachMeta(aligned,historical?'Open-Meteo ERA5 再分析（替代数据源）':'Open-Meteo 天气预报',units,{type:historical?'REANALYSIS':'FORECAST',grid:gridInfo(d,lat,lon,selection),resolution:historical?'0.25° / 1 h':'服务自动匹配 / 1 h',retrievedAt:new Date().toISOString()});
}
export const fetchOpenMeteoHistorical=(lat,lon,year,options)=>fetchWeather(lat,lon,year,options);
export const fetchOpenMeteoCurrent=(lat,lon,options)=>fetchWeather(lat,lon,null,options);
export async function fetchOpenMeteoMarine(lat,lon,baseTimes,{signal,year=null}={}){
  const historical=Number.isInteger(year),q=new URLSearchParams({latitude:String(lat),longitude:String(lon),hourly:'wave_height,wave_period,wave_direction',timezone:'UTC',cell_selection:'sea'});
  if(historical){q.set('start_date',`${year}-01-01`);q.set('end_date',`${year}-12-31`);q.set('models','era5_ocean')}else{q.set('forecast_days','7');q.set('past_days','1')}
  try{
    const {data:d}=await requestJson(`https://marine-api.open-meteo.com/v1/marine?${q}`,{signal,timeout:45000});if(!d.hourly?.time)throw new SourceError('DATA_UNAVAILABLE','海洋服务未返回小时数据');
    const raw={time:d.hourly.time,hs:d.hourly.wave_height,tp:d.hourly.wave_period,wdir:d.hourly.wave_direction};
    const a=alignSeries(baseTimes,raw,['hs','tp','wdir','salinity','sst'],{circularFields:['wdir'],maxGapHours:3});
    a.originalData={time:d.hourly.time,values:d.hourly,units:d.hourly_units};return attachMeta(a,historical?'Open-Meteo ERA5-Ocean 历史波浪':'Open-Meteo 海浪预报',{hs:d.hourly_units?.wave_height,tp:d.hourly_units?.wave_period,wdir:d.hourly_units?.wave_direction},{type:historical?'REANALYSIS':'FORECAST',grid:gridInfo(d,lat,lon,'sea'),retrievedAt:new Date().toISOString()});
  }catch(e){if(e.name==='AbortError')throw e;const a=alignSeries(baseTimes,null,['hs','tp','wdir','salinity','sst']);return attachMeta(a,'海洋数据不可用',{}, {type:'MISSING',error:{code:e.code,message:e.message},retrievedAt:new Date().toISOString()})}
}
function directNormalize(data,baseTimes,fields,source,{aliases={},circularFields=[],accumulatedFields=[],fieldGapHours={}}={}){
  if(!data?.time?.length)return null;const raw={time:data.time},units={};for(const f of fields){const key=data[aliases[f]]?aliases[f]:f;units[f]=data.units?.[key]||data.units?.[f];raw[f]=(data[key]||[]).map(v=>convertUnit(v,units[f],UNITS[f]))}
  const aligned=alignSeries(baseTimes||sortedAxis(data.time),raw,fields,{circularFields,accumulatedFields,maxGapHours:3,fieldGapHours});aligned.originalData=structuredClone(data);return attachMeta(aligned,data.source||source,units,{type:'DIRECT',grid:data.grid||null,resolution:data.resolution||'上游未提供分辨率',retrievedAt:new Date().toISOString()});
}
export function normalizeDirectWeather(w,year=null){
  if(!w?.time?.length)return null;w={...w};const speed=(u,v)=>number(u)===null||number(v)===null?null:Math.hypot(Number(u),Number(v)),direction=(u,v)=>number(u)===null||number(v)===null?null:(Math.atan2(-Number(u),-Number(v))*180/Math.PI+360)%360;
  for(const h of [10,100])if(!w[`wind_speed_${h}m`]&&w[`u${h}_component`]){w[`wind_speed_${h}m`]=w[`u${h}_component`].map((u,i)=>speed(u,w[`v${h}_component`]?.[i]));w[`wind_direction_${h}m`]=w[`u${h}_component`].map((u,i)=>direction(u,w[`v${h}_component`]?.[i]))}
  return directNormalize(w,Number.isInteger(year)?hourAxis(year):null,weatherFields,'ERA5 Direct',{aliases:{...fieldNames,td:'dewpoint_2m',rh:'relative_humidity',sw:'shortwave_down',blh:'boundary_layer_height'},circularFields:['wd','wd100'],accumulatedFields:['rain']});
}
export const normalizeDirectCams=(c,t)=>directNormalize(c,t,['ss1','ss2','ss3','so2'],'CAMS Direct');
export const normalizeDirectOcean=(o,t)=>directNormalize(o,t,['hs','tp','wdir','salinity','sst'],'CMEMS Direct',{circularFields:['wdir'],fieldGapHours:{salinity:24,sst:24}});
