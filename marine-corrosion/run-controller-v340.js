import {RunCoordinator as RunCoordinator333,DataCache,abortable,computeInWorker,mergeEnvironments} from './run-controller-v333.js';
import {number,stableStringify,checkAbort} from './data-quality.js';
import {fetchCamsSeaSaltAuto,fetchCamsSeaSaltFluxAuto,mergeAutoSeaSalt,mergeAutoSeaSaltFlux,CAMS_FLUX_FIELDS} from './sources-v340.js';
import {assessCoastalCorrosion} from './coastal-corrosion-v340.js';
export {DataCache,abortable,computeInWorker,mergeEnvironments};
export const DATA_VERSION='3.4.0';
export const DIAGNOSTIC_VERSION='3.3.3';
export const COASTAL_VERSION='3.4.0';
export const SETTINGS_KEY='marineV340Settings';

export function readV340Settings(){try{return JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY)||'{}')||{}}catch{return {}}}
export function saveV340Settings(settings){try{globalThis.localStorage?.setItem(SETTINGS_KEY,JSON.stringify(settings||{}))}catch{}return settings||{}}
function saltCoverage(series){if(!series?.time?.length)return 0;const n=series.time.length;return Math.min(...['ss1','ss2','ss3'].map(k=>(series[k]||[]).filter(v=>number(v)!==null).length/n))}
function fluxCoverage(series){if(!series?.time?.length)return 0;const n=series.time.length;return Math.min(...CAMS_FLUX_FIELDS.map(k=>(series[k]||[]).filter(v=>number(v)!==null).length/n))}

export class RunCoordinator extends RunCoordinator333{
  constructor(options={}){const {camsSeaSaltAuto,camsSeaSaltFluxAuto,...base}=options;super(base);this.camsSeaSaltAuto=camsSeaSaltAuto||fetchCamsSeaSaltAuto;this.camsSeaSaltFluxAuto=camsSeaSaltFluxAuto||fetchCamsSeaSaltFluxAuto}
  async environment(snapshot,year,signal,emit,options={}){
    const env=await super.environment(snapshot,year,signal,emit,options);checkAbort(signal);
    const {latitude:lat,longitude:lon,mode}=snapshot.cfg;
    const baseKey={v:DATA_VERSION,lat,lon,mode,year:year||null,axisStart:env.weather.time[0],axisEnd:env.weather.time.at(-1)};
    const cacheKey='cams-sea-salt|'+stableStringify(baseKey),jobKey='cams-sea-salt-job|'+cacheKey;
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
    const saltRatio=saltCoverage(salt);env.services={...(env.services||{}),camsSeaSalt:{configured:salt?true:saltError?.code==='NOT_CONFIGURED'?false:null,status:saltRatio>=.95?'valid_data':saltRatio>0?'partial_data':saltError?.code==='PENDING'?'pending':'missing',coveragePercent:100*saltRatio,source:salt?.provenance?.source||'CAMS Sea Salt Auto',dataset:salt?.provenance?.dataset||null,modelLevel:salt?.provenance?.modelLevel||null,retrievedAt:salt?.provenance?.retrievedAt||null,error:saltError,policy:'优先服务端CAMS EAC4/Forecast三粒径；失败时才允许Proxy并降可信度'}};

    const fluxCacheKey='cams-sea-salt-flux|'+stableStringify(baseKey),fluxJobKey='cams-sea-salt-flux-job|'+fluxCacheKey;
    let flux=!options.fresh&&await this.cache.get(fluxCacheKey),fluxError=null;
    if(!flux){
      if(options.fresh){await this.cache.delete(fluxCacheKey);await this.cache.delete(fluxJobKey)}
      const resume=!options.fresh&&await this.cache.get(fluxJobKey);
      emit({stage:'cams-sea-salt-flux',year,detail:resume?.jobId?'继续已有CAMS沉降通量任务':mode==='historical'?'CAMS archived forecast：提交全年3小时海盐沉降通量':'CAMS Forecast：提交海盐 dry/sedimentation/wet deposition 通量'});
      try{
        flux=await this.camsSeaSaltFluxAuto({lat,lon,mode,year,baseTimes:env.weather.time,signal,resumeJob:resume?.jobId||null,onProgress:ev=>{emit({stage:'cams-sea-salt-flux',year,...ev});if(ev.jobId)this.cache.put(fluxJobKey,{jobId:ev.jobId},86400000).catch(()=>{})}});
        await this.cache.put(fluxCacheKey,flux,mode==='historical'?30*86400000:3*3600000);await this.cache.delete(fluxJobKey);
      }catch(e){if(e.name==='AbortError')throw e;if(e.jobId)await this.cache.put(fluxJobKey,{jobId:e.jobId},86400000);fluxError={code:e.code||'CAMS_SEA_SALT_FLUX_UNAVAILABLE',message:e.message,...(e.jobId?{jobId:e.jobId}:{})};emit({stage:'cams-sea-salt-flux',year,detail:e.code==='PENDING'?'CAMS沉降通量仍在ADS队列；下次计算继续':'CAMS沉降通量不可用；保留浓度驱动沉降物理，不以0替代',status:'warn'})}
    }else emit({stage:'cams-sea-salt-flux',year,detail:'已复用CAMS海盐沉降通量缓存',cached:true});
    if(flux){env.cams=mergeAutoSeaSaltFlux(env.cams,flux);env.revision+='|saltflux-'+(flux.provenance?.retrievedAt||Date.now())}
    const fluxRatio=fluxCoverage(flux);env.services.camsSeaSaltFlux={configured:flux?true:fluxError?.code==='NOT_CONFIGURED'?false:null,status:fluxRatio>=.95?'valid_data':fluxRatio>0?'partial_data':fluxError?.code==='PENDING'?'pending':'missing',coveragePercent:100*fluxRatio,source:flux?.provenance?.source||'CAMS Sea Salt Deposition Flux',dataset:flux?.provenance?.dataset||null,productType:flux?.provenance?.productType||null,retrievedAt:flux?.provenance?.retrievedAt||null,error:fluxError,policy:'12个CAMS真实通量：3粒径×dry/sedimentation/convective-wet/large-scale-wet；缺失不以0替代'};
    env.retrievedAt=new Date().toISOString();return env;
  }
  async run(input,onProgress=()=>{},options={}){
    const result=await super.run(input,onProgress,options);let assessment=null;
    try{assessment=assessCoastalCorrosion(result,readV340Settings());result.coastalAssessment=assessment;globalThis.__MARINE_V340_LAST_RESULT__=result;globalThis.__MARINE_V340_LAST_ASSESSMENT__=assessment;globalThis.dispatchEvent?.(new CustomEvent('marine:v340',{detail:{result,assessment,version:COASTAL_VERSION}}))}catch(error){globalThis.dispatchEvent?.(new CustomEvent('marine:v340:error',{detail:{error:String(error?.message||error)}}))}return result;
  }
}
