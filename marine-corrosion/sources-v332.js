import {number,delay,checkAbort} from './data-quality.js';
import {alignSeries,requestJson,SourceError,normalizeDirectCams as normalizeDirectCams330} from './sources-v330.js';
export * from './sources-v330.js';

export const CAMS_SO2_AUTO_URL='https://global-marine-corrosion-direct-v332-lwang1332-4885.vercel.app/api/so2';

function configuredUrl(explicit){
  if(explicit)return explicit;
  try{const saved=globalThis.localStorage?.getItem('marineCamsSo2Url');if(saved)return saved}catch{}
  return globalThis.__MARINE_CAMS_SO2_URL__||CAMS_SO2_AUTO_URL;
}

function monthlyToHourly(data,baseTimes){
  const byMonth=new Map();
  for(let i=0;i<(data.time||[]).length;i++){
    const d=new Date(data.time[i]);const v=number(data.so2?.[i]);
    if(Number.isFinite(d.getTime())&&v!==null)byMonth.set(d.getUTCMonth()+1,v);
  }
  const so2=baseTimes.map(t=>{const d=new Date(t);return Number.isFinite(d.getTime())?byMonth.get(d.getUTCMonth()+1)??null:null});
  return {time:[...baseTimes],so2,flags:{so2:so2.map(v=>v===null?'MISSING':'DATA')},fieldMeta:{so2:{source:'CAMS EAC4 monthly reanalysis',unit:'kg/kg',originalUnit:data.units?.upstream||'kg kg**-1',unitBasis:'ADS API / lowest model level 60',resolution:data.resolution||'0.75° monthly mean',temporalHandling:'monthly mean expanded to each UTC hour of the same month'}},provenance:{type:'DATA/REANALYSIS',source:'CAMS EAC4 monthly reanalysis',dataset:data.dataset,modelLevel:data.modelLevel,grid:data.grid||null,resolution:data.resolution,retrievedAt:data.retrievedAt,autoSo2:true}};
}

function forecastToHourly(data,baseTimes){
  const raw={time:data.time||[],so2:(data.so2||[]).map(v=>number(v))};
  const a=alignSeries(baseTimes,raw,['so2'],{maxGapHours:6});
  a.fieldMeta={so2:{source:'CAMS Global atmospheric composition forecast',unit:'kg/kg',originalUnit:data.units?.upstream||'kg kg**-1',unitBasis:'ADS API / lowest model level 137',resolution:data.resolution||'~0.4° / 3 h',temporalHandling:'3 h CAMS forecast linearly aligned to platform hourly axis within bounded gaps'}};
  a.provenance={type:'DATA/FORECAST',source:'CAMS Global atmospheric composition forecast',dataset:data.dataset,modelLevel:data.modelLevel,cycle:data.cycle,grid:data.grid||null,resolution:data.resolution,retrievedAt:data.retrievedAt,autoSo2:true};
  return a;
}

export async function fetchCamsSo2Auto({lat,lon,mode,year,baseTimes,signal,url,onProgress=()=>{},resumeJob=null}={}){
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||!['historical','current'].includes(mode)||!Array.isArray(baseTimes)||!baseTimes.length)throw new SourceError('INPUT','CAMS SO₂ Auto 输入无效');
  const endpoint=configuredUrl(url),payload={lat:Number(lat),lon:Number(lon),mode,...(mode==='historical'?{year:Number(year)}:{})};
  let response=await requestJson(resumeJob?`${endpoint}?job=${encodeURIComponent(resumeJob)}`:endpoint,{method:resumeJob?'GET':'POST',...(!resumeJob?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{}),signal,timeout:30000,retries:0});
  const started=Date.now();
  while(response.status===202||['accepted','queued','running'].includes(String(response.data?.status||'').toLowerCase())){
    checkAbort(signal);
    const job=String(response.data?.jobId||'');
    if(!/^[A-Za-z0-9_-]{8,4096}$/.test(job))throw new SourceError('INVALID_RESPONSE','CAMS SO₂ Auto任务缺少有效编号');
    onProgress({status:response.data?.status||'running',jobId:job,cycle:response.data?.cycle||null,detail:'CAMS ADS正在准备SO₂数据'});
    if(Date.now()-started>300000){const e=new SourceError('PENDING','CAMS SO₂任务仍在准备，可重试继续');e.jobId=job;throw e}
    await delay(Math.max(2000,Math.min(10000,Number(response.data?.retryAfterSeconds||5)*1000)),signal);
    response=await requestJson(`${endpoint}?job=${encodeURIComponent(job)}`,{signal,timeout:30000,retries:0});
  }
  const data=response.data;
  if(!data?.configured)throw new SourceError('NOT_CONFIGURED',data?.error?.message||'CAMS SO₂ Auto服务未配置');
  if(!Array.isArray(data.time)||!Array.isArray(data.so2)||!data.time.length||data.time.length!==data.so2.length)throw new SourceError('INVALID_RESPONSE','CAMS SO₂ Auto未返回有效时间序列');
  return mode==='historical'?monthlyToHourly(data,baseTimes):forecastToHourly(data,baseTimes);
}

export function mergeAutoSo2(cams,so2){
  if(!so2?.time?.length)return cams;
  const n=so2.time.length,base=cams&&cams.time?.length===n?cams:{time:[...so2.time],flags:{},fieldMeta:{},provenance:{type:'EST',source:'Sea-salt Proxy (SO₂ from CAMS Auto)'}};
  const out={...base,time:[...so2.time],so2:[...(so2.so2||Array(n).fill(null))],flags:{...(base.flags||{}),so2:[...(so2.flags?.so2||Array(n).fill('MISSING'))]},fieldMeta:{...(base.fieldMeta||{}),so2:{...(so2.fieldMeta?.so2||{})}},provenance:{...(base.provenance||{}),type:'MIXED',source:[base.provenance?.source,so2.provenance?.source].filter(Boolean).join(' + '),so2:so2.provenance}};
  out.sourceByIndex={...(base.sourceByIndex||{}),so2:out.so2.map((v)=>number(v)===null?'MISSING':so2.provenance?.source||'CAMS SO₂ Auto')};
  out.autoSo2=so2.provenance;
  return out;
}

export function normalizeDirectCams(c,t){return normalizeDirectCams330(c,t);}
