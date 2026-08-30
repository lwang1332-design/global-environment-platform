from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

if 'dual-map-source-v1' not in s:
    css='''\n/* dual-map-source-v1 */\n.mapSourceBadge{position:absolute;z-index:25;left:8px;top:8px;max-width:72%;padding:4px 7px;border:1px solid rgba(10,42,89,.12);border-radius:7px;background:rgba(255,255,255,.94);box-shadow:0 1px 5px rgba(0,0,0,.10);font-size:8px;font-weight:800;color:var(--navy);pointer-events:none}.mapSourceBadge.tdt{color:#b42318;background:rgba(255,247,237,.96)}.mapSourceBadge.local{color:#087a50;background:rgba(237,248,243,.96)}.mapSourceBadge.osm{color:#355b8a;background:rgba(238,244,255,.96)}.dualTileCell{position:absolute;width:256px;height:256px;overflow:hidden}.dualTileCell .osmTile{left:0!important;top:0!important}.tdtAnno{position:absolute;left:0;top:0;width:256px;height:256px;z-index:2;pointer-events:none}.mapConfigNote{font-size:8px;color:var(--muted);line-height:1.5;margin-top:6px}\n'''
    s=s.replace('/* final-mobile-map-visible-v1 */',css+'\n/* final-mobile-map-visible-v1 */',1)

old_map_html='<section class="card mapCard"><div class="head"><h2>01 项目定位</h2><span>点击地图重新计算</span></div><div class="mapWrap"><div id="map"></div><div class="mapOverlay" id="mapInfo">Basra, Iraq<br>等待定位...</div></div></section>'
new_map_html='<section class="card mapCard"><div class="head"><h2>01 项目定位</h2><span>天地图 + 本地开源地图双源</span></div><div class="mapWrap"><div id="map"></div><div class="mapSourceBadge" id="mapSourceBadge">地图源：初始化</div><div class="mapOverlay" id="mapInfo">Basra, Iraq<br>等待定位...</div></div></section>'
if old_map_html in s:
    s=s.replace(old_map_html,new_map_html,1)

admin_marker='    <div class="adminCard"><h3>数据适用性参数</h3><div class="fieldGrid">'
admin_card='''    <div class="adminCard"><h3>地图数据源 <span class="groupTag">双源</span></h3><div class="fieldGrid">\n      <label>天地图浏览器端 Key</label><input id="map_tdtKey" type="text" placeholder="未配置时自动降级">\n      <label>本地 XYZ 瓦片模板</label><input id="map_localTemplate" type="text" placeholder="./tiles/{z}/{x}/{y}.png">\n      <label>中国区域优先源</label><select id="map_chinaMode"><option value="tdt">天地图</option><option value="local">本地开源地图</option></select>\n      <label>海外区域优先源</label><select id="map_globalMode"><option value="local">本地开源地图</option><option value="osm">在线 OSM</option></select>\n      <label>在线 OSM 兜底</label><select id="map_osmFallback"><option value="true">启用</option><option value="false">关闭</option></select>\n    </div><p class="mapConfigNote">天地图 Key 仅保存在当前浏览器 localStorage，不写入代码仓库。本地开源地图采用 Web Mercator / XYZ / 256px 瓦片，默认目录 ./tiles/{z}/{x}/{y}.png；本地瓦片缺失时可自动切换 OSM。</p></div>\n'''
if admin_marker in s and 'id="map_tdtKey"' not in s:
    s=s.replace(admin_marker,admin_card+admin_marker,1)

param_line="let params=Object.assign({},DEFAULT_PARAMS,JSON.parse(localStorage.getItem('GE_V25_PARAMS')||'{}'));let adminUnlocked=false;"
map_config_js="""let params=Object.assign({},DEFAULT_PARAMS,JSON.parse(localStorage.getItem('GE_V25_PARAMS')||'{}'));let adminUnlocked=false;\nconst MAP_DEFAULTS={tdtKey:'',localTemplate:'./tiles/{z}/{x}/{y}.png',chinaMode:'tdt',globalMode:'local',osmFallback:true};\nlet mapConfig=Object.assign({},MAP_DEFAULTS,JSON.parse(localStorage.getItem('GE_MAP_CONFIG')||'{}'));\nfunction loadMapInputs(){if($('map_tdtKey'))$('map_tdtKey').value=mapConfig.tdtKey||'';if($('map_localTemplate'))$('map_localTemplate').value=mapConfig.localTemplate||MAP_DEFAULTS.localTemplate;if($('map_chinaMode'))$('map_chinaMode').value=mapConfig.chinaMode||'tdt';if($('map_globalMode'))$('map_globalMode').value=mapConfig.globalMode||'local';if($('map_osmFallback'))$('map_osmFallback').value=String(mapConfig.osmFallback!==false)}\nfunction saveMapInputs(){if(!$('map_tdtKey'))return;mapConfig={tdtKey:$('map_tdtKey').value.trim(),localTemplate:$('map_localTemplate').value.trim()||MAP_DEFAULTS.localTemplate,chinaMode:$('map_chinaMode').value||'tdt',globalMode:$('map_globalMode').value||'local',osmFallback:$('map_osmFallback').value!=='false'};localStorage.setItem('GE_MAP_CONFIG',JSON.stringify(mapConfig));if(mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom)}\n"""
if param_line in s and 'const MAP_DEFAULTS=' not in s:
    s=s.replace(param_line,map_config_js,1)

