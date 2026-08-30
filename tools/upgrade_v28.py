from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'V2.8 · 工程报告版' in s:
    print('V2.8 already applied')
    raise SystemExit(0)

# 1) Version + toolbar report buttons
s=s.replace('V2.7 · 稳定数据版','V2.8 · 工程报告版')
s=s.replace('<button id="go">开始评估</button><div class="status" id="status">',
'''<button id="go">开始评估</button><button class="reportBtn" id="pdfReport" onclick="exportPDF()">生成PDF</button><button class="reportBtn ghostReport" id="wordReport" onclick="exportWord()">生成Word</button><div class="status" id="status">''',1)

# 2) report/admin css
s=s.replace('</style>',r'''
.reportBtn{height:32px;border:0;border-radius:8px;padding:0 12px;background:#0a2a59;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}.ghostReport{background:#eaf1fb;color:#0a2a59;border:1px solid #bfd1e8}.reportBtn:disabled{opacity:.45;cursor:not-allowed}
.paramNote{font-size:8px;color:#667085;line-height:1.45;margin-top:5px}.adminCard .groupTag{display:inline-block;font-size:8px;padding:2px 6px;border-radius:10px;background:#eaf1fb;color:#0a2a59;margin-left:5px}.reportHint{font-size:8px;color:#667085;margin-top:4px}
@media(max-width:900px){.toolbar{grid-template-columns:minmax(180px,1fr) 90px 92px 84px 84px}.reportBtn{padding:0 6px;font-size:9px}}
@media(max-width:620px){.toolbar{grid-template-columns:1fr 84px 88px}.toolbar .reportBtn{grid-row:2}.toolbar .status{grid-column:1/-1}}
</style>''',1)

# 3) Add expanded admin groups before actions
anchor='  <div class="adminActions"><button onclick="applyAdminParams()">应用并重算</button>'
extra=r'''
    <div class="adminCard"><h3>盐雾 / 腐蚀模型 <span class="groupTag">V2.8新增</span></h3><div class="fieldGrid">
      <label>海盐沉积速度 Vd (m/s)</label><input id="p_saltVd" type="number" step="0.001">
      <label>Cl⁻质量比例 fCl</label><input id="p_saltClFrac" type="number" step="0.01">
      <label>TOW湿度阈值 RH (%)</label><input id="p_towRh" type="number" step="1">
      <label>TOW最低温度 (℃)</label><input id="p_towTmin" type="number" step="1">
      <label>TOW最高温度 (℃)</label><input id="p_towTmax" type="number" step="1">
      <label>海盐/TOW/SO₂权重</label><input id="p_saltWSea" type="number" step="0.05">
      <label>TOW权重</label><input id="p_saltWTow" type="number" step="0.05">
      <label>SO₂权重</label><input id="p_saltWSo2" type="number" step="0.05">
    </div><p class="paramNote">将原代码中写死的 Vd=0.005、Cl比例=0.55、RH&gt;80% 与风险权重转为可校准参数。</p></div>
    <div class="adminCard"><h3>粉尘 / 沙蚀扩展参数 <span class="groupTag">V2.8新增</span></h3><div class="fieldGrid">
      <label>过滤旁通率 rbypass</label><input id="p_filterBypass" type="number" step="0.01">
      <label>设备年运行小时 (h/y)</label><input id="p_opHours" type="number" step="100">
      <label>颗粒D50 (μm)</label><input id="p_particleD50" type="number" step="1">
      <label>颗粒密度 (kg/m³)</label><input id="p_particleRho" type="number" step="50">
      <label>典型撞击角 (°)</label><input id="p_impactAngle" type="number" step="1">
      <label>材料沙蚀修正系数 Km</label><input id="p_materialK" type="number" step="0.05">
    </div><p class="paramNote">V2.8修复 ηfilter 原先未进入年吸入颗粒量计算的问题，并引入旁通、运行时间与材料修正。</p></div>
    <div class="adminCard"><h3>凝露数值模型 <span class="groupTag">V2.8新增</span></h3><div class="fieldGrid">
      <label>模型时间步长 Δt (min)</label><input id="p_condDtMin" type="number" step="5">
      <label>凝露判定膜裕量 (K)</label><input id="p_condFilmMargin" type="number" step="0.1">
      <label>凝露质量传递修正</label><input id="p_condMassK" type="number" step="0.05">
      <label>阵风估算系数</label><input id="p_gustFactor" type="number" step="0.1">
    </div><p class="paramNote">当前ERA5仍为小时数据；V2.8将热惯性积分按可调子步长计算，默认10 min。</p></div>
    <div class="adminCard"><h3>雨雪 / 高海拔评分阈值 <span class="groupTag">V2.8新增</span></h3><div class="fieldGrid">
      <label>强降雨评分起点 (mm/d)</label><input id="p_rainA" type="number" step="5">
      <label>强降雨满分值 (mm/d)</label><input id="p_rainB" type="number" step="10">
      <label>降雪评分起点 (cm/d)</label><input id="p_snowA" type="number" step="1">
      <label>降雪满分值 (cm/d)</label><input id="p_snowB" type="number" step="5">
      <label>高海拔评分起点 (m)</label><input id="p_altA" type="number" step="100">
      <label>高海拔满分值 (m)</label><input id="p_altB" type="number" step="100">
    </div></div>
    <div class="adminCard"><h3>设计能力扩展边界 <span class="groupTag">V2.8新增</span></h3><div class="fieldGrid">
      <label>最大RH (%)</label><input id="p_capRh" type="number" step="1">
      <label>最大日温差 (K)</label><input id="p_capDayRange" type="number" step="1">
      <label>最大温变速率 (K/h)</label><input id="p_capTempRate" type="number" step="0.5">
      <label>最大日降雨 (mm/d)</label><input id="p_capRainDay" type="number" step="10">
      <label>最大小时降雨 (mm/h)</label><input id="p_capRainHour" type="number" step="5">
      <label>最大设计阵风 (m/s)</label><input id="p_capWind" type="number" step="1">
      <label>最大日降雪 (cm/d)</label><input id="p_capSnow" type="number" step="1">
      <label>最大设计海拔 (m)</label><input id="p_capAltitude" type="number" step="100">
      <label>SO₂ P95限值 (μg/m³)</label><input id="p_capSo2" type="number" step="5">
      <label>NO₂ P95限值 (μg/m³)</label><input id="p_capNo2" type="number" step="5">
      <label>TOW允许占比 (%)</label><input id="p_capTow" type="number" step="1">
    </div></div>
'''
if anchor not in s: raise SystemExit('admin action anchor missing')
s=s.replace(anchor,extra+anchor,1)

