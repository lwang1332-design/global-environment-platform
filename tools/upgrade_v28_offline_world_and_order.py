from pathlib import Path
import re

root=Path('.')
index=root/'index.html'
mapjs=root/'map-tier.js'
sw=root/'sw.js'

html=index.read_text(encoding='utf-8')

# 1) Section numbering / naming.
repls={
    '<h2>02 环境数据</h2>':'<h2>03 环境数据</h2>',
    '<h2>03 环境风险画像</h2>':'<h2>04 环境风险画像</h2>',
    '<h2>04 项目综合结论</h2>':'<h2>02 项目综合信息</h2>',
    '<h2>05 环境 × 设备风险矩阵</h2>':'<h2>06 环境 × 设备风险矩阵</h2>',
    '<h2>06 物理模型实时计算结果</h2>':'<h2>05 物理模型实时计算结果</h2>',
    '<h2>01 项目定位</h2><span>天地图 + 三级离线地图</span>':'<h2>01 项目定位</h2><span>在线地图 + 内置全球离线底图</span>',
}
for a,b in repls.items():
    if a not in html:
        raise SystemExit(f'missing heading marker: {a}')
    html=html.replace(a,b,1)

# Mobile page order must follow 01 -> 07 exactly.
old_order='.mapCard{order:1;height:348px;min-height:348px}.summaryCard{order:2;min-height:0;height:auto}.riskCard{order:3;min-height:0;height:auto}.envCard{order:4;min-height:0;height:auto}.physicsCard{order:5;min-height:0;height:auto}.matrixCard{order:6;min-height:340px;height:auto}.decisionCard{order:7;min-height:0;height:auto}'
new_order='.mapCard{order:1;height:348px;min-height:348px}.summaryCard{order:2;min-height:0;height:auto}.envCard{order:3;min-height:0;height:auto}.riskCard{order:4;min-height:0;height:auto}.physicsCard{order:5;min-height:0;height:auto}.matrixCard{order:6;min-height:340px;height:auto}.decisionCard{order:7;min-height:0;height:auto}'
if old_order not in html:
    raise SystemExit('mobile order marker missing')
html=html.replace(old_order,new_order,1)

# Small true-data line under each risk item.
css_marker='.riskrow.active .riskhead{color:var(--blue);font-weight:800}'
if '.riskActual{' not in html:
    if css_marker not in html:
        raise SystemExit('risk css marker missing')
    html=html.replace(css_marker,css_marker+'.riskActual{font-size:7.5px;color:var(--muted);line-height:1.25;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',1)

mobile_css='.riskrow{padding:3px 0}.riskhead{font-size:10px}.bar{height:8px}'
if mobile_css in html and '.riskActual{font-size:8px}' not in html:
    html=html.replace(mobile_css,mobile_css+'.riskActual{font-size:8px;margin-top:3px}',1)

start=html.find("$('riskList').innerHTML=")
end=html.find(";$('severity').textContent=r.severity",start)
if start<0 or end<0:
    raise SystemExit('risk render marker missing')
