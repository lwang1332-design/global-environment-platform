/* Global Environment Platform V3.3 - public data source adapters
 * Fail-soft point queries for coastline distance and NASA POWER UV-B/skin temperature.
 * Other global sources are registered with maturity/status but are not fabricated.
 */
(()=>{
'use strict';
if(window.GEDataSourcesV33?.installed)return;
const finite=v=>Number.isFinite(Number(v)),DAY=864e5;
const state={coast:null,power:null,uvb:null,skinTemperature:null,landcover:null,lightning:null,cyclone:null,lastKey:null};
const selectedYears=()=>{const y=Number(document.getElementById('years')?.value);return[1,3,5].includes(y)?y:1};
const iso=d=>d.toISOString().slice(0,10),compact=d=>iso(d).replace(/-/g,'');
function range(){let end=new Date();end.setUTCDate(end.getUTCDate()-10);let start=new Date(end);start.setUTCFullYear(start.getUTCFullYear()-selectedYears());return{start,end}}
async function fetchText(url,timeout=18000){
 const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),timeout);
 try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(id)}
}
async function fetchJson(url,timeout=22000){
 const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),timeout);
 try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(j?.error)throw new Error(j.error?.message||j.reason||'data source error');return j}finally{clearTimeout(id)}
}
function parseErddapCsv(t){
 const rows=String(t||'').trim().split(/\r?\n/);if(rows.length<3)return NaN;
 for(let i=2;i<rows.length;i++){const cols=rows[i].split(',');const v=Number(cols.at(-1));if(finite(v)&&v>-1e9)return v}
 return NaN;
}
async function coastOne(dataset,lat,lon){
 const query='dist[('+Number(lat).toFixed(4)+')][('+Number(lon).toFixed(4)+')]';
 const url='https://pae-paha.pacioos.hawaii.edu/erddap/griddap/'+dataset+'.csv?'+encodeURIComponent(query);
 const t=await fetchText(url);const v=parseErddapCsv(t);return finite(v)?v:NaN;
}
async function fetchCoast(lat,lon){
 const [land,ocean]=await Promise.allSettled([coastOne('dist2coast_4deg_land',lat,lon),coastOne('dist2coast_4deg_ocean',lat,lon)]);
 const lv=land.status==='fulfilled'?land.value:NaN,ov=ocean.status==='fulfilled'?ocean.value:NaN;
 let distance=NaN,domain='unknown';if(finite(lv)){distance=lv;domain='land'}if(finite(ov)&&(!finite(distance)||ov<distance)){distance=ov;domain='ocean'}
 if(!finite(distance))throw new Error('PacIOOS point returned no valid distance');
 return{ok:true,value:distance,unit:'km',domain,source:'NASA OBPG / PacIOOS ERDDAP dist2coast 0.04°',resolution:'0.04° (~4 km)',uncertainty:'dataset documentation notes kilometre-scale uncertainty'};
}
async function fetchPower(lat,lon){
 const rg=range(),params='ALLSKY_SFC_UVB,TS';
 const url='https://power.larc.nasa.gov/api/temporal/daily/point?parameters='+params+'&community=AG&longitude='+encodeURIComponent(lon)+'&latitude='+encodeURIComponent(lat)+'&start='+compact(rg.start)+'&end='+compact(rg.end)+'&format=JSON';
 const j=await fetchJson(url,30000),par=j?.properties?.parameter||{},uv=par.ALLSKY_SFC_UVB||{},ts=par.TS||{};
 const uvSeries=[],tsSeries=[];
 for(const [k,v] of Object.entries(uv)){const n=Number(v);if(finite(n)&&n>-900){const d=new Date(k.slice(0,4)+'-'+k.slice(4,6)+'-'+k.slice(6,8)+'T12:00:00Z');uvSeries.push({time:d.toISOString(),ts:d.getTime(),value:n})}}
 for(const [k,v] of Object.entries(ts)){const n=Number(v);if(finite(n)&&n>-900){const d=new Date(k.slice(0,4)+'-'+k.slice(4,6)+'-'+k.slice(6,8)+'T12:00:00Z');tsSeries.push({time:d.toISOString(),ts:d.getTime(),value:n})}}
 if(!uvSeries.length&&!tsSeries.length)throw new Error('NASA POWER returned no UVB/TS points');
 return{ok:true,start:iso(rg.start),end:iso(rg.end),source:'NASA POWER Daily Point API',uvb:uvSeries,skinTemperature:tsSeries,parameters:['ALLSKY_SFC_UVB','TS']};
}
function attachCache(){
 try{if(window.cache)window.cache.v33={coast:state.coast,power:state.power,landcover:state.landcover,lightning:state.lightning,cyclone:state.cyclone}}catch{}
 document.dispatchEvent(new CustomEvent('ge:v33-data-updated',{detail:{state}}));
}
async function refresh(cur){
 const lat=Number(cur?.lat),lon=Number(cur?.lon);if(!finite(lat)||!finite(lon))return state;
 const key=lat.toFixed(5)+','+lon.toFixed(5)+','+selectedYears();if(state.lastKey===key&&state.coast&&state.power)return state;state.lastKey=key;
 const [coast,power]=await Promise.allSettled([fetchCoast(lat,lon),fetchPower(lat,lon)]);
 state.coast=coast.status==='fulfilled'?coast.value:{ok:false,error:String(coast.reason||'coast query failed'),source:'NASA OBPG / PacIOOS ERDDAP'};
 state.power=power.status==='fulfilled'?power.value:{ok:false,error:String(power.reason||'POWER query failed'),source:'NASA POWER'};
 state.uvb=state.power?.ok?{ok:true,start:state.power.start,end:state.power.end,series:state.power.uvb,source:state.power.source}:{ok:false,source:'NASA POWER'};
 state.skinTemperature=state.power?.ok?{ok:true,start:state.power.start,end:state.power.end,series:state.power.skinTemperature,source:state.power.source}:{ok:false,source:'NASA POWER'};
 state.landcover={ok:false,status:'B',source:'ESA WorldCover 10 m 2021',note:'全球公开COG已确认；浏览器端无稳定无鉴权点查询API，保留公开COG/未来后端采样接口，不伪造分类。'};
 state.lightning={ok:false,status:'B',source:'NASA LIS/OTD gridded climatology',note:'全球长期气候场已确认；当前没有稳定无鉴权点API，待后端/静态栅格采样。'};
 state.cyclone={ok:false,status:'B',source:'NOAA IBTrACS',note:'全球Best Track公开可接；不在浏览器端整库下载，待轻量后端按半径查询。'};
 attachCache();return state;
}
const baseAssess=window.assess;
if(typeof baseAssess==='function'&&!baseAssess.__v33){
 const wrapped=async function(){const out=await baseAssess.apply(this,arguments);try{await refresh(arguments[0]||window.current)}catch(e){console.warn('[GE V3.3] auxiliary data refresh failed',e)}return out};wrapped.__v33=true;window.assess=wrapped;
}
window.GEDataSourcesV33={installed:true,version:'3.3.0',state,refresh,access:{
 coast:{status:'A/B',source:'NASA OBPG / PacIOOS ERDDAP 0.04°'},
 uvb:{status:'A/B',source:'NASA POWER ALLSKY_SFC_UVB'},
 skinTemperature:{status:'A/B',source:'NASA POWER TS'},
 landcover:{status:'B',source:'ESA WorldCover 10 m COG'},
 lightning:{status:'B',source:'NASA LIS/OTD gridded climatology'},
 cyclone:{status:'B',source:'NOAA IBTrACS Best Track'},
 rainChemistry:{status:'D',source:'WMO WDCPC stations'},
 h2s:{status:'D',source:'regional/industrial monitoring'},
 icing:{status:'C/D',source:'physical model / regional observation'}
}};
setTimeout(()=>{try{if(window.current&&finite(window.current.lat)&&finite(window.current.lon)&&window.cache?.w)refresh(window.current)}catch{}},2500);
})();