s=s.replace("function loadAdminInputs(){Object.entries(PARAM_IDS).forEach(([k,id])=>{if($(id))$(id).value=params[k]})}","function loadAdminInputs(){Object.entries(PARAM_IDS).forEach(([k,id])=>{if($(id))$(id).value=params[k]});loadMapInputs()}",1)
s=s.replace("function applyAdminParams(){Object.entries(PARAM_IDS).forEach(([k,id])=>{let el=$(id);if(el&&el.value!=='')params[k]=+el.value});localStorage.setItem('GE_V25_PARAMS',JSON.stringify(params));$('adminStatus').textContent='参数已应用';if(cache)calculate()}","function applyAdminParams(){Object.entries(PARAM_IDS).forEach(([k,id])=>{let el=$(id);if(el&&el.value!=='')params[k]=+el.value});localStorage.setItem('GE_V25_PARAMS',JSON.stringify(params));saveMapInputs();$('adminStatus').textContent='参数与地图配置已应用';if(cache)calculate()}",1)
s=s.replace("function resetAdminParams(){params=Object.assign({},DEFAULT_PARAMS);localStorage.setItem('GE_V25_PARAMS',JSON.stringify(params));loadAdminInputs();$('adminStatus').textContent='已恢复默认';if(cache)calculate()}","function resetAdminParams(){params=Object.assign({},DEFAULT_PARAMS);mapConfig=Object.assign({},MAP_DEFAULTS);localStorage.setItem('GE_V25_PARAMS',JSON.stringify(params));localStorage.setItem('GE_MAP_CONFIG',JSON.stringify(mapConfig));loadAdminInputs();$('adminStatus').textContent='参数与地图配置已恢复默认';if(mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom);if(cache)calculate()}",1)

