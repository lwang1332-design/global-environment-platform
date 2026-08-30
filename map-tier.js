/* Global Environment Platform - three-tier offline map runtime */
(function(){
  'use strict';

  const FALLBACK_MANIFEST={
    schema:1,format:'xyz',projection:'EPSG:3857',tileSize:256,extension:'png',
    tiers:{
      global:{id:'global',label:'全球低精度',minZoom:2,maxZoom:5,coverage:'world',installed:false,template:'./tiles/global/{z}/{x}/{y}.png'},
      china:{id:'china',label:'中国中精度',minZoom:6,maxZoom:9,bbox:[73,18,135,54],installed:false,template:'./tiles/china/{z}/{x}/{y}.png'}
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
  function installed(tier){return !!tier&&tier.installed===true}
  function fillTemplate(tpl,z,x,y,projectId=''){
    return String(tpl||'').replaceAll('{projectId}',encodeURIComponent(projectId)).replaceAll('{z}',z).replaceAll('{x}',x).replaceAll('{y}',y);
  }
  function projectTier(lat,lon,z){
    const policy=manifest.projectPolicy||FALLBACK_MANIFEST.projectPolicy;
    for(const p of (manifest.projects||[])){
      if(!p||p.enabled===false||!inBBox(lat,lon,p.bbox))continue;
      const minZ=num(p.minZoom,num(policy.minZoom,10)),maxZ=num(p.maxZoom,num(policy.maxZoom,13));
      if(z<minZ||z>maxZ)continue;
      return{id:'project',projectId:String(p.id||'project'),label:p.label||p.name||policy.label||'项目区域高精度',minZoom:minZ,maxZoom:maxZ,bbox:p.bbox,installed:p.installed===true,template:p.template||String(policy.template||'./tiles/projects/{projectId}/{z}/{x}/{y}.png')};
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
    let z=2;
    const g=manifest.tiers?.global||FALLBACK_MANIFEST.tiers.global;
    const c=manifest.tiers?.china||FALLBACK_MANIFEST.tiers.china;
    if(installed(g))z=Math.max(z,num(g.maxZoom,5));
    if(isChinaRegion(lat,lon,name)&&installed(c))z=Math.max(z,num(c.maxZoom,9));
    const policy=manifest.projectPolicy||FALLBACK_MANIFEST.projectPolicy;
    for(const p of (manifest.projects||[]))if(p&&p.enabled!==false&&p.installed===true&&inBBox(lat,lon,p.bbox))z=Math.max(z,num(p.maxZoom,num(policy.maxZoom,13)));
    return z;
  }
  function tierForTile(z){
    if(activeTier&&z>=num(activeTier.minZoom,2)&&z<=num(activeTier.maxZoom,13))return activeTier;
    return resolveTier(num(mapState?.lat,20),num(mapState?.lon,15),z,mapState?.name||'');
  }

  localTileUrl=function(z,x,y){
    const tier=tierForTile(z);
    if(!tier||!installed(tier))return '__offline_tile_missing__';
    return fillTemplate(tier.template,z,x,y,tier.projectId||'');
  };

  sourceChain=function(lat,lon,name=''){
    const china=isChinaRegion(lat,lon,name),tier=resolveTier(lat,lon,renderZoom,name),online=navigator.onLine!==false;
    activeTier=tier;

    if(!online){
      if(tier&&installed(tier))return{china,primary:'local',chain:['local']};
      return{china,primary:'osm',chain:['osm'],offlineMissing:true};
    }

    let chain=[];
    if(tier?.id==='project'){
      if(installed(tier))chain.push('local');
      if(china&&mapConfig.tdtKey)chain.push('tdt');
      if(mapConfig.osmFallback!==false||!chain.length)chain.push('osm');
    }else if(tier?.id==='china'){
      if((mapConfig.chinaMode||'tdt')==='tdt'&&mapConfig.tdtKey)chain.push('tdt');
      if(installed(tier))chain.push('local');
      if(mapConfig.osmFallback!==false||!chain.length)chain.push('osm');
    }else if(tier?.id==='global'){
      if(installed(tier)&&(mapConfig.globalMode||'local')==='local')chain.push('local');
      if((mapConfig.globalMode||'local')==='osm'||!installed(tier)||mapConfig.osmFallback!==false)chain.push('osm');
    }else{
      if(china&&mapConfig.tdtKey)chain.push('tdt');
      if(mapConfig.osmFallback!==false||!chain.length)chain.push('osm');
    }
    chain=[...new Set(chain)].filter(Boolean);
    if(!chain.length)chain=['osm'];
    return{china,primary:chain[0],chain};
  };

  setMapSourceBadge=function(source,extra=''){
    const mode=navigator.onLine===false?'离线':'';
    const tier=activeTier?.label||'';
    const pack=activeTier&&!installed(activeTier)?'离线包未安装':'';
    const detail=[mode,tier,pack,extra].filter(Boolean).join(' · ');
    originalSetBadge(source,detail);
  };

  function showOfflineMissing(lat,lon,name,zoom){
    if(!mapEl)return;
    mapState={lat,lon,name:name||'项目位置',zoom,activeSource:'none'};
    mapEl.innerHTML=`<div class="osmCompatMap" role="img" aria-label="离线地图包未安装" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#eaf2fb,#dce8f4);padding:18px;text-align:center"><div style="max-width:280px;background:rgba(255,255,255,.94);border:1px solid #d7e1ec;border-radius:12px;padding:14px;box-shadow:0 4px 16px rgba(10,42,89,.08)"><div style="font-size:13px;font-weight:800;color:#0a2a59;margin-bottom:6px">离线地图包未安装</div><div style="font-size:10px;line-height:1.6;color:#667085">当前位置：${String(name||'项目位置')}<br>${lat.toFixed(4)}, ${lon.toFixed(4)}<br>联网后自动使用在线底图；离线使用需先安装对应地图包。</div></div></div>`;
    const el=$('mapSourceBadge');if(el){el.className='mapSourceBadge gray';el.textContent='地图源：离线包未安装'}
  }

  function showTileFailureIfNeeded(){
    if(!mapEl||navigator.onLine===false)return;
    const tiles=[...mapEl.querySelectorAll('.osmTile')];
    if(!tiles.length)return;
    const visible=tiles.some(t=>t.complete&&t.naturalWidth>0&&t.style.visibility!=='hidden');
    if(visible)return;
    const done=tiles.every(t=>t.complete||t.style.visibility==='hidden');
    if(!done)return;
    const host=mapEl.querySelector('.osmCompatMap');
    if(!host||host.querySelector('.mapNetError'))return;
    const n=document.createElement('div');
    n.className='mapNetError';
    n.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;width:min(82%,290px);background:rgba(255,255,255,.96);border:1px solid #d7e1ec;border-radius:12px;padding:12px;text-align:center;box-shadow:0 4px 18px rgba(10,42,89,.14);font-size:10px;line-height:1.6;color:#667085';
    n.innerHTML='<b style="display:block;color:#0a2a59;font-size:12px;margin-bottom:4px">在线地图暂时无法访问</b>页面和项目计算仍可使用。请检查当前网络，或安装对应离线地图包。';
    host.appendChild(n);
  }

  handleTileError=function(img){
    const chain=(img.dataset.chain||'').split(',').filter(Boolean),idx=chain.indexOf(img.dataset.source),next=chain[idx+1];
    if(next){
      img.dataset.source=next;
      img.src=tileUrl(next,+img.dataset.z,+img.dataset.x,+img.dataset.y);
      const anno=img.parentElement?.querySelector('.tdtAnno');if(anno)anno.style.display='none';
      setMapSourceBadge(next,'自动降级');
      return;
    }
    img.style.visibility='hidden';
    setTimeout(showTileFailureIfNeeded,80);
  };

  osmWorldPixel=function(lat,lon,zoom){
    const z=Math.max(2,Math.min(13,Math.round(zoom||2))),n=Math.pow(2,z),safeLat=Math.max(-85.0511,Math.min(85.0511,+lat||0));
    const sin=Math.sin(safeLat*Math.PI/180),x=(+lon+180)/360*n*256,y=(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n*256;
    return{x,y,z,n};
  };

  renderOsmMap=function(lat=20,lon=15,name='全球项目位置',zoom=2){
    lat=num(lat,20);lon=num(lon,15);zoom=Math.max(2,Math.min(13,Math.round(num(zoom,2))));
    renderZoom=zoom;
    activeTier=resolveTier(lat,lon,zoom,name);
    if(navigator.onLine===false&&(!activeTier||!installed(activeTier))){
      showOfflineMissing(lat,lon,name,Math.min(zoom,maxOfflineZoom(lat,lon,name)));
      return;
    }
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
    isInstalled:installed,
    reload:loadManifest
  };

  loadManifest();
})();