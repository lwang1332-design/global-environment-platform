const $=id=>document.getElementById(id);
const LOCAL={北京:[39.9042,116.4074,'北京 · 中国'],上海:[31.2304,121.4737,'上海 · 中国'],广州:[23.1291,113.2644,'广州 · 中国'],深圳:[22.5431,114.0579,'深圳 · 中国'],三亚:[18.2528,109.5119,'三亚 · 海南 · 中国'],乌鲁木齐:[43.8256,87.6168,'乌鲁木齐 · 新疆 · 中国']};
const CONFIG_KEY='ea_v25_admin_config',REPORT_KEY='ea_v27_report_snapshot';
let env={},selectedScene='',demandManual={},planManual=false,selectedPlan='Standard',packageManual={};
let cfg=loadAdminConfig();
let activePackages=Array.isArray(cfg.packages)?cfg.packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]):packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]);
let riskRules=mergeRiskRules(DEFAULT_RISK_RULES,cfg.riskRules||{});
let status={weather:['ERA5 / Open-Meteo','1/3/5年温度、湿度、降雨、风、辐射、降雪','未查询','—'],elev:['Open-Meteo Elevation','海拔','未查询','—'],air:['CAMS Global','近90天 PM10、Dust、SO₂、Sea Salt Aerosol','未查询','—']};

function loadAdminConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{"scenarios":{}}')}catch(e){return{scenarios:{}}}}
function mergeRiskRules(base,over){const out={};for(const [k,v] of Object.entries(base))out[k]={...v,...(over[k]||{})};return out}
function getScenario(name){const b=scenarioData[name],o=cfg.scenarios?.[name]||{};return{...b,...o,demands:o.demands||b.demands,reqs:o.reqs||b.reqs,plans:{...b.plans,...(o.plans||{})}}}
function iso(d){return d.toISOString().slice(0,10)}
function avg(a){const v=(a||[]).filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:NaN}
function quantile(a,p){const v=(a||[]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[Math.floor((v.length-1)*p)]:NaN}
function count(a,f){return(a||[]).reduce((n,x,i)=>n+(f(x,i)?1:0),0)}
function clamp(v,a=0,b=100){return Math.max(a,Math.min(b,v))}
function mh(v,start,full){return clamp((v-start)/(full-start)*100)}
function ml(v,fullBelow,zeroAbove){return clamp((zeroAbove-v)/(zeroAbove-fullBelow)*100)}
function mdown(v,start,full){return clamp((start-v)/(start-full)*100)}
function weighted(items){const den=items.reduce((s,x)=>s+x.w,0)||1;return items.reduce((s,x)=>s+x.v*x.w,0)/den}
function riskPct(metric){return (riskLevel(metric)-1)*50}

function setStatus(k,s,r){status[k][2]=s;status[k][3]=r;renderStatus()}
function renderStatus(){$('statusBody').innerHTML=Object.values(status).map(x=>`<tr><td>${x[0]}</td><td>${x[1]}</td><td class="${x[2]==='成功'?'ok':x[2]==='失败'?'bad':'wait'}">${x[2]}</td><td>${x[3]}</td></tr>`).join('')}
function updateMap(){const la=Number($('lat').value),lo=Number($('lon').value),dx=.8,dy=.5;if(!Number.isFinite(la)||!Number.isFinite(lo))return;$('map').src=`https://www.openstreetmap.org/export/embed.html?bbox=${lo-dx}%2C${la-dy}%2C${lo+dx}%2C${la+dy}&layer=mapnik&marker=${la}%2C${lo}`}
async function locate(name){name=String(name||'').trim();if(!name)throw Error('请输入地名');if(LOCAL[name])return{lat:LOCAL[name][0],lon:LOCAL[name][1],name:LOCAL[name][2]};const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh`);if(!r.ok)throw Error('地名解析失败 HTTP '+r.status);const j=await r.json();if(!j.results?.length)throw Error('未找到地名');const x=j.results[0];return{lat:x.latitude,lon:x.longitude,name:[x.name,x.admin1,x.country].filter(Boolean).join(' · ')}}

async function loadWeather(lat,lon,years){
  const end=new Date();end.setUTCDate(end.getUTCDate()-10);const start=new Date(end);start.setUTCFullYear(start.getUTCFullYear()-years);
  const vars='temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,wind_speed_10m,shortwave_radiation';
  const merged={temperature_2m:[],relative_humidity_2m:[],precipitation:[],rain:[],snowfall:[],wind_speed_10m:[],shortwave_radiation:[]};
  const chunks=[];let cur=new Date(start);
  while(cur<=end){let ce=new Date(Date.UTC(cur.getUTCFullYear(),11,31));if(ce>end)ce=new Date(end);chunks.push([new Date(cur),ce]);cur=new Date(Date.UTC(ce.getUTCFullYear()+1,0,1));}
  for(let i=0;i<chunks.length;i++){
    const [cs,ce]=chunks[i];$('locMsg').textContent=`正在读取气象数据 ${i+1}/${chunks.length}：${iso(cs)} ~ ${iso(ce)}…`;
    const u=`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${iso(cs)}&end_date=${iso(ce)}&hourly=${vars}&wind_speed_unit=ms&timezone=UTC&models=era5`;
    const r=await fetch(u);if(!r.ok)throw Error('ERA5 HTTP '+r.status);const j=await r.json();if(j.error)throw Error(j.reason||'ERA5错误');
    for(const k of Object.keys(merged))merged[k].push(...(j.hourly?.[k]||[]));
  }
  if(!merged.temperature_2m.length)throw Error('ERA5未返回有效小时数据');
  return{h:merged,start:iso(start),end:iso(end),years};
}
async function loadElev(lat,lon){const r=await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);if(!r.ok)throw Error('海拔 HTTP '+r.status);const j=await r.json();return j.elevation?.[0]}
async function loadAir(lat,lon){const e=new Date();e.setUTCDate(e.getUTCDate()-1);const s=new Date(e);s.setUTCDate(s.getUTCDate()-89);const u=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,dust,sulphur_dioxide,sea_salt_aerosol&start_date=${iso(s)}&end_date=${iso(e)}&timezone=auto&domains=cams_global`;const r=await fetch(u);if(!r.ok)throw Error('CAMS HTTP '+r.status);const j=await r.json();if(j.error)throw Error(j.reason||'CAMS错误');return j.hourly||{}}

function derive(h,air,elev){
  const T=h.temperature_2m||[],RH=h.relative_humidity_2m||[],P=h.precipitation||[],Snow=h.snowfall||[],W=h.wind_speed_10m||[],Rad=h.shortwave_radiation||[];
  const annualFactor=T.length?8760/T.length:1;
  const tv=T.filter(Number.isFinite),pv=P.filter(Number.isFinite);
  env={
    t99:quantile(T,.99),tmin:tv.length?Math.min(...tv):0,rhAvg:avg(RH),rh90:count(RH,x=>x>=90)*annualFactor,
    rainYear:pv.reduce((a,b)=>a+b,0)*annualFactor,rain1h:pv.length?Math.max(...pv):0,snowHours:count(Snow,x=>x>0)*annualFactor,
    wind95:quantile(W,.95),rad95:quantile(Rad,.95),alt:Number(elev||0),pm10:avg(air.pm10||[]),dust:avg(air.dust||[]),
    so2:avg(air.sulphur_dioxide||[]),salt:avg(air.sea_salt_aerosol||[])
  };
  Object.keys(env).forEach(k=>{if(!Number.isFinite(env[k]))env[k]=0});
}

function riskLevel(metric){const r=riskRules[metric];if(!r)return 1;const v=Number(env[metric]||0);if(r.direction==='low')return v<=Number(r.high)?3:v<=Number(r.medium)?2:1;return v>=Number(r.high)?3:v>=Number(r.medium)?2:1}
function renderEnv(){
  const defs=[['P99最高气温','t99','ERA5'],['极端最低气温','tmin','ERA5'],['年均相对湿度','rhAvg','ERA5'],['RH>90%','rh90','ERA5'],['年降水量','rainYear','ERA5'],['最大1h降水','rain1h','ERA5'],['海拔','alt','DEM'],['PM10均值','pm10','CAMS'],['Dust均值','dust','CAMS'],['Sea Salt Aerosol','salt','CAMS'],['SO₂均值','so2','CAMS'],['年降雪小时','snowHours','ERA5'],['P95风速','wind95','ERA5'],['P95太阳辐射','rad95','ERA5']];
  $('envGrid').innerHTML=defs.map(d=>{const r=riskLevel(d[1]),cl=r===3?'r-high':r===2?'r-mid':'r-low',v=env[d[1]]||0,unit=riskRules[d[1]]?.unit||({rhAvg:'%',}[d[1]]||'');return `<div class="metric"><small>${d[0]}</small><b>${Math.round(v*10)/10} ${unit}</b><em class="${cl}">${r===3?'高':r===2?'中':'低'}风险 · ${d[2]}</em></div>`}).join('')
}

function calcScene(name,items){const score=Math.round(weighted(items));const basis=[...items].sort((a,b)=>(b.v*b.w)-(a.v*a.w)).slice(0,3).map(x=>`${x.label} ${Math.round(x.v)}%`).join('；');return{name,score:clamp(score),basis}}
function sceneScores(){
  const e=env,mt=$('machineType').value;
  const normalPenalty=weighted([
    {v:riskPct('t99'),w:.14},{v:riskPct('tmin'),w:.10},{v:riskPct('rh90'),w:.10},{v:Math.max(riskPct('rainYear'),riskPct('rain1h')),w:.08},
    {v:Math.max(riskPct('pm10'),riskPct('dust')),w:.16},{v:riskPct('salt'),w:.12},{v:riskPct('alt'),w:.10},{v:riskPct('snowHours'),w:.05},{v:riskPct('so2'),w:.09},{v:riskPct('rad95'),w:.06}
  ]);
  const arr=[
    {name:'常温内陆气候',score:clamp(100-normalPenalty-(mt==='海上'?25:0)),basis:'专项环境风险综合扣分；特殊风险越低，常温内陆匹配度越高'},
    calcScene('热带雨林气候',[
      {label:'P99高温',v:mh(e.t99,30,38),w:.20},{label:'年均湿度',v:mh(e.rhAvg,70,85),w:.20},{label:'RH>90%',v:mh(e.rh90,300,1500),w:.15},
      {label:'年降水',v:mh(e.rainYear,1200,2500),w:.25},{label:'小时强降雨',v:mh(e.rain1h,20,80),w:.10},{label:'太阳辐射',v:mh(e.rad95,500,800),w:.10}
    ]),
    calcScene('滨海盐雾气候',[
      {label:'海盐气溶胶',v:mh(e.salt,2,20),w:.40},{label:'年均湿度',v:mh(e.rhAvg,65,85),w:.15},{label:'RH>90%',v:mh(e.rh90,300,1200),w:.10},
      {label:'年降水',v:mh(e.rainYear,700,1800),w:.10},{label:'P95风速',v:mh(e.wind95,6,15),w:.10},{label:'低海拔',v:ml(e.alt,300,1800),w:.15}
    ]),
    calcScene('沙戈荒气候',[
      {label:'PM10',v:mh(e.pm10,40,150),w:.20},{label:'Dust',v:mh(e.dust,30,150),w:.25},{label:'少降水',v:ml(e.rainYear,300,900),w:.20},
      {label:'P99高温',v:mh(e.t99,35,45),w:.15},{label:'强辐射',v:mh(e.rad95,550,850),w:.10},{label:'低湿度',v:ml(e.rhAvg,45,75),w:.10}
    ]),
    calcScene('高温环境',[
      {label:'P99高温',v:mh(e.t99,38,48),w:.65},{label:'太阳辐射',v:mh(e.rad95,550,850),w:.25},{label:'高温风险等级',v:riskPct('t99'),w:.10}
    ]),
    calcScene('高原高寒气候',[
      {label:'海拔',v:mh(e.alt,1200,3500),w:.55},{label:'极端低温',v:mdown(e.tmin,-10,-35),w:.20},{label:'强辐射',v:mh(e.rad95,550,850),w:.15},{label:'低湿度',v:ml(e.rhAvg,40,75),w:.10}
    ]),
    calcScene('寒地暴雪气候',[
      {label:'极端低温',v:mdown(e.tmin,-10,-35),w:.55},{label:'降雪小时',v:mh(e.snowHours,20,200),w:.35},{label:'P95风速',v:mh(e.wind95,8,18),w:.10}
    ]),
    calcScene('海洋气候',[
      {label:'海上机型',v:mt==='海上'?100:0,w:.30},{label:'海盐气溶胶',v:mh(e.salt,3,20),w:.30},{label:'年均湿度',v:mh(e.rhAvg,70,88),w:.15},
      {label:'P95风速',v:mh(e.wind95,8,18),w:.10},{label:'强降雨',v:mh(e.rain1h,20,80),w:.10},{label:'低海拔',v:ml(e.alt,100,1000),w:.05}
    ]),
    calcScene('工矿腐蚀环境',[
      {label:'SO₂',v:mh(e.so2,3,20),w:.50},{label:'PM10',v:mh(e.pm10,40,120),w:.15},{label:'Dust',v:mh(e.dust,30,120),w:.15},{label:'高湿',v:mh(e.rhAvg,60,85),w:.10},{label:'RH>90%',v:mh(e.rh90,200,1000),w:.10}
    ])
  ];
  if(mt==='海上'){const ocean=arr.find(x=>x.name==='海洋气候'),coast=arr.find(x=>x.name==='滨海盐雾气候');if(ocean){ocean.score=clamp(ocean.score+15);ocean.basis='海上机型先验 + '+ocean.basis}if(coast)coast.score=clamp(coast.score-10)}
  return arr.sort((a,b)=>b.score-a.score);
}
function matchClass(score){return score>=MATCH_RULE.high?'high':score>=MATCH_RULE.medium?'mid':'low'}
function matchLabel(score){return score>=MATCH_RULE.high?'高匹配':score>=MATCH_RULE.medium?'中匹配':'低匹配'}
function renderScenes(){
  const arr=sceneScores();if(!selectedScene)selectedScene=arr[0].name;$('sceneBadge').textContent=`主场景：${arr[0].name} ${arr[0].score}% · 次场景：${arr[1].name} ${arr[1].score}%`;
  $('sceneGrid').innerHTML=arr.map((s,i)=>{const d=getScenario(s.name),cl=matchClass(s.score);return `<div class="scene score-${cl} ${i===0?'primary-scene':''} ${selectedScene===s.name?'selected-scene':''}" onclick="selectScene('${s.name}')"><span class="pill">${i===0?'主场景':i===1?'次场景':matchLabel(s.score)}</span><h4>${s.name}</h4><p>${d.def}</p><p><b>关键特征：</b>${d.features}</p><p><b>${matchLabel(s.score)}</b> · 匹配度 ${s.score}%</p><div class="scorebar"><i class="bar-${cl}" style="width:${s.score}%"></i></div><p class="score-basis">评分依据：${s.basis}</p></div>`}).join('');
  return arr;
}
window.selectScene=function(name){selectedScene=name;demandManual={};planManual=false;renderDecision()}

function evidenceFor(type){const e=env;const map={heat:`P99高温 ${e.t99.toFixed(1)}℃；P95辐射 ${e.rad95.toFixed(0)}W/m²`,humidity:`年均RH ${e.rhAvg.toFixed(1)}%；RH>90% ${e.rh90.toFixed(0)}h/y`,rain:`年降水 ${e.rainYear.toFixed(0)}mm；最大1h ${e.rain1h.toFixed(1)}mm/h`,dust:`PM10 ${e.pm10.toFixed(1)}μg/m³；Dust ${e.dust.toFixed(1)}μg/m³`,salt:`Sea Salt Aerosol ${e.salt.toFixed(1)}μg/m³；RH ${e.rhAvg.toFixed(1)}%`,mist:`RH>90% ${e.rh90.toFixed(0)}h/y；年均RH ${e.rhAvg.toFixed(1)}%`,altitude:`海拔 ${e.alt.toFixed(0)}m；极端低温 ${e.tmin.toFixed(1)}℃`,cold:`极端低温 ${e.tmin.toFixed(1)}℃；降雪 ${e.snowHours.toFixed(0)}h/y`,snow:`降雪 ${e.snowHours.toFixed(0)}h/y；极端低温 ${e.tmin.toFixed(1)}℃`,marine:`Sea Salt ${e.salt.toFixed(1)}μg/m³；RH ${e.rhAvg.toFixed(1)}%；P95风速 ${e.wind95.toFixed(1)}m/s`,industry:`SO₂ ${e.so2.toFixed(1)}μg/m³；PM10 ${e.pm10.toFixed(1)}μg/m³`,normal:`P99高温 ${e.t99.toFixed(1)}℃；年降水 ${e.rainYear.toFixed(0)}mm`};return map[type]||'结合项目环境体检参数'}
function selectedDemands(){const d=getScenario(selectedScene);if(!d)return[];return d.demands.filter((x,i)=>demandManual[selectedScene+'#'+i])}
function renderDemands(){const d=getScenario(selectedScene);if(!d)return;d.demands.forEach((x,i)=>{const key=selectedScene+'#'+i;if(!(key in demandManual))demandManual[key]=true});const selected=selectedDemands();$('demandCount').textContent=selected.length+' 条核心诉求';$('demandGrid').innerHTML=d.demands.map((x,i)=>{const key=selectedScene+'#'+i;return `<label class="demand"><input type="checkbox" ${demandManual[key]?'checked':''} onchange="demandManual['${key}']=this.checked;renderRequirements();renderPackages();renderGap();renderResult()"><span><b>${x[0]}</b><br>${x[1]}<span class="evidence">环境依据：${evidenceFor(x[2])}</span></span></label>`}).join('')}
function buildRequirements(){const d=getScenario(selectedScene);if(!d)return[];let rows=[];d.demands.forEach((x,i)=>{if(!demandManual[selectedScene+'#'+i])return;const reqs=d.reqs[x[2]]||[];reqs.forEach((r,j)=>{const verify=j===0?'设计计算/项目技术规范校核':j===1?'专项试验或环境验证':'设计评审 + 验证';rows.push([x[0],evidenceFor(x[2]),r,verify])})});const uniq=[],seen=new Set();for(const r of rows){if(!seen.has(r[2])){seen.add(r[2]);uniq.push(r)}}return uniq}
function renderRequirements(){const uniq=buildRequirements();$('reqCount').textContent=uniq.length+' 条设计需求';$('reqBody').innerHTML=uniq.length?uniq.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join(''):`<tr><td colspan="4" class="empty">请至少勾选一条客户核心诉求。</td></tr>`}

function envRiskCode(){const keys=Object.keys(riskRules).filter(k=>k!=='rhAvg');return Math.max(1,...keys.map(riskLevel))}
function recommendedPlan(){const envCode=envRiskCode(),machine=Number($('machineLevel').value||2);let gap=Math.max(0,envCode-machine);let name=gap===0?'Standard':gap===1?'Pro':'Plus';if($('machineType').value==='海上'&&selectedScene==='海洋气候'&&name==='Standard')name='Pro';return{name,envCode,machine,gap}}
function renderPlans(){const r=recommendedPlan();if(!planManual)selectedPlan=r.name;$('planBadge').textContent=`系统推荐：${r.name}`;const d=getScenario(selectedScene);$('planGrid').innerHTML=['Standard','Pro','Plus'].map(name=>`<div class="plan ${selectedPlan===name?'selected':''}"><span class="pill">${name===r.name?'系统推荐':'可选'}</span><h4>${name}</h4><ul>${(d?.plans?.[name]||[]).map(x=>`<li>${x}</li>`).join('')}</ul><div class="plan-footer"><span>作为场景主方案</span><input type="radio" name="plan" ${selectedPlan===name?'checked':''} onchange="selectedPlan='${name}';planManual=true;renderPlans();renderPackages();renderGap();renderResult()"></div></div>`).join('');$('planReason').innerHTML=`推荐规则：项目环境最高需求 <b>${r.envCode}/3</b>，当前机组基础能力 <b>${r.machine}/3</b>，能力差 <b>${r.gap}</b> → 推荐 <b>${r.name}</b>。场景方案内容来自 <b>${selectedScene}</b> 技术货架。`}

function packageTrigger(p){const types=p[3]||[];let s=0;for(const t of types){if(t==='heat')s=Math.max(s,riskLevel('t99'),riskLevel('rad95'));if(t==='humidity')s=Math.max(s,riskLevel('rh90'));if(t==='rain')s=Math.max(s,riskLevel('rainYear'),riskLevel('rain1h'));if(t==='dust')s=Math.max(s,riskLevel('pm10'),riskLevel('dust'));if(t==='salt')s=Math.max(s,riskLevel('salt'));if(t==='mist')s=Math.max(s,riskLevel('rh90'));if(t==='altitude')s=Math.max(s,riskLevel('alt'));if(t==='cold')s=Math.max(s,riskLevel('tmin'));if(t==='snow')s=Math.max(s,riskLevel('snowHours'));if(t==='marine')s=Math.max(s,riskLevel('salt'),riskLevel('rh90'),riskLevel('rain1h'));if(t==='industry')s=Math.max(s,riskLevel('so2'),riskLevel('pm10'),riskLevel('dust'))}
  const d=getScenario(selectedScene);if(d&&d.demands.some((x,i)=>demandManual[selectedScene+'#'+i]&&types.includes(x[2])))s=Math.max(s,2);if(p[0]==='海洋强化包'&&selectedScene==='海洋气候')s=3;if(p[0]==='工矿污染包'&&selectedScene==='工矿腐蚀环境')s=3;return s}
function packageEntries(){const entries=activePackages.map((p,i)=>({p,i,auto:packageTrigger(p)}));for(const x of entries)if(!(x.i in packageManual))packageManual[x.i]=false;return entries.sort((a,b)=>b.auto-a.auto||a.i-b.i)}
function renderPackages(){let n=0;const entries=packageEntries();$('packageGrid').innerHTML=entries.map(x=>{const {p,i,auto}=x,sel=packageManual[i];if(sel)n++;const txt=auto>=3?'强烈推荐':auto===2?'推荐':auto===1?'可选':'不触发',cl=auto>=3?'strong':auto===2?'auto':'';return `<div class="package ${sel?'selected':''}"><input type="checkbox" ${sel?'checked':''} onchange="packageManual[${i}]=this.checked;this.closest('.package').classList.toggle('selected',this.checked);$('pkgCount').textContent=activePackages.reduce((n,p,j)=>n+(packageManual[j]?1:0),0)+' 个升级包';renderGap();renderResult()"><span class="tag ${cl}">${txt}</span><h4>${p[0]}</h4><p><b>适用：</b>${p[1]}<br>${p[2]}</p><small>风险/推荐等级 ${auto}/3 · 按等级固定排序 · 默认不勾选</small></div>`}).join('');$('pkgCount').textContent=n+' 个升级包'}

const GAP_DOMAINS=[
  ['高温','t99',['heat']],['低温','tmin',['cold']],['高湿/凝露','rh90',['humidity','mist']],['强降雨','rain1h',['rain']],['沙尘','pm10',['dust']],['盐雾','salt',['salt','marine']],['高海拔','alt',['altitude']],['暴雪结冰','snowHours',['snow']],['工矿污染','so2',['industry']],['强辐射','rad95',['heat']]
];
function gapRows(){const base=Math.max(0,Number($('machineLevel').value||1)-1),plan={Standard:0,Pro:1,Plus:2}[selectedPlan]||0;return GAP_DOMAINS.map(([domain,metric,types])=>{let need=riskLevel(metric);if(domain==='沙尘')need=Math.max(riskLevel('pm10'),riskLevel('dust'));if(domain==='强降雨')need=Math.max(riskLevel('rainYear'),riskLevel('rain1h'));if(domain==='工矿污染')need=Math.max(riskLevel('so2'),riskLevel('pm10'),riskLevel('dust'));const pkg=activePackages.some((p,i)=>packageManual[i]&&(p[3]||[]).some(t=>types.includes(t)))?2:0;const supplied=Math.min(3,base+plan+pkg),rem=Math.max(0,need-supplied);return{domain,need,base,plan,pkg,supplied,rem}})}
function renderGap(){const rows=gapRows(),max=Math.max(0,...rows.map(r=>r.rem));$('gapBadge').textContent=`综合剩余风险：${max>=2?'高':max===1?'中':'低'}`;$('gapBody').innerHTML=rows.map(r=>`<tr><td>${r.domain}</td><td>${r.need}/3</td><td>${r.base}/3</td><td>主方案 +${r.plan}</td><td>升级包 +${r.pkg}</td><td>${r.supplied}/3</td><td class="${r.rem>=2?'gap-high':r.rem===1?'gap-mid':'gap-low'}">${r.rem>=2?'高':r.rem===1?'中':'低'} (${r.rem})</td></tr>`).join('');return rows}

function getSelectedPackageSnapshot(){return packageEntries().filter(x=>packageManual[x.i]).map(x=>({name:x.p[0],level:x.auto,apply:x.p[1],desc:x.p[2]}))}
function saveReportSnapshot(){if(!Object.keys(env).length)return false;const scenes=sceneScores(),requirements=buildRequirements(),gaps=gapRows(),selectedPkgs=getSelectedPackageSnapshot();const snap={version:'V2.7',generatedAt:new Date().toISOString(),project:{name:$('projectName').value||'项目',place:$('place').value,lat:Number($('lat').value),lon:Number($('lon').value),machineLevel:$('machineLevel').selectedOptions[0]?.text||'',machineType:$('machineType').value,periodYears:Number($('periodYears').value||1)},env:{...env},riskRules,scenes,selectedScene,demands:selectedDemands().map(x=>({title:x[0],text:x[1],type:x[2],evidence:evidenceFor(x[2])})),requirements:requirements.map(r=>({source:r[0],evidence:r[1],requirement:r[2],verify:r[3]})),plan:{name:selectedPlan,items:[...(getScenario(selectedScene)?.plans?.[selectedPlan]||[])]},packages:selectedPkgs,gaps,status:Object.values(status).map(x=>({source:x[0],usage:x[1],state:x[2],return:x[3]})),summary:{residual:Math.max(0,...gaps.map(r=>r.rem))}};localStorage.setItem(REPORT_KEY,JSON.stringify(snap));return true}
function renderResult(){const selected=getSelectedPackageSnapshot();$('resultTitle').textContent=$('projectName').value||'项目';$('resultChips').innerHTML=`<span>主场景：${selectedScene||'—'}</span><span>主方案：${selectedPlan}</span><span>升级包：${selected.length}项</span><span>统计周期：最近${Number($('periodYears').value||1)}年</span>`;$('resultText').innerHTML=`建议配置：<b>${selectedScene||'待识别'} · ${selectedPlan}</b>${selected.length?' + '+selected.map(x=>x.name).join(' + '):''}。项目输出已同步写入报告模板，可点击右上角“报告输出”。`;saveReportSnapshot()}
function renderDecision(){renderEnv();renderScenes();renderDemands();renderRequirements();renderPlans();renderPackages();renderGap();renderResult()}

async function assess(byPlace){$('locMsg').className='msg';const years=Number($('periodYears').value||1);$('locMsg').textContent=`正在定位并读取最近${years}年项目环境数据…`;let lat=Number($('lat').value),lon=Number($('lon').value);try{if(byPlace){const l=await locate($('place').value);lat=l.lat;lon=l.lon;$('lat').value=lat;$('lon').value=lon;$('place').value=l.name;$('locMsg').textContent=`已定位：${l.name} ｜ ${lat.toFixed(4)}, ${lon.toFixed(4)}。正在查询数据…`}updateMap();status.weather[1]=`最近${years}年温度、湿度、降雨、风、辐射、降雪`;setStatus('weather','查询中','—');setStatus('elev','查询中','—');setStatus('air','查询中','—');const w=await loadWeather(lat,lon,years);setStatus('weather','成功',`${w.start} ~ ${w.end} · ${(w.h.temperature_2m||[]).length}小时`);const [er,ar]=await Promise.allSettled([loadElev(lat,lon),loadAir(lat,lon)]);let elev=0,air={};if(er.status==='fulfilled'){elev=er.value;setStatus('elev','成功',Math.round(elev)+' m')}else setStatus('elev','失败',er.reason?.message||'失败');if(ar.status==='fulfilled'){air=ar.value;setStatus('air','成功','近90天 PM10 / Dust / SO₂ / Sea Salt 已返回')}else setStatus('air','失败',ar.reason?.message||'失败');derive(w.h,air,elev);selectedScene='';demandManual={};planManual=false;packageManual={};renderDecision();$('locMsg').textContent=`项目环境分析完成：${w.start} ~ ${w.end}。已完成场景识别、客户诉求、产品设计需求、主方案、升级包和 Design Gap。`}catch(e){console.error(e);$('locMsg').className='msg error';$('locMsg').textContent='数据查询失败：'+(e.message||String(e))}}

function openReport(){if(!saveReportSnapshot()){alert('请先完成项目环境查询，再输出报告。');return}window.open('v2.5-report.html','_blank')}
$('topRun').onclick=()=>assess(false);$('placeRun').onclick=()=>assess(true);$('coordRun').onclick=()=>assess(false);$('reportBtn').onclick=openReport;$('lat').onchange=updateMap;$('lon').onchange=updateMap;$('machineLevel').onchange=()=>{if(Object.keys(env).length){planManual=false;renderPlans();renderPackages();renderGap();renderResult()}};$('machineType').onchange=()=>{if(Object.keys(env).length){selectedScene='';planManual=false;renderDecision()}};$('periodYears').onchange=()=>{if(Object.keys(env).length)$('locMsg').textContent='统计周期已修改，请重新查询项目环境以刷新统计结果。'};$('projectName').oninput=()=>{if(Object.keys(env).length)renderResult()};
updateMap();renderStatus();$('envGrid').innerHTML='<div class="empty">等待项目环境查询…</div>';$('sceneGrid').innerHTML='<div class="empty">完成项目环境查询后识别9种场景。</div>';$('demandGrid').innerHTML='<div class="empty">识别场景后生成客户核心诉求。</div>';$('reqBody').innerHTML='<tr><td colspan="4" class="empty">识别客户核心诉求后生成产品设计需求。</td></tr>';$('planGrid').innerHTML='<div class="empty">完成环境风险和场景识别后匹配主方案。</div>';$('packageGrid').innerHTML='<div class="empty">完成环境与客户诉求识别后推荐升级包。</div>';$('gapBody').innerHTML='<tr><td colspan="7" class="empty">完成方案和升级包选择后计算 Design Gap。</td></tr>';$('resultChips').innerHTML='<span>等待项目环境分析</span>';
