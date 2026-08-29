import re,gzip,base64,pathlib
root=pathlib.Path('.')
s=''
for i in range(1,5):
    t=(root/f'payload{i}.js').read_text(encoding='utf-8')
    m=re.search(r"\+'([^']+)'",t)
    if not m: raise SystemExit(f'payload{i} parse failed')
    s+=m.group(1)
html=gzip.decompress(base64.b64decode(s)).decode('utf-8')
html=html.replace('V2.6 · PWA 手机版 + 工程校准','V2.7 · 稳定数据版').replace('V2.6','V2.7')
html=re.sub(r'<link rel="stylesheet" href="https://unpkg\.com/leaflet@1\.9\.4/dist/leaflet\.css">\s*','',html)
html=re.sub(r'<script src="https://unpkg\.com/leaflet@1\.9\.4/dist/leaflet\.js"></script>\s*','',html)
old="const map=L.map('map',{zoomControl:false}).setView([current.lat,current.lon],5);L.control.zoom({position:'topright'}).addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);let marker=L.marker([current.lat,current.lon]).addTo(map);"
new="""let map={setView(){},invalidateSize(){},on(){}},marker={setLatLng(){},bindPopup(){return this},openPopup(){return this}};\nconst mapEl=$('map');if(mapEl){mapEl.innerHTML='<div style=\"height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#eef4fb,#f8fbff);color:#667085;text-align:center;padding:16px;box-sizing:border-box\"><div><b style=\"color:#0a2a59\">全球位置输入</b><br><span style=\"font-size:12px\">位置查询与环境计算不依赖第三方地图CDN。<br>可输入“Basra, Iraq”或“30.5085,47.7804”。</span></div></div>';}\n"""
if old not in html: raise SystemExit('map block not found')
html=html.replace(old,new)
old="async function elev(lat,lon){let j=await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`).then(r=>r.json());return j.elevation?.[0]??0}"
new="async function elev(lat,lon){try{let r=await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);if(!r.ok)throw Error();let j=await r.json();return j.elevation?.[0]??NaN}catch{return NaN}}"
if old not in html: raise SystemExit('elev block not found')
html=html.replace(old,new)
weather=r'''async function weather(lat,lon,years){
 let end=new Date();end.setUTCDate(end.getUTCDate()-10);let start=new Date(end);start.setUTCFullYear(start.getUTCFullYear()-years);
 const hv='temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,shortwave_radiation,surface_pressure,cloud_cover',dv='temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum';
 const chunks=[];let cursor=new Date(start);while(cursor<=end){let ce=new Date(Date.UTC(cursor.getUTCFullYear(),11,31));if(ce>end)ce=new Date(end);chunks.push([new Date(cursor),ce]);cursor=new Date(Date.UTC(ce.getUTCFullYear()+1,0,1));}
 const merged={hourly:{time:[]},daily:{time:[]},elevation:NaN};
 for(let ci=0;ci<chunks.length;ci++){const [cs,ce]=chunks[ci];$('status').textContent=`正在获取 ERA5 ${ci+1}/${chunks.length}：${cs.getUTCFullYear()}…`;const u=`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${iso(cs)}&end_date=${iso(ce)}&hourly=${hv}&daily=${dv}&timezone=UTC&models=era5`;let r=await fetch(u);if(!r.ok){let t=await r.text().catch(()=>'');throw Error(`ERA5查询失败 HTTP ${r.status}${t?': '+t.slice(0,100):''}`)}let j=await r.json();if(j.error)throw Error(j.reason||'ERA5返回错误');if(Number.isFinite(j.elevation))merged.elevation=j.elevation;for(const [k,v] of Object.entries(j.hourly||{})){if(Array.isArray(v)){if(!merged.hourly[k])merged.hourly[k]=[];merged.hourly[k].push(...v)}}for(const [k,v] of Object.entries(j.daily||{})){if(Array.isArray(v)){if(!merged.daily[k])merged.daily[k]=[];merged.daily[k].push(...v)}}}
 if(!(merged.hourly.temperature_2m||[]).length)throw Error('ERA5未返回小时温度数据');return{j:merged,start:iso(start),end:iso(end)}
}'''
html,n=re.subn(r"async function weather\(lat,lon,years\)\{.*?\n\}",weather,html,count=1,flags=re.S)
if n!=1: raise SystemExit('weather block not found')
assess=r'''async function assess(loc){
 $('status').textContent='正在获取真实数据…';current=loc;marker.setLatLng([loc.lat,loc.lon]);map.setView([loc.lat,loc.lon],6);
 try{const years=+$('years').value;const w=await weather(loc.lat,loc.lon,years);const [e0,a,m]=await Promise.all([elev(loc.lat,loc.lon),air(loc.lat,loc.lon),marine(loc.lat,loc.lon)]);const e=Number.isFinite(e0)?e0:(Number.isFinite(w.j.elevation)?w.j.elevation:0);cache={elev:e,w,aq:a,marine:m};selected={env:null,equip:null};calculate();marker.bindPopup(`<b>${loc.name}</b><br>环境严酷度 ${result.severity}/100`).openPopup();$('status').textContent=`真实数据计算完成 · ERA5 ${w.start}~${w.end}`}catch(e){console.error(e);$('status').textContent='查询失败：'+(e?.message||String(e))}
}
$('go')'''
m=re.search(r"async function assess\(loc\)\{.*?\}\n\$\('go'\)",html,re.S)
if not m: raise SystemExit('assess block not found')
html=html[:m.start()]+assess+html[m.end():]
(root/'index.html').write_text(html,encoding='utf-8')
(root/'sw.js').write_text("""const CACHE='global-env-v2.7-stable-v1';const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg'];self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{let x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});""",encoding='utf-8')
print('V2.7 stable generated',len(html))
# trigger rebuild workflow
