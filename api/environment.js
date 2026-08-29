const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, s-maxage=21600, stale-while-revalidate=86400',
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,OPTIONS',
  'access-control-allow-headers':'Content-Type, Accept'
};
function send(res,status,body){Object.entries(JSON_HEADERS).forEach(([k,v])=>res.setHeader(k,v));return res.status(status).json(body)}
function validNum(v,min,max){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null}
export default async function handler(req,res){
  if(req.method==='OPTIONS')return send(res,200,{ok:true});
  if(req.method!=='GET')return send(res,405,{error:true,message:'Method not allowed'});
  const type=String(req.query.type||'era5').toLowerCase();
  if(type!=='era5')return send(res,400,{error:true,message:'Unsupported data type'});
  const lat=validNum(req.query.latitude,-90,90),lon=validNum(req.query.longitude,-180,180),start=validDate(req.query.start_date),end=validDate(req.query.end_date);
  if(lat===null||lon===null||!start||!end)return send(res,400,{error:true,message:'Invalid latitude, longitude or date range'});
  const hourly=['temperature_2m','relative_humidity_2m','dew_point_2m','precipitation','snowfall','wind_speed_10m','wind_gusts_10m','shortwave_radiation','surface_pressure','cloud_cover'].join(',');
  const daily=['temperature_2m_max','temperature_2m_min','precipitation_sum','snowfall_sum'].join(',');
  const qs=new URLSearchParams({latitude:String(lat),longitude:String(lon),start_date:start,end_date:end,hourly,daily,timezone:'auto',models:'era5',wind_speed_unit:'ms'});
  const upstream=`https://archive-api.open-meteo.com/v1/archive?${qs.toString()}`;
  try{
    const r=await fetch(upstream,{headers:{accept:'application/json'}});
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||data.error)return send(res,502,{error:true,message:data?.reason||`ERA5 upstream failed (${r.status})`,upstream_status:r.status});
    return send(res,200,{ok:true,source:'ERA5 via Open-Meteo Historical Weather API',model:'ERA5',resolution:'0.25° (~25 km)',temporal_resolution:'hourly',start_date:start,end_date:end,queried_at:new Date().toISOString(),data});
  }catch(err){return send(res,502,{error:true,message:'ERA5 backend network error',detail:String(err?.message||err)})}
}