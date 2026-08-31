const CACHE='global-env-v2.9-cockpit-v1';
const TILE_CACHE='global-env-map-tiles-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/app-icon.svg','./map-tier.js','./tiles/manifest.json','./assets/goldwind-logo.png','./assets/ui-engineering.css','./assets/ui-engineering.js','./assets/v29.css','./assets/v29-runtime-config.js','./assets/v29-config.js','./assets/v29-joint.js','./assets/cockpit-v29.css','./assets/cockpit-v29.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==TILE_CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 const isMapTile=u.hostname==='tile.openstreetmap.org'||u.hostname.endsWith('.tiandi tu.gov.cn'.replace(' ',''));
 if(isMapTile){
  e.respondWith(caches.open(TILE_CACHE).then(async c=>{
   const cached=await c.match(e.request);
   try{const net=await fetch(e.request);if(net&&(net.ok||net.type==='opaque'))c.put(e.request,net.clone());return net}catch(err){return cached||Response.error()}
  }));return;
 }
 if(u.origin!==location.origin)return;
 e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
