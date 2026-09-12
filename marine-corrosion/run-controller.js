import {DATA_VERSION,number,stableStringify,checkAbort,abortError,alignSeries} from './data-quality.js';
import {MODEL_VERSION,computeModel} from './model-v328.js';
import {fetchDirectGateway,fetchOpenMeteoHistorical,fetchOpenMeteoCurrent,fetchOpenMeteoMarine,normalizeDirectWeather,normalizeDirectCams,normalizeDirectOcean} from './sources-v328.js';
export class DataCache{
 constructor({persistent=true,maxEntries=16}={}){this.memory=new Map();this.persistent=persistent;this.maxEntries=maxEntries;this.warning=null;this.dbPromise=null}
 async delete(key){this.memory.delete(key);const db=await this.db();if(db)await new Promise(resolve=>{const tx=db.transaction('cache','readwrite');tx.objectStore('cache').delete(key);tx.oncomplete=tx.onerror=tx.onabort=resolve})}
 async db(){if(!this.persistent||typeof indexedDB==='undefined')return null;if(!this.dbPromise)this.dbPromise=new Promise(resolve=>{const req=indexedDB.open('marine-corrosion-v328',1);req.onupgradeneeded=()=>req.result.createObjectStore('cache',{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>{this.warning='本机持久缓存不可用，使用本次会话缓存';resolve(null)}});return this.dbPromise}
 async get(key){let row=this.memory.get(key);const db=await this.db();if(!row&&db)row=await new Promise(resolve=>{const r=db.transaction('cache').objectStore('cache').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null)});if(!row||row.expires<Date.now())return null;return structuredClone(row.value)}
 async put(key,value,ttl){const row={key,value:structuredClone(value),expires:Date.now()+ttl,created:Date.now()};this.memory.delete(key);this.memory.set(key,row);while(this.memory.size>4)this.memory.delete(this.memory.keys().next().value);const db=await this.db();if(!db)return;await new Promise(resolve=>{const tx=db.transaction('cache','readwrite'),store=tx.objectStore('cache');store.put(row);const keys=[];const req=store.openCursor();req.onsuccess=()=>{const c=req.result;if(c){keys.push({key:c.key,created:c.value.created,expires:c.value.expires});c.continue()}else{keys.sort((a,b)=>a.created-b.created);const expired=keys.filter(x=>x.expires<Date.now()).map(x=>x.key),excess=keys.length-this.maxEntries;for(const k of new Set([...expired,...keys.slice(0,Math.max(0,excess)).map(x=>x.key)]))if(k!==key)store.delete(k)}};tx.oncomplete=()=>resolve();tx.onerror=()=>{this.warning='持久缓存写入失败，本次结果仍可用';resolve()};tx.onabort=()=>resolve()})}
}
export function abortable(promise,signal){return new Promise((resolve,reject)=>{checkAbort(signal);const cancel=()=>reject(abortError());signal?.addEventListener('abort',cancel,{once:true});promise.then(v=>{signal?.removeEventListener('abort',cancel);if(signal?.aborted)reject(abortError());else resolve(v)},e=>{signal?.removeEventListener('abort',cancel);reject(e)})})}
function coverage(series,keys){return series?.time?.length?Math.min(...keys.map(k=>(series[k]||[]).filter(v=>number(v)!==null).length/series.time.length)):0}
function fillSeries(direct,fallback){
 if(!direct)return fallback;direct={...direct,...alignSeries(fallback.time,direct,Object.keys(fallback.flags),{circularFields:['wd','wd100','wdir'],accumulatedFields:['rain']})};const out={...fallback,flags:{...fallback.flags},fieldMeta:{...fallback.fieldMeta},sourceByIndex:{},provenance:{...fallback.provenance,type:'MIXED',source:direct.provenance.source+' + '+fallback.provenance.source,grids:[direct.provenance.grid,fallback.provenance.grid]}};
 for(const key of Object.keys(fallback.flags)){out.flags[key]=[];out.sourceByIndex[key]=[];out[key]=fallback[key].map((v,i)=>{const take=number(direct[key]?.[i])!==null;out.flags[key].push((take?direct.flags[key]?.[i]:fallback.flags[key]?.[i])||'MISSING');out.sourceByIndex[key].push(take?direct.provenance.source:fallback.provenance.source);return take?direct[key][i]:v});out.fieldMeta[key]={...fallback.fieldMeta[key],source:out.provenance.source}}
 out.originalSegments=[direct,fallback];return out;
}
export function mergeEnvironments(environments){
 const join=key=>{const first=environments.find(e=>e[key])?.[key];if(!first)return null;const fields=[...new Set(environments.flatMap(e=>Object.keys(e[key]?.flags||{})))],out={time:[],flags:{},fieldMeta:{},provenance:{type:'MIXED',source:[...new Set(environments.map(e=>e[key]?.provenance?.source).filter(Boolean))].join(' / '),byYear:environments.map(e=>({year:e.year,...e[key]?.provenance}))}};
  fields.forEach(f=>{out[f]=[];out.flags[f]=[];out.fieldMeta[f]={...first.fieldMeta?.[f],source:[...new Set(environments.map(e=>e[key]?.fieldMeta?.[f]?.source).filter(Boolean))].join(' / ')}});
  for(const e of environments){const n=e.weather.time.length;out.time.push(...e.weather.time);out.originalByYear??=[];out.originalByYear.push({year:e.year,data:e[key]?.originalData||e[key]?.originalSegments||null});for(const f of fields){out[f].push(...(e[key]?.[f]||Array(n).fill(null)));out.flags[f].push(...(e[key]?.flags?.[f]||Array(n).fill('MISSING')))}}return out};
 return {weather:join('weather'),cams:join('cams'),ocean:join('ocean'),gis:environments[0].gis};
}
export async function computeInWorker(input,{signal}={}){
 checkAbort(signal);if(typeof Worker==='undefined')return computeModel(input);
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});const clean=()=>{worker.terminate();signal?.removeEventListener('abort',cancel)};const cancel=()=>{clean();reject(abortError())};signal?.addEventListener('abort',cancel,{once:true});worker.onmessage=e=>{clean();if(signal?.aborted)reject(abortError());else if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.result)};worker.onerror=e=>{clean();reject(new Error(e.message||'计算线程启动失败'))};worker.postMessage(input)})
}
export class RunCoordinator{
 constructor({resolveGis,cache=new DataCache(),direct=fetchDirectGateway,historical=fetchOpenMeteoHistorical,current=fetchOpenMeteoCurrent,marine=fetchOpenMeteoMarine,compute=computeInWorker}={}){this.resolveGis=resolveGis;this.cache=cache;this.direct=direct;this.historical=historical;this.current=current;this.marine=marine;this.compute=compute;this.sequence=0;this.controller=null;this.blockedDirect=null}
 cancel(){this.sequence++;this.controller?.abort()}
 async environment(snapshot,year,signal,emit,{fresh=false}={}){
  const {latitude:lat,longitude:lon,mode,height}=snapshot.cfg,key='env|'+stableStringify({v:DATA_VERSION,lat,lon,year,mode,height,selection:'GIS-auto'}),saved=!fresh&&await this.cache.get(key);
  if(saved){emit({stage:'cache',year,detail:'已复用环境数据',cached:true});return saved}if(fresh)await this.cache.delete(key);checkAbort(signal);
  let direct=null,directError=null;const jobKey='job|'+key,resume=!fresh&&await this.cache.get(jobKey);
  emit({stage:'direct',year,detail:'检查 Direct 数据服务'});
  try{
   if(!fresh&&this.blockedDirect&&this.blockedDirect.expires>Date.now())throw this.blockedDirect.error;
   direct=await this.direct({lat,lon,mode,year,height,signal,resumeJob:resume?.jobId,onProgress:ev=>{emit({stage:'direct',year,...ev});if(ev.jobId)this.cache.put(jobKey,{jobId:ev.jobId},86400000).catch(()=>{})}});
  }catch(e){if(e.name==='AbortError')throw e;directError={code:e.code||'NETWORK',message:e.message,...(e.jobId?{jobId:e.jobId}:{})};if(['DEPLOYMENT_MISSING','AUTH','NOT_FOUND'].includes(e.code))this.blockedDirect={error:e,expires:Date.now()+600000}}
  checkAbort(signal);emit({stage:'gis',year,detail:'分析海陆属性和实际数据格点'});
  const gis=await abortable(this.resolveGis(lat,lon,direct,signal),signal),selection=gis.siteMedium==='sea'?'sea':gis.distanceToCoastKm<=5?'nearest':'land';
  emit({stage:'weather',year,detail:'获取并检查气象小时序列'});let weather=null,weatherError=null;
  try{weather=normalizeDirectWeather(direct?.weather,year)}catch(e){weatherError=e.message}
  const directWeather=weather;
  if(coverage(weather,['t','u10','rain'])<.95||Math.max(coverage(weather,['rh']),coverage(weather,['td']))<.95){const fallback=mode==='historical'?await this.historical(lat,lon,year,{signal,selection}):await this.current(lat,lon,{signal,selection});weather=fillSeries(weather,fallback)}
  checkAbort(signal);let cams=null,ocean=null,camsError=null,oceanError=null;
  try{cams=normalizeDirectCams(direct?.cams,weather.time)}catch(e){camsError=e.message}
  try{ocean=normalizeDirectOcean(direct?.ocean,weather.time)}catch(e){oceanError=e.message}
  const directOcean=ocean;
  emit({stage:'ocean',year,detail:'获取波浪并检查 CAMS / CMEMS 数据覆盖',hours:weather.time.length});
  if(coverage(ocean,['hs'])<.95)ocean=fillSeries(ocean,await this.marine(lat,lon,weather.time,{signal,year}));
  checkAbort(signal);
  const service=async(key,raw,used,fields,error)=>{const times=(raw?.time||[]).filter((_,i)=>fields.every(f=>number(raw[f]?.[i])!==null)),ratio=times.length/weather.time.length,previous=await this.cache.get('service-success|'+key);let lastSuccess=previous?.time||null;if(times.length){lastSuccess=new Date().toISOString();await this.cache.put('service-success|'+key,{time:lastSuccess},365*86400000)}return {configured:direct?.services?.[key]?.configured??null,status:ratio>=.95?'valid_data':ratio>0?'partial_data':error?.code==='PENDING'?'pending':'fallback_or_missing',coveragePercent:100*ratio,first:times[0]||null,last:times.at(-1)||null,lastSuccess,lastSuccessScope:'本浏览器最近取得有效Direct数据的时间，可能属于其他点位',error:error||direct?.services?.[key]?.error||(ratio<.95?{code:'INCOMPLETE',message:'本次Direct关键变量覆盖不足'}:null),source:used?.provenance?.source||(key==='cams'?'海盐工程代理 EST':'无数据')}};
  const services={era5:await service('era5',directWeather,weather,['t','u10','wd','rain'],weatherError?{code:'NORMALIZATION',message:weatherError}:directError),cams:await service('cams',cams,cams,['ss1','ss2','ss3'],camsError?{code:'NORMALIZATION',message:camsError}:directError),cmems:await service('cmems',directOcean,ocean,['hs','salinity'],oceanError?{code:'NORMALIZATION',message:oceanError}:directError)};
  const value={year,weather,cams,ocean,gis,services,directError,revision:Date.now()+'-'+Math.random().toString(36).slice(2),retrievedAt:new Date().toISOString()};
  await this.cache.put(key,value,directError?.code==='PENDING'?60000:mode==='historical'?7*86400000:3600000);checkAbort(signal);return value;
 }
 async run(input,onProgress=()=>{},{fresh=false}={}){
  this.cancel();const id=++this.sequence,controller=new AbortController();this.controller=controller;const signal=controller.signal,snapshot=structuredClone(input),years=snapshot.cfg.mode==='historical'?snapshot.cfg.requestedYears:[null],environments=[],failures=[];
  const emit=event=>{if(this.sequence===id&&!signal.aborted)onProgress({...event,runId:id})};
  for(const year of years){checkAbort(signal);emit({year,stage:'start',detail:'准备 '+(year||'Current')+' 数据'});try{const env=await this.environment(snapshot,year,signal,emit,{fresh});checkAbort(signal);environments.push(env);emit({year,stage:'done',detail:'环境数据已完成',hours:env.weather.time.length,completed:environments.length,total:years.length})}catch(e){if(e.name==='AbortError')throw e;failures.push({year,message:e.message,code:e.code||'FAILED'});emit({year,stage:'failed',detail:e.message,completed:environments.length,total:years.length})}}
  if(!environments.length){const e=new Error('所选年度均未获取到可用环境数据，可重试失败年度');e.failures=failures;throw e}
  checkAbort(signal);const key='result|'+stableStringify({version:MODEL_VERSION,cfg:snapshot.cfg,overrides:snapshot.overrides,calibrationModel:snapshot.calibrationModel,revisions:environments.map(e=>e.revision)});let result=!fresh&&await this.cache.get(key);
  if(!result){emit({stage:'compute',detail:'使用完整小时序列计算；保持跨年状态连续'});const merged=mergeEnvironments(environments);result=await this.compute({...merged,cfg:snapshot.cfg,overrides:snapshot.overrides,calibrationModel:snapshot.calibrationModel},{signal});checkAbort(signal);await this.cache.put(key,result,snapshot.cfg.mode==='historical'?7*86400000:3600000)}else emit({stage:'result-cache',detail:'已复用相同数据、参数与模型版本的结果'});
  checkAbort(signal);if(this.sequence!==id)throw abortError();
  result.inputSnapshot={...result.inputSnapshot,capturedAt:snapshot.capturedAt,audit:snapshot.audit||[]};result.environmentByYear=environments.map(e=>({year:e.year,revision:e.revision,services:e.services,weather:e.weather.provenance,cams:e.cams?.provenance,ocean:e.ocean.provenance,gis:e.gis.provenance,retrievedAt:e.retrievedAt}));
  result.sources={weather:result.provenance.weather,cams:result.provenance.cams,ocean:result.provenance.ocean,gis:result.provenance.gis};result.run={id,complete:failures.length===0,requestedYears:years,completedYears:environments.map(e=>e.year),failures,cacheWarning:this.cache.warning};emit({stage:'complete',detail:failures.length?'部分年度完成；失败年度已列出':'所选周期计算完成',completed:environments.length,total:years.length});return result;
 }
}