new_render="""let riskActual={
'高温':`P99 ${Number.isFinite(b.t99)?b.t99.toFixed(1)+'℃':'N/A'}`,
'低温':`最低 ${Number.isFinite(b.tmin)?b.tmin.toFixed(1)+'℃':'N/A'}`,
'凝露':`${Number.isFinite(c.annualCondHours)?c.annualCondHours.toFixed(0)+' h/y':'N/A'} · 露点裕量 ${Number.isFinite(c.minMargin)?c.minMargin.toFixed(2)+' K':'N/A'}`,
'盐雾':`Cl⁻ ${Number.isFinite(s.jcl)?s.jcl.toFixed(2)+' mg/m²·d':'N/A'} · TOW ${Number.isFinite(s.towPct)?s.towPct.toFixed(1)+'%':'N/A'}`,
'粉尘积灰':`PM10 P95 ${Number.isFinite(d.pm95)?d.pm95.toFixed(1)+' μg/m³':'N/A'} · 年吸入 ${Number.isFinite(d.annualIn)?d.annualIn.toFixed(1)+' kg':'N/A'}`,
'沙蚀':`EI ${Number.isFinite(d.erosionIndex)?d.erosionIndex.toFixed(2)+'/y':'N/A'} · 撞击 ${Number.isFinite(d.vimpact)?d.vimpact.toFixed(1)+' m/s':'N/A'}`,
'强降雨':`最大日雨 ${Number.isFinite(b.rainMax)?b.rainMax.toFixed(1)+' mm/d':'N/A'} · P99小时 ${Number.isFinite(b.rainP99h)?b.rainP99h.toFixed(2)+' mm/h':'N/A'}`,
'冰雪':`最大日雪 ${Number.isFinite(b.snowMax)?b.snowMax.toFixed(1)+' cm/d':'N/A'} · 冻融 ${Number.isFinite(b.freezeThawAnnual)?b.freezeThawAnnual.toFixed(0)+' 次/y':'N/A'}`,
'高海拔':`${Number.isFinite(b.elev)?Math.round(b.elev)+' m':'N/A'} · 气压 ${Number.isFinite(b.pressureMean)?(b.pressureMean/10).toFixed(1)+' kPa':'N/A'}`,
'极端风':`P99阵风 ${Number.isFinite(b.gust99)?b.gust99.toFixed(1)+' m/s':'N/A'} · 平均风 ${Number.isFinite(b.windMean)?b.windMean.toFixed(1)+' m/s':'N/A'}`
};$('riskList').innerHTML=ro.map(([k,v])=>`<div class=\"riskrow ${selected.env===k?'active':''}\" onclick=\"selectEnv('${k}')\"><div class=\"riskhead\"><span>${k}</span><b>${v}</b></div><div class=\"riskActual\">${riskActual[k]||''}</div><div class=\"bar\"><i style=\"width:${v}%\"></i></div></div>`).join('')"""
html=html[:start]+new_render+html[end:]

# Admin note: built-in vector base is always available; XYZ packs remain optional higher-resolution tiers.
old_note='本地开源地图采用 Web Mercator / XYZ / 256px 瓦片，默认目录 ./tiles/{z}/{x}/{y}.png；本地瓦片缺失时可自动切换 OSM。'
new_note='平台已内置轻量级全球矢量底图，断网或在线瓦片不可达时自动显示；本地开源地图仍支持 Web Mercator / XYZ / 256px 高精度瓦片，默认目录 ./tiles/{z}/{x}/{y}.png。'
if old_note in html:
    html=html.replace(old_note,new_note,1)

index.write_text(html,encoding='utf-8')

js=mapjs.read_text(encoding='utf-8')

