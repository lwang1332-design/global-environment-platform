/* Global Environment Platform V3.1 - data source upgrades
 * Adds long-period CAMS retrieval and real gust time series where available.
 * Never fabricates missing observations; every extension carries coverage metadata.
 */
(()=>{
'use strict';
if(window.GEDataSourcesV31?.installed)return;
const finite=v=>Number.isFinite(Number(v));
const iso=d=>d.toISOString().slice(0,10);
const selectedYears=()=>{const y=Number(document.getElementById('years')?.value);return [1,3,5].includes(y)?y:1};
const originalWeather=window.weather;
const originalAir=window.air;
const originalAssess=window.assess;
function dateRange(years){let end=new Date();end.setUTCDate(end.getUTCDate()-10);let start=new Date(end);start.setUTCFullYear(start.getUTCFullYear()-years);return{start,end}}
function chunks(start,end){const out=[];let c=new Date(start);while(c<=end){let ce=new Date(Date.UTC(c.getUTCFullYear(),11,31));if(ce>end)ce=new Date(end);out.push([new Date(c),ce]);c=new Date(Date.UTC(ce.getUTCFullYear()+1,0,1))}return out}
function mergeHourly(target,source,keys){if(!target||!source?.time?.length)return;target.time=target.time||[];const idx=new Map(target.time.map((t,i)=>[t,i]));keys.forEach(k=>{if(!Array.isArray(target[k]))target[k]=Array(target.time.length).fill(null)});for(let i=0;i<source.time.length;i++){const j=idx.get(source.time[i]);if(j===undefined)continue;keys.forEach(k=>{const v=source[k]?.[i];if(v!==undefined)target[k][j]=v})}}
async function fetchChunked(baseUrl,lat,lon,start,end,vars,extra=''){
 const merged={time:[]};
 for(const [cs,ce] of chunks(start,end)){
  const url=`${baseUrl}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${iso(cs)}&end_date=${iso(ce)}&hourly=${encodeURIComponent(vars.join(','))}&timezone=UTC${extra}`;
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();if(j?.error)throw new Error(j.reason||'data source error');
  const h=j.hourly||{};for(const [k,v] of Object.entries(h)){if(!Array.isArray(v))continue;if(!merged[k])merged[k]=[];merged[k].push(...v)}
 }
 return merged;
}
async function fetchGust(lat,lon,start,end){
 const attempts=[
  {name:'Open-Meteo ERA5-Land gust reanalysis',url:'https://archive-api.open-meteo.com/v1/archive',extra:'&wind_speed_unit=ms&models=era5_land'},
  {name:'Open-Meteo historical forecast archive',url:'https://historical-forecast-api.open-meteo.com/v1/forecast',extra:'&wind_speed_unit=ms'}
 ];
 for(const a of attempts){
  try{const h=await fetchChunked(a.url,lat,lon,start,end,['wind_gusts_10m'],a.extra);if((h.wind_gusts_10m||[]).some(finite))return{ok:true,hourly:h,source:a.name}}
  catch(e){console.warn('[GE V3.1] gust source failed',a.name,e)}
 }
 return{ok:false,hourly:null,source:'unavailable'}
}
async function weatherV31(lat,lon,years){
 if(typeof originalWeather!=='function')throw new Error('base weather() unavailable');
 const range=dateRange(years),basePromise=originalWeather(lat,lon,years),gustPromise=fetchGust(lat,lon,range.start,range.end);
 const base=await basePromise;const gust=await gustPromise.catch(()=>({ok:false}));
 if(gust.ok&&base?.j?.hourly){mergeHourly(base.j.hourly,gust.hourly,['wind_gusts_10m']);base.v31Sources={...(base.v31Sources||{}),gust:{status:'A',source:gust.source,start:base.start,end:base.end,dataClass:'再分析/历史档案'}}}
 else base.v31Sources={...(base.v31Sources||{}),gust:{status:'B',source:'Open-Meteo gust archive',start:null,end:null,dataClass:'可直接接入但本次查询失败'}};
 return base;
}
async function airV31(lat,lon){
 const years=selectedYears();let end=new Date();end.setUTCDate(end.getUTCDate()-1);let requestedStart=new Date(end);requestedStart.setUTCFullYear(requestedStart.getUTCFullYear()-years);
 const availabilityStart=new Date(Date.UTC(2022,7,1));const start=requestedStart<availabilityStart?availabilityStart:requestedStart;
 const vars=['pm10','pm2_5','dust','sea_salt_aerosol','sulphur_dioxide','nitrogen_dioxide','ozone','uv_index','uv_index_clear_sky'];
 try{
  const hourly=await fetchChunked('https://air-quality-api.open-meteo.com/v1/air-quality',lat,lon,start,end,vars,'&domains=cams_global');
  if(!(hourly.time||[]).length)throw new Error('CAMS returned no time series');
  return{ok:true,j:{hourly},start:iso(start),end:iso(end),requestedStart:iso(requestedStart),requestedEnd:iso(end),availabilityStart:'2022-08-01',coverageClipped:start>requestedStart,sourceMeta:{status:'A',source:'Open-Meteo CAMS Global',nativeResolution:'3-hourly / API time series',note:'Global CAMS availability starts 2022-08; requested 5-year periods may therefore be clipped.'}}
 }catch(e){
  console.warn('[GE V3.1] extended CAMS failed; falling back to legacy 90-day request',e);
  if(typeof originalAir==='function'){const legacy=await originalAir(lat,lon);legacy.sourceMeta={status:legacy.ok?'A':'E',source:'Open-Meteo CAMS Global legacy fallback',nativeResolution:'3-hourly',note:'Extended period query failed; using legacy short-period data.'};legacy.requestedStart=iso(requestedStart);legacy.requestedEnd=iso(end);return legacy}
  return{ok:false,j:null,start:iso(start),end:iso(end),requestedStart:iso(requestedStart),requestedEnd:iso(end),sourceMeta:{status:'E',source:'CAMS Global',note:String(e)}}
 }
}
window.weather=weatherV31;
window.air=airV31;
window.GEDataSourcesV31={installed:true,version:'3.1.0',weatherV31,airV31,access:{
 gust:{status:'A/B',source:'Open-Meteo ERA5-Land / Historical Forecast archive'},
 cams:{status:'A',source:'CAMS Global via Open-Meteo',availabilityStart:'2022-08-01'},
 coastline:{status:'B',source:'NOAA GSHHG / Natural Earth'},
 landcover:{status:'B',source:'ESA WorldCover'},
 cyclone:{status:'B',source:'NOAA IBTrACS'},
 lightning:{status:'B',source:'NASA LIS/OTD climatology'},
 rainChemistry:{status:'D',source:'WMO WDCPC station network'},
 uvb:{status:'B',source:'NASA POWER'},
 icing:{status:'C/D',source:'physical model / regional observation'}
}};
function needsUpgrade(){try{const h=window.cache?.w?.j?.hourly||{},aq=window.cache?.aq;const gust=(h.wind_gusts_10m||[]).some(finite);const desired=selectedYears();const aqDays=aq?.start&&aq?.end?(new Date(aq.end)-new Date(aq.start))/864e5:0;return !gust||aqDays<Math.min(365*desired-20,365*3)}catch{return false}}
function upgradeExisting(){if(window.__GE_V31_UPGRADE_ONCE__||typeof originalAssess!=='function'||!window.current||!finite(window.current.lat)||!finite(window.current.lon)||!window.cache?.w||!needsUpgrade())return;window.__GE_V31_UPGRADE_ONCE__=true;try{const s=document.getElementById('status');if(s)s.textContent='正在升级数据源：真实阵风 + 扩展CAMS历史…';window.assess(window.current)}catch(e){console.warn('[GE V3.1] automatic data source refresh failed',e)}}
setTimeout(upgradeExisting,900);setTimeout(upgradeExisting,2200);setTimeout(upgradeExisting,4500);
})();