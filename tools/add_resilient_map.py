from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old="""let map={setView(){},invalidateSize(){},on(){}},marker={setLatLng(){},bindPopup(){return this},openPopup(){return this}};\nconst mapEl=$('map');if(mapEl){mapEl.innerHTML='<div style=\"height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#eef4fb,#f8fbff);color:#667085;text-align:center;padding:16px;box-sizing:border-box\"><div><b style=\"color:#0a2a59\">全球位置输入</b><br><span style=\"font-size:12px\">位置查询与环境计算不依赖第三方地图CDN。<br>可输入“Basra, Iraq”或“30.5085,47.7804”。</span></div></div>';}\n"""
new=r"""let map={setView(){},invalidateSize(){},on(){}},marker={setLatLng(){},bindPopup(){return this},openPopup(){return this}};
const mapEl=$('map');
let mapReady=false, mapLoadStarted=false;
function mapFallback(msg='地图服务暂不可用，不影响环境数据查询与计算'){
 if(!mapEl)return;
 mapEl.innerHTML=`<div style="height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#eef4fb,#f8fbff);color:#667085;text-align:center;padding:16px;box-sizing:border-box"><div><b style="color:#0a2a59">全球项目位置</b><br><span style="font-size:11px">${msg}</span></div></div>`;
}
function loadCss(href){return new Promise((res,rej)=>{let l=document.createElement('link');l.rel='stylesheet';l.href=href;l.onload=res;l.onerror=rej;document.head.appendChild(l)})}
function loadJs(src){return new Promise((res,rej)=>{let x=document.createElement('script');x.src=src;x.async=true;x.onload=res;x.onerror=rej;document.head.appendChild(x)})}
async function initMap(){
 if(mapLoadStarted||!mapEl)return; mapLoadStarted=true;
 mapFallback('正在加载 OpenStreetMap…');
 const cdns=[
  ['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css','https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'],
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js']
 ];
 let ok=false;
 for(const [css,js] of cdns){try{if(!window.L){await loadCss(css);await loadJs(js)};if(window.L){ok=true;break}}catch(e){}}
 if(!ok){mapFallback();return}
 try{
  mapEl.innerHTML='';
  map=L.map(mapEl,{zoomControl:true,attributionControl:true,worldCopyJump:true}).setView([20,15],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors',crossOrigin:true}).addTo(map);
  marker=L.circleMarker([20,15],{radius:7,weight:3,color:'#1769e0',fillColor:'#ffffff',fillOpacity:1}).addTo(map).bindPopup('项目位置');
  mapReady=true;
  setTimeout(()=>map.invalidateSize(),100);
 }catch(e){mapFallback()}
}
initMap();
function updateMapLocation(lat,lon,name){
 if(!mapReady||!window.L)return;
 try{map.setView([lat,lon],Math.abs(lat)>70?5:6,{animate:true});marker.setLatLng([lat,lon]).bindPopup(`<b>${name||'项目位置'}</b><br>${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`).openPopup();setTimeout(()=>map.invalidateSize(),80)}catch(e){}
}
"""
if old not in s: raise SystemExit('old map block not found')
s=s.replace(old,new,1)
# update assess flow to move map once coordinates known
needle="async function assess(loc)"
if needle not in s: raise SystemExit('assess not found')
# insert call after likely loc available by replacing first status update if possible
s=s.replace("async function assess(loc){", "async function assess(loc){updateMapLocation(loc.lat,loc.lon,loc.name);", 1)
p.write_text(s,encoding='utf-8')
print('resilient map added')