# Built-in schematic world vector land polygons. Kept intentionally compact so it is cached with the app shell.
insert_marker='  function showOfflineMissing(lat,lon,name,zoom){\n'
if 'const EMBEDDED_WORLD_LAND=' not in js:
    if insert_marker not in js:
        raise SystemExit('map insertion marker missing')
    vector_code=r'''  const EMBEDDED_WORLD_LAND=[
    [[-168,72],[-150,70],[-140,62],[-130,55],[-124,48],[-118,34],[-105,24],[-97,18],[-86,20],[-81,26],[-80,32],[-75,39],[-67,45],[-60,53],[-58,61],[-75,70],[-100,76],[-130,75],[-150,72]],
    [[-82,12],[-76,7],[-72,-2],[-70,-12],[-66,-24],[-62,-37],[-70,-55],[-58,-52],[-49,-36],[-42,-23],[-35,-8],[-45,3],[-58,9],[-70,12]],
    [[-10,72],[8,72],[25,69],[42,71],[63,74],[88,75],[112,70],[136,63],[160,58],[179,52],[170,43],[150,36],[132,29],[122,19],[118,8],[106,1],[96,8],[88,21],[77,28],[68,36],[57,43],[44,47],[34,44],[27,39],[20,43],[12,42],[4,49],[-5,54],[-10,62]],
    [[-17,36],[-3,37],[12,35],[26,32],[37,24],[45,12],[50,3],[45,-12],[38,-24],[30,-34],[18,-35],[7,-30],[-1,-19],[-7,-7],[-11,7],[-16,20]],
    [[112,-11],[126,-10],[139,-14],[151,-22],[154,-34],[146,-41],[134,-44],[121,-36],[114,-27]],
    [[-60,82],[-38,83],[-22,76],[-20,68],[-34,60],[-48,61],[-59,68]],
    [[-180,-72],[-145,-74],[-110,-78],[-75,-76],[-40,-79],[-5,-82],[35,-78],[70,-75],[105,-78],[140,-75],[180,-72],[180,-90],[-180,-90]],
    [[95,6],[105,2],[113,-4],[120,-7],[126,-3],[132,1],[140,-3],[145,-7]],
    [[166,-34],[174,-38],[178,-45],[172,-47],[166,-42]],
    [[130,34],[136,36],[141,43],[145,45],[143,38]],
    [[-8,58],[-4,51],[1,50],[0,56]],
    [[47,-13],[50,-17],[49,-25],[44,-24],[43,-18]]
  ];
  function embeddedPoints(poly){return poly.map(p=>`${(num(p[0],0)+180).toFixed(2)},${(90-num(p[1],0)).toFixed(2)}`).join(' ')}
  function renderEmbeddedWorldMap(lat,lon,name,zoom=2,reason='内置全球离线底图'){
    if(!mapEl)return;
    lat=Math.max(-85,Math.min(85,num(lat,20)));lon=Math.max(-180,Math.min(180,num(lon,15)));
    const z=Math.max(2,Math.min(5,Math.round(num(zoom,2)))),scale=Math.pow(1.55,z-2),vw=360/scale;
    const ratio=Math.max(.62,Math.min(1.35,(mapEl.clientHeight||322)/(mapEl.clientWidth||372))),vh=Math.min(180,vw*ratio);
    const cx=lon+180,cy=90-lat,vx=Math.max(0,Math.min(360-vw,cx-vw/2)),vy=Math.max(0,Math.min(180-vh,cy-vh/2));
    const grat=[];for(let x=0;x<=360;x+=30)grat.push(`<line x1="${x}" y1="0" x2="${x}" y2="180"/>`);for(let y=0;y<=180;y+=30)grat.push(`<line x1="0" y1="${y}" x2="360" y2="${y}"/>`);
    const land=EMBEDDED_WORLD_LAND.map(p=>`<polygon points="${embeddedPoints(p)}"/>`).join(''),mr=Math.max(1.7,vw/90);
    mapState={lat,lon,name:name||'项目位置',zoom:z,activeSource:'embedded'};activeTier={id:'embedded',label:'内置全球离线底图',installed:true,minZoom:2,maxZoom:5};
    mapEl.innerHTML=`<div class="osmCompatMap embeddedWorldMap" role="img" aria-label="内置全球离线底图：${String(name||'项目位置').replaceAll('"','')}"><svg viewBox="${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block;background:#dceaf5"><g stroke="#c4d4e2" stroke-width=".22" opacity=".75">${grat.join('')}</g><g fill="#d9e2d0" stroke="#8da0ad" stroke-width=".38" vector-effect="non-scaling-stroke">${land}</g><g><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(mr*1.8).toFixed(2)}" fill="rgba(120,184,42,.20)"/><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${mr.toFixed(2)}" fill="#78b82a" stroke="#ffffff" stroke-width="${Math.max(.5,mr*.35).toFixed(2)}" vector-effect="non-scaling-stroke"/></g></svg><div class="osmZoom"><button type="button" onclick="mapZoom(1)" aria-label="放大">+</button><button type="button" onclick="mapZoom(-1)" aria-label="缩小">−</button></div><div class="osmAttrib">平台内置轻量矢量底图</div></div>`;
    const el=$('mapSourceBadge');if(el){el.className='mapSourceBadge local';el.textContent=`地图源：内置全球离线底图 · Z${z}${reason?' · '+reason:''}`}
  }

'''
    js=js.replace(insert_marker,vector_code+insert_marker,1)

