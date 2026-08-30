/* Global Environment Platform - three-tier offline map runtime */
(function(){
  'use strict';

  const FALLBACK_MANIFEST={
    schema:1,format:'xyz',projection:'EPSG:3857',tileSize:256,extension:'png',
    tiers:{
      global:{id:'global',label:'全球低精度',minZoom:2,maxZoom:5,coverage:'world',template:'./tiles/global/{z}/{x}/{y}.png'},
      china:{id:'china',label:'中国中精度',minZoom:6,maxZoom:9,bbox:[73,18,135,54],template:'./tiles/china/{z}/{x}/{y}.png'}
    },
    projectPolicy:{label:'项目区域高精度',minZoom:10,maxZoom:13,recommendedRadiusKm:100,template:'./tiles/projects/{projectId}/{z}/{x}/{y}.png'},
    projects:[]
  };

  let manifest=FALLBACK_MANIFEST;
  let renderZoom=2;
  let activeTier=null;
  const originalRender=renderOsmMap;
  const originalSetBadge=setMapSourceBadge;

  function num(v,d){v=Number(v);return Number.isFinite(v)?v:d}
  function inBBox(lat,lon,b){return Array.isArray(b)&&b.length===4&&lon>=num(b[0],-180)&&lat>=num(b[1],-90)&&lon<=num(b[2],180)&&lat<=num(b[3],90)}
  function fillTemplate(tpl,z,x,y,projectId=''){
    return String(tpl||'').replaceAll('{projectId}',encodeURIComponent(projectId)).replaceAll('{z}',z).replaceAll('{x}',x).replaceAll('{y}',y);
  }
  function projectTier(lat,lon,z){
    const policy=manifest.projectPolicy||FALLBACK_MANIFEST.projectPolicy;
    for(const p of (manifest.projects||[])){
      if(!p||p.enabled===false||!inBBox(lat,lon,p.bbox))continue;
      const minZ=num(p.minZoom,num(policy.minZoom,10)),maxZ=num(p.maxZoom,num(policy.maxZoom,13));
      if(z<minZ||z>maxZ)continue;
      return{id:'project',projectId:String(p.id||'project'),label:p.label||p.name||policy.label||'项目区域高精度',minZoom:minZ,maxZoom:maxZ,bbox:p.bbox,template:p.template||String(policy.template||'./tiles/projects/{projectId}/{z}/{x}/{y}.png')};
    }
    return null;
  }
  function resolveTier(lat,lon,z,name=''){
    const p=projectTier(lat,lon,z);if(p)return p;
    const china=manifest.tiers?.china||FALLBACK_MANIFEST.tiers.china;
    if(isChinaRegion(lat,lon,name)&&z>=num(china.minZoom,6)&&z<=num(china.maxZoom,9))return china;
    const global=manifest.tiers?.global||FALLBACK_MANIFEST.tiers.global;
    if(z>=num(global.minZoom,2)&&z<=num(global.maxZoom,5))return global;
    return null;
  }
  function maxOfflineZoom(lat,lon,name=''){
    let z=num(manifest.tiers?.global?.maxZoom,5);
    if(isChinaRegion(lat,lon,name))z=Math.max(z,num(manifest.tiers?.china?.maxZoom,9));
    const policy=manifest.projectPolicy||FALLBACK_MANIFEST.projectPolicy;
    for(const p of (manifest.projects||[]))if(p&&p.enabled!==false&&inBBox(lat,lon,p.bbox))z=Math.max(z,num(p.maxZoom,num(policy.maxZoom,13)));
    return z;
  }
  function tierForTile(z){
    if(activeTier&&z>=num(activeTier.minZoom,2)&&z<=num(activeTier.maxZoom,13))return activeTier;
    return resolveTier(num(mapState?.lat,20),num(mapState?.lon,15),z,mapState?.name||'');
  }

  localTileUrl=function(z,x,y){
    const tier=tierForTile(z);
    if(!tier)return '__offline_tile_missing__';
    return fillTemplate(tier.template,z,x,y,tier.projectId||'');
  };

  sourceChain=function(lat,lon,name=''){
    const china=isChinaRegion(lat,lon,name),tier=resolveTier(lat,lon,renderZoom,name),online=navigator.onLine!==false;
    activeTier=tier;
    if(!online){
      return{china,primary:tier?'local':'osm',chain:tier?['local']:[]};
    }
    let chain=[];
    if(tier?.id==='project'){
      chain.push('local');
      if(china&&mapConfig.tdtKey)chain.push('tdt');
      if(mapConfig.osmFallback!==false)chain.push('osm');
    }else if(tier?.id==='china'){
      if((mapConfig.chinaMode||'tdt')==='tdt'&&mapConfig.tdtKey)chain.push('tdt','local');
      else chain.push('local');
      if(mapConfig.osmFallback!==false)chain.push('osm');
    }else if(tier){
      chain.push('local');
      if(mapConfig.osmFallback!==false)chain.push('osm');
    }else if(china&&mapConfig.tdtKey){
      chain.push('tdt');
      if(mapConfig.osmFallback!==false)chain.push('osm');
    }else{
      chain.push('osm');
    }
    chain=[...new Set(chain)];
    return{china,primary:chain[0]||'osm',chain};
  };

  setMapSourceBadge=function(source,extra=''){
    const mode=navigator.onLine===false?'离线':'';
    const tier=activeTier?.label||'';
    const detail=[mode,tier,extra].filter(Boolean).join(' · ');
    originalSetBadge(source,detail);
  };

  osmWorldPixel=function(lat,lon,zoom){
    const z=Math.max(2,Math.min(13,Math.round(zoom||2))),n=Math.pow(2,z),safeLat=Math.max(-85.0511,Math.min(85.0511,+lat||0));
    const sin=Math.sin(safeLat*Math.PI/180),x=(+lon+180)/360*n*256,y=(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n*256;
    return{x,y,z,n};
  };

  renderOsmMap=function(lat=20,lon=15,name='全球项目位置',zoom=2){
    lat=num(lat,20);lon=num(lon,15);zoom=Math.max(2,Math.min(13,Math.round(num(zoom,2))));
    if(navigator.onLine===false)zoom=Math.min(zoom,maxOfflineZoom(lat,lon,name));
    renderZoom=zoom;
    activeTier=resolveTier(lat,lon,zoom,name);
    return originalRender(lat,lon,name,zoom);
  };

  mapZoom=function(delta){
    let target=Math.max(2,Math.min(13,num(mapState?.zoom,2)+num(delta,0)));
    if(navigator.onLine===false)target=Math.min(target,maxOfflineZoom(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||''));
    renderOsmMap(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||'项目位置',target);
  };

  async function loadManifest(){
    try{
      const r=await fetch('./tiles/manifest.json',{cache:'no-store'});
      if(r.ok){const j=await r.json();if(j&&j.tiers)manifest=j;}
    }catch(e){/* keep embedded fallback */}
    if(typeof mapState!=='undefined'&&mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom);
  }

  window.addEventListener('online',()=>{if(mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom)});
  window.addEventListener('offline',()=>{if(mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom)});
  window.GEOfflineMap={
    getManifest:()=>manifest,
    getActiveTier:()=>activeTier,
    resolveTier,
    maxOfflineZoom,
    reload:loadManifest
  };

  loadManifest();
})();
