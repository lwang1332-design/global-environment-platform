import {feature} from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';
import {geoContains} from 'https://cdn.jsdelivr.net/npm/d3-geo@3/+esm';

const R=6371;
const LAND_URL='https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json';
let landPromise=null;

function dest(lat,lon,bearing,km){
  const br=bearing*Math.PI/180,p1=lat*Math.PI/180,l1=lon*Math.PI/180,d=km/R;
  const p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(br));
  const l2=l1+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));
  return [p2*180/Math.PI,((l2*180/Math.PI+540)%360)-180];
}

async function loadLand(){
  if(!landPromise){
    landPromise=fetch(LAND_URL,{cache:'force-cache'}).then(async r=>{
      if(!r.ok)throw new Error(`Natural Earth land mask ${r.status}`);
      const topo=await r.json();
      if(!topo?.objects?.land)throw new Error('Natural Earth land object missing');
      return feature(topo,topo.objects.land);
    });
  }
  return landPromise;
}

function onLand(land,lat,lon){return geoContains(land,[lon,lat]);}

function refineTransition(land,lat,lon,bearing,lo,hi,loState){
  let a=lo,b=hi;
  for(let i=0;i<8;i++){
    const m=(a+b)/2,p=dest(lat,lon,bearing,m),state=onLand(land,p[0],p[1]);
    if(state===loState)a=m;else b=m;
  }
  return b;
}

async function siteElevation(lat,lon,siteLand){
  if(!siteLand)return null;
  try{
    const u=new URL('https://api.open-meteo.com/v1/elevation');
    u.searchParams.set('latitude',String(lat));u.searchParams.set('longitude',String(lon));
    const r=await fetch(u,{cache:'force-cache'});if(!r.ok)return null;
    const d=await r.json(),v=Number(d?.elevation?.[0]);return Number.isFinite(v)?v:null;
  }catch{return null;}
}

export async function fallbackGisContext(lat,lon){
  const land=await loadLand();
  const siteLand=onLand(land,lat,lon);
  const bearings=[...Array(24)].map((_,i)=>i*15);
  const dists=[0.25,0.5,1,2,5,10,20,40,80,150,300,600,1000];
  const bins=[];

  for(const bearing of bearings){
    let prevD=0,prevState=siteLand,firstChange=null,secondChange=null;
    for(const d of dists){
      const p=dest(lat,lon,bearing,d),state=onLand(land,p[0],p[1]);
      if(state!==prevState){
        const refined=refineTransition(land,lat,lon,bearing,prevD,d,prevState);
        if(firstChange===null)firstChange=refined;else{secondChange=refined;break;}
        prevState=state;
      }
      prevD=d;
    }
    if(siteLand){
      const seaDistance=firstChange??1200;
      const fetch=firstChange===null?0:Math.max(0,(secondChange??1000)-firstChange);
      bins.push({bearing,seaDistanceKm:seaDistance,fetchKm:fetch});
    }else{
      const firstLand=firstChange;
      bins.push({bearing,seaDistanceKm:0,fetchKm:firstLand??1000});
    }
  }

  let distanceToCoastKm,coastBearing;
  if(siteLand){
    const best=bins.reduce((a,b)=>b.seaDistanceKm<a.seaDistanceKm?b:a,bins[0]);
    distanceToCoastKm=best.seaDistanceKm;coastBearing=best.bearing;
  }else{
    const best=bins.reduce((a,b)=>b.fetchKm<a.fetchKm?b:a,bins[0]);
    distanceToCoastKm=best.fetchKm;coastBearing=best.bearing;
  }
  const elevation=await siteElevation(lat,lon,siteLand);
  return {
    elevation,
    siteMedium:siteLand?'land':'sea',
    distanceToCoastKm,
    coastBearing,
    bearingBins:bins,
    provenance:{
      type:'CALC/FALLBACK',
      source:'Natural Earth 1:50m land mask (world-atlas) + radial fetch',
      resolution:'1:50m coastline; 15° bearings; transition refined by bisection',
      confidence:'C',
      note:'浏览器Fallback：不调用OpenTopoData POST，因此无CORS依赖。适用于工程筛查；微地形/港池/小岛需以GSHHG Direct复核。'
    }
  };
}

export async function resolveGis(lat,lon,direct){
  if(direct?.gis?.bearingBins?.length)return direct.gis;
  return fallbackGisContext(Number(lat),Number(lon));
}
