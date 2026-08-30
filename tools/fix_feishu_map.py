from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Explicit height: Feishu mobile WebView can collapse percentage height inside auto-height cards.
s = s.replace('#map{height:calc(100% - 34px)}', '#map{height:100%;background:#eef4fb}', 1)
s = s.replace('.mapWrap{height:100%;position:relative}', '.mapWrap{height:calc(100% - 34px);position:relative}', 1)

anchor = '.mapWrap{height:calc(100% - 34px);position:relative}'
compat_css = ".osmCompatMap{position:relative;width:100%;height:100%;overflow:hidden;background:#dfeaf4}.osmTileLayer{position:absolute;width:768px;height:768px;will-change:transform}.osmTile{position:absolute;width:256px;height:256px;display:block;pointer-events:none;user-select:none;-webkit-user-drag:none}.osmMarker{position:absolute;left:50%;top:50%;width:24px;height:24px;background:#78b82a;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:translate(-50%,-100%) rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.38);z-index:5;pointer-events:none}.osmMarker:after{content:'';position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;left:6px;top:6px}.osmZoom{position:absolute;right:8px;top:8px;z-index:6;display:flex;flex-direction:column;border:1px solid #d7dde6;border-radius:7px;overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,.12)}.osmZoom button{width:34px;height:32px;border:0;border-radius:0;background:#fff;color:#26364d;font-size:20px;line-height:30px;padding:0;font-weight:700}.osmZoom button+button{border-top:1px solid #d7dde6}.osmAttrib{position:absolute;right:5px;bottom:4px;z-index:6;background:rgba(255,255,255,.9);border-radius:4px;padding:2px 5px;font-size:7px;color:#526173}.osmAttrib a{color:#355b8a;text-decoration:none}@media(max-width:900px){.mapCard{min-height:344px!important}.mapWrap{height:310px!important;min-height:310px}.osmZoom button{width:38px;height:36px;font-size:22px}.osmAttrib{font-size:8px}}"
if '.osmCompatMap{' not in s:
    if anchor not in s:
        raise SystemExit('CSS map anchor not found')
    s = s.replace(anchor, anchor + compat_css, 1)

# A later legacy mobile rule was overriding the compatibility height to 222px.
# Make the final mobile rule authoritative so Feishu/Lark WebView gets a stable visible map.
s = s.replace('#map{height:222px}.mapWrap{height:222px}.mapOverlay{font-size:9px}', '#map{height:310px!important;min-height:310px}.mapWrap{height:310px!important;min-height:310px}.mapOverlay{font-size:9px}', 1)
s = s.replace('.mapCard{order:1;height:260px;min-height:260px}', '.mapCard{order:1;height:348px;min-height:348px}', 1)

if 'function osmWorldPixel' not in s:
    old_start = s.find('let map={setView')
    old_end = s.find('renderOsmMap();', old_start)
    if old_start < 0 or old_end < 0:
        raise SystemExit('Legacy iframe map block not found')
    old_end += len('renderOsmMap();')

    new_map = r'''let mapState={lat:20,lon:15,name:'全球项目位置',zoom:2};
let map={setView(v,z){if(Array.isArray(v)&&v.length>=2)renderOsmMap(+v[0],+v[1],mapState.name,Number.isFinite(+z)?+z:mapState.zoom)},invalidateSize(){if(mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom)},on(){}};
let marker={setLatLng(){return this},bindPopup(){return this},openPopup(){return this}};
const mapEl=$('map');
function osmWorldPixel(lat,lon,zoom){
 const z=Math.max(2,Math.min(9,Math.round(zoom||2))),n=Math.pow(2,z),safeLat=Math.max(-85.0511,Math.min(85.0511,+lat||0));
 const sin=Math.sin(safeLat*Math.PI/180),x=(+lon+180)/360*n*256,y=(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n*256;
 return{x,y,z,n};
}
function mapZoom(delta){renderOsmMap(mapState.lat,mapState.lon,mapState.name,Math.max(2,Math.min(9,mapState.zoom+delta)))}
function renderOsmMap(lat=20,lon=15,name='全球项目位置',zoom=2){
 if(!mapEl)return;
 lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
 const w=osmWorldPixel(lat,lon,zoom),tileX=Math.floor(w.x/256),tileY=Math.floor(w.y/256),fx=w.x-tileX*256,fy=w.y-tileY*256;
 const centerPxX=256+fx,centerPxY=256+fy;
 let tiles='';
 for(let r=0;r<3;r++)for(let c=0;c<3;c++){
   const dx=c-1,dy=r-1,x=((tileX+dx)%w.n+w.n)%w.n,y=tileY+dy;
   if(y<0||y>=w.n)continue;
   tiles+=`<img class="osmTile" alt="" draggable="false" src="https://tile.openstreetmap.org/${w.z}/${x}/${y}.png" style="left:${c*256}px;top:${r*256}px" onerror="this.style.visibility='hidden'">`;
 }
 mapState={lat,lon,name:name||'项目位置',zoom:w.z};
 mapEl.innerHTML=`<div class="osmCompatMap" role="img" aria-label="OpenStreetMap 项目位置地图"><div class="osmTileLayer" style="left:calc(50% - ${centerPxX}px);top:calc(50% - ${centerPxY}px)">${tiles}</div><div class="osmMarker" aria-hidden="true"></div><div class="osmZoom"><button type="button" aria-label="放大地图" onclick="mapZoom(1)">+</button><button type="button" aria-label="缩小地图" onclick="mapZoom(-1)">−</button></div><div class="osmAttrib">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div></div>`;
}
function updateMapLocation(lat,lon,name){
 if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))return;
 renderOsmMap(Number(lat),Number(lon),name||'项目位置',6);
}
renderOsmMap();'''
    s = s[:old_start] + new_map + s[old_end:]

# Hard assertions before write.
if 'openstreetmap.org/export/embed.html' in s or 'id="osmFrame"' in s:
    raise SystemExit('iframe map still present after patch')
if 'tile.openstreetmap.org' not in s or '.osmCompatMap{' not in s:
    raise SystemExit('tile map patch incomplete')
if '#map{height:222px}' in s:
    raise SystemExit('legacy 222px mobile map override still present')

p.write_text(s, encoding='utf-8')
print('Feishu-compatible iframe-free map patch applied')