# 4) Expand defaults
old=re.search(r'const DEFAULT_PARAMS=\{[^;]+\};',s).group(0)
new='''const DEFAULT_PARAMS={delta:10,rho:7850,cp:500,eps:.85,alpha:.6,sky:6,dewMargin:3,Q:100000,D:1.5,rpm:900,impactEta:.5,filterEta:.9,ne:2.5,eiMass:10,eiVel:50,capHigh:45,capLow:-40,capDew:3,capCondHours:0,capCl:10,capPm:150,capEi:1,capHeatLoss:20,hiA:35,hiB:50,loA:10,loB:40,windA:20,windB:55,w1:.4,w2:.25,w3:.15,wavg:.2,protect:1,marineKm:20,coastalKm:100,camsDays:90,saltVd:.005,saltClFrac:.55,towRh:80,towTmin:0,towTmax:40,saltWSea:.55,saltWTow:.30,saltWSo2:.15,filterBypass:.03,opHours:8760,particleD50:50,particleRho:2650,impactAngle:45,materialK:1,condDtMin:10,condFilmMargin:0,condMassK:1,gustFactor:1.5,rainA:20,rainB:150,snowA:1,snowB:30,altA:1500,altB:4500,capRh:100,capDayRange:25,capTempRate:8,capRainDay:150,capRainHour:50,capWind:55,capSnow:30,capAltitude:4500,capSo2:100,capNo2:100,capTow:60};'''
s=s.replace(old,new,1)

