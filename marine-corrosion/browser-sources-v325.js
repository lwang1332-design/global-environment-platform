function toDeg(u,v){return(Math.atan2(-u,-v)*180/Math.PI+360)%360}
function ws(u,v){return Math.sqrt(u*u+v*v)}
export function alignSeries(baseTimes,source,fields,{circularFields=[]}={}){
  if(!source?.time?.length)return null;
  const ts=source.time.map((t,i)=>({ms:new Date(t).getTime(),i})).filter(x=>Number.isFinite(x.ms)).sort((a,b)=>a.ms-b.ms);
  if(!ts.length)return null;const circ=new Set(circularFields),out={time:baseTimes};
  const lowerIndex=ms=>{let lo=0,hi=ts.length-1,ans=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(ts[mid].ms<=ms){ans=mid;lo=mid+1}else hi=mid-1}return ans};
  for(const f of fields)out[f]=baseTimes.map(t=>{const ms=new Date(t).getTime();if(!Number.isFinite(ms))return null;let a=lowerIndex(ms);if(a<0)a=0;let b=Math.min(a+1,ts.length-1);if(ts[a].ms===ms)b=a;const va=Number(source[f]?.[ts[a].i]),vb=Number(source[f]?.[ts[b].i]);if(!Number.isFinite(va)&&!Number.isFinite(vb))return null;if(!Number.isFinite(va))return vb;if(!Number.isFinite(vb)||a===b)return va;if(ms<ts[0].ms||ms>ts[ts.length-1].ms)return null;const frac=(ms-ts[a].ms)/(ts[b].ms-ts[a].ms||1);if(circ.has(f)){const d=((vb-va+540)%360)-180;return(va+frac*d+360)%360}return va+(vb-va)*frac});
  return out;
}
async function fetchJson(url,opt={}){const r=await fetch(url,opt);if(!r.ok)throw new Error(`${url} -> ${r.status}`);return r.json()}
export async function fetchOpenMeteoHistorical(lat,lon,year){
  const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),start_date:`${year}-01-01`,end_date:`${year}-12-31`,hourly:'temperature_2m,dew_point_2m,relative_humidity_2m,precipitation,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,wind_speed_100m,wind_direction_100m,shortwave_radiation',wind_speed_unit:'ms',timezone:'UTC'});
  const d=await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${q}`);const h=d.hourly;
  return{time:h.time,t:h.temperature_2m,td:h.dew_point_2m,rh:h.relative_humidity_2m,rain:h.precipitation,pressure:h.surface_pressure,cloud:h.cloud_cover,u10:h.wind_speed_10m,wd:h.wind_direction_10m,u100:h.wind_speed_100m,wd100:h.wind_direction_100m,sw:h.shortwave_radiation,blh:Array(h.time.length).fill(800),provenance:{type:'RAW/FALLBACK',source:'Open-Meteo Historical (ERA5-family reanalysis)',note:'ERA5 Direct不可达时使用；BLH为800 m EST fallback。'}}
}
export async function fetchOpenMeteoCurrent(lat,lon){
  const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),hourly:'temperature_2m,dew_point_2m,relative_humidity_2m,precipitation,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,wind_speed_100m,wind_direction_100m,shortwave_radiation',wind_speed_unit:'ms',timezone:'UTC',forecast_days:'7',past_days:'1'});
  const d=await fetchJson(`https://api.open-meteo.com/v1/forecast?${q}`);const h=d.hourly;
  return{time:h.time,t:h.temperature_2m,td:h.dew_point_2m,rh:h.relative_humidity_2m,rain:h.precipitation,pressure:h.surface_pressure,cloud:h.cloud_cover,u10:h.wind_speed_10m,wd:h.wind_direction_10m,u100:h.wind_speed_100m,wd100:h.wind_direction_100m,sw:h.shortwave_radiation,blh:Array(h.time.length).fill(800),provenance:{type:'RAW/FALLBACK',source:'Open-Meteo Forecast',note:'Current模式天气fallback。'}}
}
function isHistoricalAxis(baseTimes){if(!Array.isArray(baseTimes)||baseTimes.length<24)return false;const a=new Date(baseTimes[0]),b=new Date(baseTimes[baseTimes.length-1]);return Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())&&(b-a)>120*864e5}
function yyyyMmDd(t){return new Date(t).toISOString().slice(0,10)}
export async function fetchOpenMeteoMarine(lat,lon,baseTimes){
  const historical=isHistoricalAxis(baseTimes);
  try{
    const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),hourly:'wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_period,swell_wave_height,swell_wave_period',timezone:'UTC'});
    if(historical){q.set('start_date',yyyyMmDd(baseTimes[0]));q.set('end_date',yyyyMmDd(baseTimes[baseTimes.length-1]));q.set('models','era5_ocean')}else{q.set('forecast_days','7');q.set('past_days','1')}
    const d=await fetchJson(`https://marine-api.open-meteo.com/v1/marine?${q}`,{signal:AbortSignal.timeout(45000)});const h=d.hourly;
    const raw={time:h.time,hs:h.wave_height,tp:h.wave_period,wdir:h.wave_direction,windWaveHs:h.wind_wave_height,windWaveTp:h.wind_wave_period,swellHs:h.swell_wave_height,swellTp:h.swell_wave_period};
    const a=alignSeries(baseTimes,raw,['hs','tp','wdir','windWaveHs','windWaveTp','swellHs','swellTp'],{circularFields:['wdir']})||{time:baseTimes};
    a.salinity=Array(baseTimes.length).fill(35);a.sst=Array(baseTimes.length).fill(null);
    a.provenance={type:'FALLBACK+EST',source:historical?'Open-Meteo ERA5-Ocean Historical + salinity proxy':'Open-Meteo Marine Forecast + salinity proxy',note:'波浪来自Open-Meteo fallback；盐度35 PSU为EST，绝不标记为CMEMS RAW。'};return a;
  }catch(e){return{time:baseTimes,hs:Array(baseTimes.length).fill(1.5),tp:Array(baseTimes.length).fill(7),wdir:Array(baseTimes.length).fill(0),windWaveHs:Array(baseTimes.length).fill(null),windWaveTp:Array(baseTimes.length).fill(null),swellHs:Array(baseTimes.length).fill(null),swellTp:Array(baseTimes.length).fill(null),salinity:Array(baseTimes.length).fill(35),sst:Array(baseTimes.length).fill(null),provenance:{type:'EST',source:'Ocean engineering fallback proxy',note:`海洋历史/预报数据调用失败，使用显式EST代理：${e.message}`}}}
}
export async function fetchDirectGateway({lat,lon,mode,year,height}){
  const base='https://global-marine-corrosion-direct-v322-lwang1332-4885.vercel.app';const payload={lat:Number(lat),lon:Number(lon),mode:mode==='current'?'current':'historical',height:Number(height||10)};if(year)payload.year=Number(year);
  const r=await fetch(`${base}/api/direct`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  if(!r.ok){let msg=`Vercel Direct ${r.status}`;try{const d=await r.json();msg=d.detail||d.error||msg}catch{}throw new Error(msg)}return r.json()
}
export function normalizeDirectWeather(w){if(!w?.time?.length)return null;const n=w.time.length;let u10=w.wind_speed_10m,wd=w.wind_direction_10m,u100=w.wind_speed_100m,wd100=w.wind_direction_100m;if(!u10&&w.u10_component&&w.v10_component){u10=w.u10_component.map((u,i)=>ws(u,w.v10_component[i]));wd=w.u10_component.map((u,i)=>toDeg(u,w.v10_component[i]))}if(!u100&&w.u100_component&&w.v100_component){u100=w.u100_component.map((u,i)=>ws(u,w.v100_component[i]));wd100=w.u100_component.map((u,i)=>toDeg(u,w.v100_component[i]))}return{time:w.time,t:w.temperature_2m,td:w.dewpoint_2m,rh:w.relative_humidity,rain:w.precipitation,pressure:w.surface_pressure,cloud:w.cloud_cover,u10,wd,u100:u100||u10,wd100:wd100||wd,sw:w.shortwave_down,blh:w.boundary_layer_height||Array(n).fill(800),provenance:{type:'RAW',source:w.source||'ERA5 Direct'}}}
export function normalizeDirectCams(cams,baseTimes){if(!cams?.time?.length)return null;const a=alignSeries(baseTimes,cams,['ss1','ss2','ss3','so2']);if(a)a.provenance={type:'RAW',source:cams.source||'CAMS Direct',resolution:cams.resolution||'3h→1h aligned'};return a}
export function normalizeDirectOcean(ocean,baseTimes){if(!ocean?.time?.length)return null;const a=alignSeries(baseTimes,ocean,['hs','tp','wdir','windWaveHs','windWaveTp','swellHs','swellTp','salinity','sst'],{circularFields:['wdir']});if(a)a.provenance={type:'RAW',source:ocean.source||'CMEMS Direct',resolution:ocean.resolution||'native→1h aligned'};return a}