# Built-in vector map supports global offline zoom 2-5 even without raster packs.
js=js.replace('    let z=2;\n    const g=', '    let z=5;\n    const g=',1)

# Online tile failure should never leave a blank map.
pattern=r"  function showTileFailureIfNeeded\(\)\{.*?\n  \}\n\n  handleTileError="
match=re.search(pattern,js,re.S)
if not match:
    raise SystemExit('tile failure function marker missing')
replacement=r'''  function showTileFailureIfNeeded(){
    if(!mapEl||navigator.onLine===false)return;
    const tiles=[...mapEl.querySelectorAll('.osmTile')];
    if(!tiles.length)return;
    const visible=tiles.some(t=>t.complete&&t.naturalWidth>0&&t.style.visibility!=='hidden');
    if(visible)return;
    const done=tiles.every(t=>t.complete||t.style.visibility==='hidden');
    if(!done)return;
    renderEmbeddedWorldMap(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||'项目位置',Math.min(5,num(mapState?.zoom,2)),'在线地图不可达，已自动切换');
  }

  handleTileError='''
js=js[:match.start()]+replacement+js[match.end():]

old_render="""    if(navigator.onLine===false&&(!activeTier||!installed(activeTier))){
      showOfflineMissing(lat,lon,name,Math.min(zoom,maxOfflineZoom(lat,lon,name)));
      return;
    }
    if(navigator.onLine===false)zoom=Math.min(zoom,maxOfflineZoom(lat,lon,name));"""
new_render="""    if(navigator.onLine===false&&(!activeTier||!installed(activeTier))){
      renderEmbeddedWorldMap(lat,lon,name,Math.min(5,zoom),'离线可用');
      return;
    }
    if(navigator.onLine===false)zoom=Math.min(zoom,maxOfflineZoom(lat,lon,name));"""
if old_render not in js:
    raise SystemExit('offline render marker missing')
js=js.replace(old_render,new_render,1)

# If a user is offline at a zoom not covered by an installed raster tier, keep the embedded base instead of clamping to a blank raster source.
old_zoom="""  mapZoom=function(delta){
    let target=Math.max(2,Math.min(13,num(mapState?.zoom,2)+num(delta,0)));
    if(navigator.onLine===false)target=Math.min(target,maxOfflineZoom(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||''));
    renderOsmMap(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||'项目位置',target);
  };"""
new_zoom="""  mapZoom=function(delta){
    let target=Math.max(2,Math.min(13,num(mapState?.zoom,2)+num(delta,0)));
    if(navigator.onLine===false)target=Math.min(target,maxOfflineZoom(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||''));
    if(navigator.onLine===false&&target<=5){renderEmbeddedWorldMap(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||'项目位置',target,'离线可用');return;}
    renderOsmMap(num(mapState?.lat,20),num(mapState?.lon,15),mapState?.name||'项目位置',target);
  };"""
if old_zoom not in js:
    raise SystemExit('map zoom marker missing')
js=js.replace(old_zoom,new_zoom,1)

# Expose renderer for validation / future pack manager.
js=js.replace("    reload:loadManifest\n  };", "    renderEmbedded:renderEmbeddedWorldMap,\n    reload:loadManifest\n  };",1)

mapjs.write_text(js,encoding='utf-8')

svc=sw.read_text(encoding='utf-8')
svc=re.sub(r"const CACHE='[^']+';","const CACHE='global-env-v2.8-offline-world-v1';",svc,count=1)
sw.write_text(svc,encoding='utf-8')

print('Patched index.html, map-tier.js and sw.js')