# 5) Expand param id mapping
m=re.search(r'const PARAM_IDS=\{[^;]+\};',s)
if not m: raise SystemExit('PARAM_IDS missing')
old=m.group(0)
insert=old[:-2]+",saltVd:'p_saltVd',saltClFrac:'p_saltClFrac',towRh:'p_towRh',towTmin:'p_towTmin',towTmax:'p_towTmax',saltWSea:'p_saltWSea',saltWTow:'p_saltWTow',saltWSo2:'p_saltWSo2',filterBypass:'p_filterBypass',opHours:'p_opHours',particleD50:'p_particleD50',particleRho:'p_particleRho',impactAngle:'p_impactAngle',materialK:'p_materialK',condDtMin:'p_condDtMin',condFilmMargin:'p_condFilmMargin',condMassK:'p_condMassK',gustFactor:'p_gustFactor',rainA:'p_rainA',rainB:'p_rainB',snowA:'p_snowA',snowB:'p_snowB',altA:'p_altA',altB:'p_altB',capRh:'p_capRh',capDayRange:'p_capDayRange',capTempRate:'p_capTempRate',capRainDay:'p_capRainDay',capRainHour:'p_capRainHour',capWind:'p_capWind',capSnow:'p_capSnow',capAltitude:'p_capAltitude',capSo2:'p_capSo2',capNo2:'p_capNo2',capTow:'p_capTow'};"
s=s.replace(old,insert,1)

# 6) Replace condensation with substep integration
start=s.index('function condensation(h){')
end=s.index('\nfunction saltModel',start)
cond=r'''function condensation(h){
 const sigma=5.670374419e-8,rho=params.rho,Cp=params.cp,delta=params.delta/1000,eps=params.eps,alphaS=params.alpha,CA=rho*Cp*delta;
 const Rv=461.5,rhoAir=1.20,cpAir=1005,subMin=Math.max(5,Math.min(60,params.condDtMin||10)),subN=Math.max(1,Math.round(60/subMin)),dt=3600/subN;
 const es=t=>610.94*Math.exp(17.625*t/(t+243.04));
 let T=h.temperature_2m||[],Td=h.dew_point_2m||[],V=h.wind_speed_10m||[],G=h.shortwave_radiation||[],Ts=Number.isFinite(T[0])?T[0]:20;
 let cond=0,near=0,minMargin=999,maxRun=0,run=0,totalCondKgM2=0,valid=0;
 for(let i=0;i<T.length;i++){
  if(!Number.isFinite(T[i])||!Number.isFinite(Td[i]))continue; valid++;
  let hc=5.7+3.8*Math.max(0,V[i]||0);
  for(let k=0;k<subN;k++){
   let TsK=Ts+273.15,TaK=T[i]+273.15,qconv=hc*(T[i]-Ts),qsolar=alphaS*Math.max(0,G[i]||0),qrad=eps*sigma*(Math.pow(TsK,4)-Math.pow(TaK-params.sky,4));
   let dT=dt*(qconv+qsolar-qrad)/CA;Ts+=Math.max(-5/subN,Math.min(5/subN,dT));
  }
  let margin=Ts-Td[i],threshold=params.condFilmMargin||0;
  if(margin<=threshold){
   cond++;run++;maxRun=Math.max(maxRun,run);
   let km=hc/(rhoAir*cpAir),rhoVair=es(Td[i])/(Rv*(T[i]+273.15)),rhoVs=es(Ts)/(Rv*(Ts+273.15));
   totalCondKgM2+=Math.max(0,km*(rhoVair-rhoVs))*3600*(params.condMassK||1);
  }else run=0;
  if(margin<params.dewMargin)near++;if(margin<minMargin)minMargin=margin;
 }
 let condPct=valid?100*cond/valid:0,annualCondHours=valid?cond/valid*8760:0,annualCondKgM2=valid?totalCondKgM2*8760/valid:0;
 return{condPct,annualCondHours,nearPct:valid?100*near/valid:0,minMargin,maxRunHours:maxRun,annualCondKgM2,totalCondKgM2,params:{rho,Cp,delta_mm:delta*1000,CA,dt_min:subMin}};
}'''
s=s[:start]+cond+s[end:]

# 7) Salt model parameterized
start=s.index('function saltModel(h,aq){')
end=s.index('\nfunction dustModel',start)
salt=r'''function saltModel(h,aq){let T=h.temperature_2m||[],RH=h.relative_humidity_2m||[],tow=0,n=0;for(let i=0;i<T.length;i++)if(Number.isFinite(T[i])&&Number.isFinite(RH[i])){n++;if(T[i]>params.towTmin&&T[i]<params.towTmax&&RH[i]>params.towRh)tow++}let sea=aq.ok?(aq.j.hourly?.sea_salt_aerosol||[]).filter(Number.isFinite):[],so2=aq.ok?(aq.j.hourly?.sulphur_dioxide||[]).filter(Number.isFinite):[];let sea95=q(sea,.95),vd=params.saltVd,clf=params.saltClFrac,js=Number.isFinite(sea95)?sea95*vd*86400/1000:NaN,jcl=Number.isFinite(js)?js*clf:NaN,towPct=n?100*tow/n:0,so295=q(so2,.95);let sw=params.saltWSea+params.saltWTow+params.saltWSo2||1,score=(Number.isFinite(jcl)?params.saltWSea/sw*lin(jcl,1,50):0)+(params.saltWTow/sw)*lin(towPct,10,60)+(Number.isFinite(so295)?params.saltWSo2/sw*lin(so295,10,100):0);return{towHours:tow,towPct,sea95,js,jcl,so295,score:Math.round(clamp(score))}}'''
s=s[:start]+salt+s[end:]

