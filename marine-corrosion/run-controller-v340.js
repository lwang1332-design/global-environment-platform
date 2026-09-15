import {RunCoordinator as RunCoordinator333,DataCache,abortable,computeInWorker,mergeEnvironments} from './run-controller-v333.js';
import {number,stableStringify,checkAbort} from './data-quality.js';
import {fetchCamsSeaSaltAuto,mergeAutoSeaSalt} from './sources-v340.js';
import {assessCoastalCorrosion} from './coastal-corrosion-v340.js';
export {DataCache,abortable,computeInWorker,mergeEnvironments};
export const DATA_VERSION='3.4.0';
export const DIAGNOSTIC_VERSION='3.3.3';
export const COASTAL_VERSION='3.4.0';
export const SETTINGS_KEY='marineV340Settings';

export function readV340Settings(){try{return JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY)||'{}')||{}}catch{return {}}}
export function saveV340Settings(settings){try{globalThis.localStorage?.setItem(SETTINGS_KEY,JSON.stringify(settings||{}))}catch{}return settings||{}}
function coverage(series){if(!series?.time?.length)return 0;const n=series.time.length;return Math.min(...['ss1','ss2','ss3'].map(k=>(series[k]||[]).filter(v=>number(v)!==null).length/n))}

export class RunCoordinator extends RunCoordinator333{
  constructor(options={}){const {camsSeaSaltAuto,...base}=options;super(base);this.camsSeaSaltAuto=camsSeaSaltAuto||fetchCamsSeaSaltAuto}
  async environment(snapshot,year,signal,emit,options={}){
    const env=await super.environment(snapshot,year,signal,emit,options);checkAbort(signal);
    const {latitude:lat,longitude:lon,mode}=snapshot.cfg;
    const cacheKey='cams-sea-salt|'+stableStringify({v:DATA_VERSION,lat,lon,mode,year:year||null,axisStart:env.weather.time[0],axisEnd:env.weather.time.at(-1)}),jobKey='cams-sea-salt-job|'+cacheKey;
    let salt=!options.fresh&&await this.cache.get(cacheKey),saltError=null;
    if(!salt){
      if(options.fresh){await this.cache.delete(cacheKey);await this.cache.delete(jobKey)}
      const resume=!options.fresh&&await this.cache.get(jobKey);
      emit({stage:'cams-sea-salt',year,detail:resume?.jobId?'继续已有CAMS ADS海盐任务':mode==='historical'?'CAMS EAC4：提交月平均三粒径海盐任务':'CAMS Forecast：提交三粒径海盐任务'});
      try{
        salt=await this.camsSeaSaltAuto({lat,lon,mode,year,baseTimes:env.weather.time,signal,resumeJob:resume?.jobId||null,onProgress:ev=>{emit({stage:'cams-sea-salt',year,...ev});if(ev.jobId)this.cache.put(jobKey,{jobId:ev.jobId},86400000).catch(()=>{})}});
        await this.cache.put(cacheKey,salt,mode==='historical'?30*86400000:3*3600000);await this.cache.delete(jobKey);
      }catch(e){if(e.name==='AbortError')throw e;if(e.jobId)await this.cache.put(jobKey,{jobId:e.jobId},86400000);saltError={code:e.code||'CAMS_SEA_SALT_UNAVAILABLE',message:e.message,...(e.jobId?{jobId:e.jobId}:{})};emit({stage:'cams-sea-salt',year,detail:e.code==='PENDING'?'CAMS海盐仍在ADS队列；下次计算继续':'CAMS海盐服务端数据不可用；本次保留明确标识的Proxy，不将其冒充Direct',status:'warn'})}
    }else emit({stage:'cams-sea-salt',year,detail:'已复用CAMS海盐Auto缓存',cached:true});
    if(salt){env.cams=mergeAutoSeaSalt(env.cams,salt);env.revision+='|salt-'+(salt.provenance?.retrievedAt||Date.now())}
    const ratio=coverage(salt);env.services={...(env.services||{}),camsSeaSalt:{configured:salt?true:saltError?.code==='NOT_CONFIGURED'?false:null,status:ratio>=.95?'valid_data':ratio>0?'partial_data':saltError?.code==='PENDING'?'pending':'missing',coveragePercent:100*ratio,source:salt?.provenance?.source||'CAMS Sea Salt Auto',dataset:salt?.provenance?.dataset||null,modelLevel:salt?.provenance?.modelLevel||null,retrievedAt:salt?.provenance?.retrievedAt||null,error:saltError,policy:'优先服务端CAMS EAC4/Forecast三粒径；失败时才允许Proxy并降可信度'}};env.retrievedAt=new Date().toISOString();return env;
  }
  async run(input,onProgress=()=>{},options={}){
    const result=await super.run(input,onProgress,options);let assessment=null;
    try{assessment=assessCoastalCorrosion(result,readV340Settings());result.coastalAssessment=assessment;globalThis.__MARINE_V340_LAST_RESULT__=result;globalThis.__MARINE_V340_LAST_ASSESSMENT__=assessment;globalThis.dispatchEvent?.(new CustomEvent('marine:v340',{detail:{result,assessment,version:COASTAL_VERSION}}))}catch(error){globalThis.dispatchEvent?.(new CustomEvent('marine:v340:error',{detail:{error:String(error?.message||error)}}))}return result;
  }
}
