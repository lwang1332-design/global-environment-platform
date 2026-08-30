from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
start=s.find("let map={setView(){},invalidateSize(){},on(){}},marker={setLatLng(){},bindPopup(){return this},openPopup(){return this}};")
end=s.find("async function locate(s)", start)
if start<0 or end<0:
    raise SystemExit('map block anchors not found')
new=r'''let map={setView(){},invalidateSize(){},on(){}},marker={setLatLng(){},bindPopup(){return this},openPopup(){return this}};
const mapEl=$('map');
function osmEmbedUrl(lat=20,lon=15,zoom=2){
 const d=zoom<=2?80:zoom<=4?25:zoom<=6?8:2;
 const left=Math.max(-180,lon-d), right=Math.min(180,lon+d), bottom=Math.max(-85,lat-d*.65), top=Math.min(85,lat+d*.65);
 return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(left+','+bottom+','+right+','+top)}&layer=mapnik&marker=${encodeURIComponent(lat+','+lon)}`;
}
function renderOsmMap(lat=20,lon=15,name='全球项目位置',zoom=2){
 if(!mapEl)return;
 const src=osmEmbedUrl(lat,lon,zoom);
 mapEl.innerHTML=`<div style="height:100%;position:relative;background:#eef4fb;overflow:hidden"><iframe id="osmFrame" title="${name}" src="${src}" style="border:0;width:100%;height:100%;display:block" loading="eager" referrerpolicy="no-referrer-when-downgrade"></iframe><div style="position:absolute;left:8px;bottom:8px;z-index:2;background:rgba(255,255,255,.92);border:1px solid #e3e8f0;border-radius:7px;padding:4px 7px;font-size:9px;color:#0a2a59;pointer-events:none"><b>${name}</b><br>${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}</div></div>`;
}
function updateMapLocation(lat,lon,name){
 if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))return;
 renderOsmMap(Number(lat),Number(lon),name||'项目位置',6);
}
renderOsmMap();
'''
s=s[:start]+new+s[end:]
# Make sure assess moves the map only once
s=s.replace("async function assess(loc){updateMapLocation(loc.lat,loc.lon,loc.name);updateMapLocation(loc.lat,loc.lon,loc.name);", "async function assess(loc){updateMapLocation(loc.lat,loc.lon,loc.name);",1)
if "async function assess(loc){updateMapLocation(loc.lat,loc.lon,loc.name);" not in s:
    s=s.replace("async function assess(loc){", "async function assess(loc){updateMapLocation(loc.lat,loc.lon,loc.name);",1)
p.write_text(s,encoding='utf-8')
print('OSM iframe map installed')