# 8) Dust model: filter efficiency and engineering corrections
start=s.index('function dustModel(h,aq){')
end=s.index('\nfunction baseStats',start)
dust=r'''function dustModel(h,aq){
 let pm=aq.ok?(aq.j.hourly?.pm10||[]).filter(Number.isFinite):[],du=aq.ok?(aq.j.hourly?.dust||[]).filter(Number.isFinite):[],pmMean=pm.length?pm.reduce((a,b)=>a+b,0)/pm.length:NaN,pm95=q(pm,.95),dustMean=du.length?du.reduce((a,b)=>a+b,0)/du.length:NaN,dust95=q(du,.95),Q=params.Q,eta=clamp(params.filterEta,0,1),bypass=clamp(params.filterBypass,0,1),hours=Math.max(0,Math.min(8760,params.opHours));
 let annualExposure=Number.isFinite(pmMean)?pmMean*hours/1000:NaN,rawMass=Number.isFinite(pmMean)?pmMean*Q*hours/1e9:NaN,penetration=(1-eta)*(1-bypass)+bypass,annualIn=Number.isFinite(rawMass)?rawMass*penetration:NaN;
 let D=params.D,rpm=params.rpm,impactEta=params.impactEta,ne=params.ne,vtip=Math.PI*D*rpm/60,vaxial=Q/3600/(Math.PI*D*D/4),vimpact=Math.sqrt(vtip*vtip+vaxial*vaxial),dustMassRaw=Number.isFinite(dustMean)?dustMean*Q*hours/1e9:NaN,dustMassIn=Number.isFinite(dustMassRaw)?dustMassRaw*penetration:NaN,impactMass=Number.isFinite(dustMassIn)?dustMassIn*impactEta:NaN;
 let angleFactor=Math.max(.15,Math.sin((params.impactAngle||45)*Math.PI/180)),sizeFactor=Math.pow(Math.max(1,params.particleD50||50)/50,.35),erosionIndex=Number.isFinite(impactMass)?params.materialK*(impactMass/params.eiMass)*Math.pow(vimpact/params.eiVel,ne)*angleFactor*sizeFactor:NaN;
 let impactEnergyKJ=Number.isFinite(impactMass)?0.5*impactMass*vimpact*vimpact/1000:NaN;
 let fouling=(Number.isFinite(pm95)?.6*lin(pm95,40,250):0)+(Number.isFinite(annualIn)?.4*lin(annualIn,1,100):0),erosion=Number.isFinite(erosionIndex)?lin(erosionIndex,.1,10):0;
 return{pmMean,pm95,dustMean,dust95,annualExposure,annualIn,rawMass,penetration,vtip,vimpact,impactMass,impactEnergyKJ,erosionIndex,fouling:Math.round(clamp(fouling)),erosion:Math.round(clamp(erosion))};
}'''
s=s[:start]+dust+s[end:]

# 9) Gust factor and variable risk thresholds
s=s.replace("(h.wind_speed_10m||[]).filter(Number.isFinite).map(x=>1.5*x)","(h.wind_speed_10m||[]).filter(Number.isFinite).map(x=>(params.gustFactor||1.5)*x)")
s=s.replace("强降雨:Math.round(lin(b.rainMax,20,150)),冰雪:Math.round(lin(b.snowMax,1,30)),高海拔:Math.round(lin(b.elev,1500,4500))", "强降雨:Math.round(lin(b.rainMax,params.rainA,params.rainB)),冰雪:Math.round(lin(b.snowMax,params.snowA,params.snowB)),高海拔:Math.round(lin(b.elev,params.altA,params.altB))")