pattern=r"let mapState=\{lat:20,lon:15,name:'全球项目位置',zoom:2\};.*?\nrenderOsmMap\(\);\n"
new_map_js=r'''let mapState={lat:20,lon:15,name:'全球项目位置',zoom:2,activeSource:'osm'};
let map={setView(v,z){if(Array.isArray(v)&&v.length>=2)renderOsmMap(+v[0],+v[1],mapState.name,Number.isFinite(+z)?+z:mapState.zoom)},invalidateSize(){if(mapState)renderOsmMap(mapState.lat,mapState.lon,mapState.name,mapState.zoom)},on(){}};
let marker={setLatLng(){return this},bindPopup(){return this},openPopup(){return this}};
const mapEl=$('map');
function osmWorldPixel(lat,lon,zoom){
 const z=Math.max(2,Math.min(12,Math.round(zoom||2))),n=Math.pow(2,z),safeLat=Math.max(-85.0511,Math.min(85.0511,+lat||0));
 const sin=Math.sin(safeLat*Math.PI/180),x=(+lon+180)/360*n*256,y=(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n*256;
 return{x,y,z,n};
}
function pointInPoly(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];let hit=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi);if(hit)inside=!inside}return inside}
function isChinaRegion(lat,lon,name=''){
 const n=String(name||'').toLowerCase();if(/中国|china|香港|hong kong|澳门|macao|macau|台湾|taiwan/.test(n))return true;
 if(lon<73||lon>135||lat<18||lat>54)return false;
 const poly=[[73,39],[78,32],[86,27],[97,22],[108,18],[120,21],[124,27],[131,31],[135,48],[128,52],[121,54],[118,49],[111,42],[100,42],[96,49],[87,49],[80,45]];
 return pointInPoly(lon,lat,poly);
}
function localTileUrl(z,x,y){return String(mapConfig.localTemplate||MAP_DEFAULTS.localTemplate).replaceAll('{z}',z).replaceAll('{x}',x).replaceAll('{y}',y)}
function tdtTileUrl(layer,z,x,y){let sub=Math.abs((x+y)%8);return `https://t${sub}.tianditu.gov.cn/DataServer?T=${layer}_w&x=${x}&y=${y}&l=${z}&tk=${encodeURIComponent(mapConfig.tdtKey||'')}`}
function tileUrl(source,z,x,y){if(source==='tdt')return tdtTileUrl('vec',z,x,y);if(source==='local')return localTileUrl(z,x,y);return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`}
function sourceChain(lat,lon,name){
 const china=isChinaRegion(lat,lon,name);let primary=china?(mapConfig.chinaMode||'tdt'):(mapConfig.globalMode||'local');
 if(primary==='tdt'&&!mapConfig.tdtKey)primary='local';if(primary==='local'&&!mapConfig.localTemplate)primary='osm';
 let chain=[primary];if(primary==='tdt')chain.push('local');if((mapConfig.osmFallback!==false)&&!chain.includes('osm'))chain.push('osm');return{china,primary,chain};
}
function sourceLabel(source,extra=''){let t=source==='tdt'?'天地图':source==='local'?'本地开源地图':'在线 OSM 兜底';return extra?`${t} · ${extra}`:t}
function setMapSourceBadge(source,extra=''){let el=$('mapSourceBadge');if(!el)return;el.className='mapSourceBadge '+source;el.textContent='地图源：'+sourceLabel(source,extra);mapState.activeSource=source}
function handleTileError(img){
 let chain=(img.dataset.chain||'').split(',').filter(Boolean),idx=chain.indexOf(img.dataset.source),next=chain[idx+1];
 if(!next){img.style.visibility='hidden';return}
 img.dataset.source=next;img.src=tileUrl(next,+img.dataset.z,+img.dataset.x,+img.dataset.y);let anno=img.parentElement.querySelector('.tdtAnno');if(anno)anno.style.display='none';setMapSourceBadge(next,'自动降级');
}
function mapZoom(delta){renderOsmMap(mapState.lat,mapState.lon,mapState.name,Math.max(2,Math.min(12,mapState.zoom+delta)))}
function renderOsmMap(lat=20,lon=15,name='全球项目位置',zoom=2){
 if(!mapEl)return;lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
 const w=osmWorldPixel(lat,lon,zoom),tileX=Math.floor(w.x/256),tileY=Math.floor(w.y/256),fx=w.x-tileX*256,fy=w.y-tileY*256,choice=sourceChain(lat,lon,name),chainStr=choice.chain.join(',');
 const centerPxX=256+fx,centerPxY=256+fy;let tiles='';
 for(let r=0;r<3;r++)for(let c=0;c<3;c++){
   const dx=c-1,dy=r-1,x=((tileX+dx)%w.n+w.n)%w.n,y=tileY+dy;if(y<0||y>=w.n)continue;
   let src=tileUrl(choice.primary,w.z,x,y),anno=choice.primary==='tdt'?`<img class="tdtAnno" alt="" draggable="false" src="${tdtTileUrl('cva',w.z,x,y)}" onerror="this.style.display='none'">`:'';
   tiles+=`<div class="dualTileCell" style="left:${c*256}px;top:${r*256}px"><img class="osmTile" alt="" draggable="false" data-source="${choice.primary}" data-chain="${chainStr}" data-z="${w.z}" data-x="${x}" data-y="${y}" src="${src}" onerror="handleTileError(this)">${anno}</div>`;
 }
 mapState={lat,lon,name:name||'项目位置',zoom:w.z,activeSource:choice.primary};
 mapEl.innerHTML=`<div class="osmCompatMap" role="img" aria-label="项目位置地图"><div class="osmTileLayer" style="left:calc(50% - ${centerPxX}px);top:calc(50% - ${centerPxY}px)">${tiles}</div><div class="osmMarker" aria-hidden="true"></div><div class="osmZoom"><button type="button" aria-label="放大地图" onclick="mapZoom(1)">+</button><button type="button" aria-label="缩小地图" onclick="mapZoom(-1)">−</button></div><div class="osmAttrib">${choice.primary==='tdt'?'天地图':choice.primary==='local'?'本地 XYZ':'© OpenStreetMap'}</div></div>`;
 let extra=choice.china&&mapConfig.chinaMode==='tdt'&&!mapConfig.tdtKey?'天地图 Key 未配置':'';setMapSourceBadge(choice.primary,extra);
}
function updateMapLocation(lat,lon,name){if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))return;renderOsmMap(Number(lat),Number(lon),name||'项目位置',6)}
renderOsmMap();
'''
if re.search(pattern,s,re.S):
    s=re.sub(pattern,new_map_js,s,count=1,flags=re.S)
else:
    raise SystemExit('map block not found')

p.write_text(s,encoding='utf-8')
print('dual source map upgrade applied')
