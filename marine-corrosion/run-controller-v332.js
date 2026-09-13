import {number,stableStringify,checkAbort} from './data-quality.js';
import {RunCoordinator as RunCoordinator330,DataCache,abortable,computeInWorker,mergeEnvironments} from './run-controller-v330.js';
import {fetchCamsSo2Auto,mergeAutoSo2} from './sources-v332.js';

export {DataCache,abortable,computeInWorker,mergeEnvironments};
export const DATA_VERSION='3.3.2';

function coverage(series){
  if(!series?.time?.length)return 0;
  return (series.so2||[]).filter(v=>number(v)!==null).length/series.time.length;
}

export class RunCoordinator extends RunCoordinator330{
  constructor(options={}){
    const {camsSo2Auto,...base}=options;
    super(base);
    this.camsSo2Auto=camsSo2Auto||fetchCamsSo2Auto;
  }

  async environment(snapshot,year,signal,emit,options={}){
    const env=await super.environment(snapshot,year,signal,emit,options);
    checkAbort(signal);
    const {latitude:lat,longitude:lon,mode}=snapshot.cfg;
    const cacheKey='cams-so2|'+stableStringify({v:DATA_VERSION,lat,lon,mode,year:year||null,axisStart:env.weather.time[0],axisEnd:env.weather.time.at(-1)});
    let so2=!options.fresh&&await this.cache.get(cacheKey),so2Error=null;
    if(!so2){
      emit({stage:'cams-so2',year,detail:mode==='historical'?'CAMS EAC4：获取月平均SO₂并映射到小时轴':'CAMS Forecast：获取最低模式层SO₂预报'});
      try{
        so2=await this.camsSo2Auto({lat,lon,mode,year,baseTimes:env.weather.time,signal});
        const ttl=mode==='historical'?30*86400000:3*3600000;
        await this.cache.put(cacheKey,so2,ttl);
      }catch(e){
        if(e.name==='AbortError')throw e;
        so2Error={code:e.code||'CAMS_SO2_UNAVAILABLE',message:e.message};
        emit({stage:'cams-so2',year,detail:'CAMS SO₂ Auto不可用；不制造Pd，保持L1并允许人工Pc/Pd',status:'warn'});
      }
    }else emit({stage:'cams-so2',year,detail:'已复用CAMS SO₂ Auto缓存',cached:true});

    if(so2){env.cams=mergeAutoSo2(env.cams,so2);env.revision+='|so2-'+(so2.provenance?.retrievedAt||Date.now());}
    const ratio=coverage(so2);
    env.services={...(env.services||{}),camsSo2:{
      configured:so2?true:so2Error?.code==='NOT_CONFIGURED'?false:null,
      status:ratio>=.95?'valid_data':ratio>0?'partial_data':'missing',
      coveragePercent:100*ratio,
      source:so2?.provenance?.source||'CAMS SO₂ Auto',
      dataset:so2?.provenance?.dataset||null,
      modelLevel:so2?.provenance?.modelLevel||null,
      retrievedAt:so2?.provenance?.retrievedAt||null,
      error:so2Error,
      policy:'缺失时保持MISSING；不恢复Pd=1固定Fallback'
    }};
    env.retrievedAt=new Date().toISOString();
    return env;
  }
}