# 10) Add extended capability checks after existing list creation
needle="['散热衰减',Number.isFinite(heatLoss),heatLoss<=params.capHeatLoss]];"
replacement="['散热衰减',Number.isFinite(heatLoss),heatLoss<=params.capHeatLoss],['最大湿度',Number.isFinite(b.rhMean),b.rhMean<=params.capRh],['日温差',Number.isFinite(b.dayRange),b.dayRange<=params.capDayRange],['温变速率',Number.isFinite(b.tempRate),b.tempRate<=params.capTempRate],['日降雨',Number.isFinite(b.rainMax),b.rainMax<=params.capRainDay],['小时降雨',Number.isFinite(b.rainP99h),b.rainP99h<=params.capRainHour],['阵风',Number.isFinite(b.gust99),b.gust99<=params.capWind],['降雪',Number.isFinite(b.snowMax),b.snowMax<=params.capSnow],['海拔',Number.isFinite(b.elev),b.elev<=params.capAltitude],['TOW',Number.isFinite(s.towPct),s.towPct<=params.capTow]];"
if needle in s: s=s.replace(needle,replacement,1)

# 11) One-click engineering reports (PDF via print dialog; Word via .doc HTML)
insert_before='async function air(lat,lon)'
report=r'''
function esc(v){return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}
function reportData(){if(!cache||!result||!result.base)throw Error('请先完成一次真实数据评估');let b=result.base,c=result.condensation,s=result.salt,d=result.dust;let topEnv=Object.entries(result.scores).sort((a,b)=>b[1]-a[1]),topEq=Object.entries(result.equipRisk).sort((a,b)=>b[1]-a[1]);let aqh=cache.aq?.j?.hourly||{};return{b,c,s,d,topEnv,topEq,aqh}}
function reportHtml(){let {b,c,s,d,topEnv,topEq,aqh}=reportData();let generated=new Date().toLocaleString(),scoreRows=topEnv.map(x=>`<tr><td>${esc(x[0])}</td><td>${x[1]}/100</td><td>${x[1]>=70?'高':x[1]>=40?'中':'低'}</td></tr>`).join(''),paramRows=Object.entries(params).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td><td>${esc(DEFAULT_PARAMS[k]===v?'默认':'已修改')}</td></tr>`).join(''),matrixRows=Object.entries(result.matrix).map(([env,row])=>`<tr><td>${env}</td>${Object.values(row).map(v=>`<td>${v}</td>`).join('')}</tr>`).join(''),eqs=Object.keys(sensitivity['高温']);let dataQuality=`ERA5 ${cache.w?.start||''}~${cache.w?.end||''}；CAMS ${cache.aq?.ok?'成功':'未取得'}；Marine ${cache.marine?.ok?'成功':'未取得'}；Elevation ${Number.isFinite(cache.elev)?'成功':'回退'}`;return `<!doctype html><html><head><meta charset="utf-8"><title>环境适应性工程评估报告</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,'Microsoft YaHei',sans-serif;color:#172033;font-size:10.5pt;line-height:1.55}h1{font-size:22pt;color:#0a2a59;border-bottom:3px solid #0a2a59;padding-bottom:8px}h2{font-size:14pt;color:#0a2a59;margin-top:22px;border-left:4px solid #1769e0;padding-left:8px}h3{font-size:11.5pt;color:#173b6d}table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #cfd8e6;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eef4fb;color:#0a2a59}.kpi{display:inline-block;width:30%;padding:10px;margin:3px;border:1px solid #cfd8e6;border-radius:8px}.kpi b{font-size:18pt;color:#0a2a59}.note{background:#f6f8fb;border-left:3px solid #1769e0;padding:8px}.warn{background:#fff7e6;border-left:3px solid #f0a500;padding:8px}.pageBreak{page-break-before:always}</style></head><body><h1>全球风电机组环境适应性工程评估报告</h1><p><b>项目：</b>${esc(current.name)}<br><b>坐标：</b>${current.lat.toFixed(4)}, ${current.lon.toFixed(4)}　<b>海拔：</b>${Math.round(b.elev)} m<br><b>模型版本：</b>V2.8 工程报告版　<b>生成时间：</b>${generated}</p><div class="kpi">环境严酷度<br><b>${result.severity}</b>/100</div><div class="kpi">设计能力满足率<br><b>${result.adapt}</b>%</div><div class="kpi">风险Gap<br><b>${result.gap}</b></div><h2>1. 数据来源与质量</h2><p>${esc(dataQuality)}</p><div class="note">说明：ERA5为再分析气象数据；阵风如无直接序列，按风速×${params.gustFactor}估算。CAMS/Marine属于补充数据源，获取失败不阻断ERA5核心评估。</div><h2>2. 环境风险画像</h2><table><tr><th>环境域</th><th>风险分</th><th>等级</th></tr>${scoreRows}</table><h2>3. 关键环境工程量</h2><table><tr><th>指标</th><th>结果</th></tr><tr><td>P99高温</td><td>${num(b.t99,1)} ℃</td></tr><tr><td>最低温度</td><td>${num(b.tmin,1)} ℃</td></tr><tr><td>平均RH</td><td>${num(b.rhMean,1)} %</td></tr><tr><td>最大日降雨</td><td>${num(b.rainMax,1)} mm/d</td></tr><tr><td>P99阵风（${(aqh.wind_gusts_10m||[]).length?'数据':'估算'}）</td><td>${num(b.gust99,1)} m/s</td></tr><tr><td>最大日降雪</td><td>${num(b.snowMax,1)} cm/d</td></tr></table><h2>4. 物理模型结果</h2><h3>4.1 凝露</h3><p>金属面热容 CA=ρ·Cp·δ；瞬态能量平衡考虑对流、太阳辐射和长波辐射。当前子步长 ${c.params?.dt_min||params.condDtMin} min。</p><table><tr><td>年凝露时长</td><td>${num(c.annualCondHours,0)} h/y</td></tr><tr><td>最低露点裕量</td><td>${num(c.minMargin,2)} K</td></tr><tr><td>最大连续凝露</td><td>${c.maxRunHours} h</td></tr><tr><td>年累计凝露量</td><td>${num(c.annualCondKgM2,2)} kg/m²·y</td></tr></table><h3>4.2 盐雾 / 腐蚀</h3><table><tr><td>海盐P95</td><td>${num(s.sea95,2)} μg/m³</td></tr><tr><td>Cl⁻沉积</td><td>${num(s.jcl,2)} mg/m²·d</td></tr><tr><td>TOW</td><td>${num(s.towPct,1)} %</td></tr></table><h3>4.3 粉尘 / 沙蚀</h3><table><tr><td>PM10 P95</td><td>${num(d.pm95,1)} μg/m³</td></tr><tr><td>过滤后年进入颗粒</td><td>${num(d.annualIn,2)} kg/y</td></tr><tr><td>过滤穿透系数</td><td>${num(d.penetration,3)}</td></tr><tr><td>年撞击质量</td><td>${num(d.impactMass,2)} kg/y</td></tr><tr><td>沙蚀EI</td><td>${num(d.erosionIndex,2)} EI/y</td></tr></table><h2 class="pageBreak">5. 环境 × 设备风险矩阵</h2><table><tr><th>环境</th>${eqs.map(e=>`<th>${e}</th>`).join('')}</tr>${matrixRows}</table><h2>6. TOP风险与工程建议</h2><p><b>TOP环境：</b>${topEnv.slice(0,3).map(x=>x[0]+' '+x[1]).join('；')}<br><b>TOP设备：</b>${topEq.slice(0,3).map(x=>x[0]+' '+x[1]).join('；')}</p><div class="note">${$('aiSummary')?.innerText||''}</div><h2>7. 模型边界</h2><div class="warn">本报告区分真实数据、再分析数据、估算参数和半经验模型。盐雾沉积、沙蚀EI、阵风估算等需要结合现场数据或专项试验校准，不能直接等同于材料寿命或认证结论。</div><h2>附录A 管理员参数快照</h2><table><tr><th>参数</th><th>本次值</th><th>状态</th></tr>${paramRows}</table></body></html>`}
function exportPDF(){try{let html=reportHtml(),w=window.open('','_blank');if(!w)throw Error('浏览器拦截了报告窗口');w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),450)}catch(e){alert(e.message)}}
function exportWord(){try{let html=reportHtml(),blob=new Blob(['\ufeff',html],{type:'application/msword'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`环境适应性工程评估报告_${(current.name||'Project').replace(/[^\w\u4e00-\u9fa5-]+/g,'_')}_V2.8.doc`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}catch(e){alert(e.message)}}
'''
if insert_before not in s: raise SystemExit('report insertion anchor missing')
s=s.replace(insert_before,report+insert_before,1)

# 12) Version title
s=s.replace('V2.7 PWA','V2.8 工程报告版')

p.write_text(s,encoding='utf-8')
print('V2.8 upgrade applied',len(s))
