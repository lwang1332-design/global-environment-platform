/* V2.9 Engineering Cockpit UI adapter.
 * Presentation / information architecture only.
 * Reads existing result/cache/params/V29JointResult and moves existing DOM nodes.
 * DOES NOT change APIs, formulas, scores, parameters, database or calculation logic.
 */
(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const finite=v=>Number.isFinite(Number(v));
const fmt=(v,n=1)=>finite(v)?Number(v).toFixed(n):'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unit=(v,n,u)=>`${fmt(v,n)}<small>${u}</small>`;
function band(v){v=Number(v)||0;return v>=80?['CRITICAL','critical']:v>=60?['HIGH','high']:v>=30?['MEDIUM','medium']:['LOW','low']}
function hasResult(){try{return !!result?.base}catch{return false}}
function safeResult(){try{return result||{}}catch{return {}}}
function safeCache(){try{return cache||null}catch{return null}}
function safeCurrent(){try{return current||{}}catch{return {}}}

function renameHeads(){
 const names=[['.mapCard','项目定位','项目位置 · 经纬度 · 地图'],['.summaryCard','综合评估','严酷度 · Gap · TOP风险'],['.envCard','核心环境数据','原始数据 → 统计 → 工程模型 → 环境指标 → 风险'],['.riskCard','环境风险画像','风险分布 · TOP排序'],['.physicsCard','六大物理模型','核心工程指标 · 设计判定'],['.matrixCard','环境 × 设备风险矩阵','R = H × S × E × P'],['.decisionCard','Engineering Decision','失效链 · Gap · 措施 · 验证']];
 names.forEach(([sel,a,b])=>{const c=q(sel),h=q('.head h2',c),s=q('.head span',c);if(h)h.textContent=a;if(s)s.textContent=b});
 const joint=q('#jointCard');if(joint){const h=q('.head h2',joint),s=q('.head span',joint);if(h)h.textContent='风温联合分布';if(s)s.textContent='逐小时温度 × 同时刻风速'}
}

function ensureLayout(){
 const dash=q('#mainPage .dashboard');if(!dash)return;
 document.body.classList.add('cockpit-v29');
 let shell=q('#cockpitLayout');
 if(!shell){
  shell=document.createElement('div');shell.id='cockpitLayout';shell.className='cockpitLayout';dash.prepend(shell);
  const hero=document.createElement('div');hero.className='cockpitHero';hero.id='cockpitHero';
  const envWrap=document.createElement('div');envWrap.className='cockpitSection cockpitEnvSection';envWrap.id='cockpitEnvSection';
  const analysis=document.createElement('div');analysis.className='cockpitAnalysis';analysis.id='cockpitAnalysis';
  const physics=document.createElement('div');physics.className='cockpitSection';physics.id='cockpitPhysicsSection';
  const matrix=document.createElement('div');matrix.className='cockpitSection';matrix.id='cockpitMatrixSection';
  const decision=document.createElement('div');decision.className='cockpitDecision';decision.id='cockpitDecision';
  const sources=document.createElement('section');sources.className='cockpitSources';sources.id='cockpitSources';sources.innerHTML='<div class="cockpitSectionTitle"><div><h2>数据源与更新时间</h2><p>ERA5 / CAMS / Marine / Elevation · 状态与数据周期</p></div><div id="cockpitUpdateMeta">等待数据</div></div><div id="cockpitSourceBody"></div>';
  shell.append(hero,envWrap,analysis,physics,matrix,decision,sources);
 }
 const hero=q('#cockpitHero'),envWrap=q('#cockpitEnvSection'),analysis=q('#cockpitAnalysis'),physics=q('#cockpitPhysicsSection'),matrixWrap=q('#cockpitMatrixSection'),decision=q('#cockpitDecision');
 const map=q('.mapCard'),sum=q('.summaryCard'),env=q('.envCard'),risk=q('.riskCard'),phys=q('.physicsCard'),mat=q('.matrixCard'),dec=q('.decisionCard'),joint=q('#jointCard');
 if(map&&map.parentElement!==hero)hero.append(map);
 if(sum&&sum.parentElement!==hero)hero.append(sum);
 if(env&&env.parentElement!==envWrap)envWrap.append(env);
 if(risk&&risk.parentElement!==analysis)analysis.append(risk);
 if(joint&&joint.parentElement!==analysis)analysis.append(joint);
 if(phys&&phys.parentElement!==physics)physics.append(phys);
 if(mat&&mat.parentElement!==matrixWrap)matrixWrap.append(mat);
 if(dec&&dec.parentElement!==decision){
   let top=q('#cockpitTopRisks');if(!top){top=document.createElement('section');top.id='cockpitTopRisks';top.className='card cockpitTopRisks';top.innerHTML='<div class="head"><h2>TOP 3 Engineering Risks</h2><span>环境 → 设备</span></div><div class="pad" id="cockpitTopRiskBody">等待计算</div>';decision.append(top)}
   decision.append(dec);
 }
 const summary=q('#uiDecisionSummary');const sp=q('.summaryCard .pad');if(summary&&sp&&summary.parentElement!==sp)sp.prepend(summary);
 const source=q('#sourceStatusGrid');const sb=q('#cockpitSourceBody');if(source&&sb&&source.parentElement!==sb)sb.append(source);
 q('#uiPrimaryGrid')?.classList.add('cockpitLegacyEmpty');q('#uiProjectSupport')?.classList.add('cockpitLegacyEmpty');
 prepareEnv();prepareRisk();preparePhysics();prepareDecision();renameHeads();
}

function prepareEnv(){
 const env=q('.envCard'),pad=q('.pad',env);if(!pad)return;
 let grid=q('#cockpitKpiGrid');if(!grid){grid=document.createElement('div');grid.id='cockpitKpiGrid';grid.className='cockpitKpiGrid';pad.prepend(grid)}
 q('#l1bar',env)?.classList.add('cockpitHiddenSupport');q('.envDetails',env)?.classList.add('cockpitHiddenSupport');q('#sourceStatusGrid',env)?.classList.add('cockpitMovedSource');
}
function prepareRisk(){
 const card=q('.riskCard'),pad=q('.pad',card);if(!pad)return;
 let body=q('#cockpitRiskBody');if(!body){body=document.createElement('div');body.id='cockpitRiskBody';body.className='cockpitRiskBody';const radar=document.createElement('div');radar.id='cockpitRadar';radar.className='cockpitRadar';const list=q('#riskList');if(list){list.before(body);body.append(radar,list)}}
}
function preparePhysics(){
 const card=q('.physicsCard'),pad=q('.pad',card);if(!pad)return;
 let grid=q('#cockpitPhysCards');if(!grid){grid=document.createElement('div');grid.id='cockpitPhysCards';grid.className='cockpitPhysCards';pad.prepend(grid)}
 q('.physGrid',card)?.classList.add('cockpitHiddenSupport');q('#uiModelWrap',card)?.classList.add('cockpitHiddenSupport');
}
function prepareDecision(){
 const dec=q('.decisionCard'),pad=q('.pad',dec);if(!pad)return;
 q('.decisionTop',dec)?.classList.add('cockpitHiddenSupport');
 const table=q('#decisionTableWrap',dec);if(table&&!table.closest('details.cockpitDecisionDetails')){const d=document.createElement('details');d.className='cockpitDecisionDetails';const s=document.createElement('summary');s.textContent='查看完整工程措施表';table.before(d);d.append(s,table)}
}

function observed(v){return v!==null&&v!==''&&Number.isFinite(Number(v))}
function clean(values){return Array.isArray(values)?values.filter(observed).map(Number):[]}
function average(values){const a=clean(values);return a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN}
function maximum(values){const a=clean(values);return a.length?Math.max(...a):NaN}
function percentile(values,p){const a=clean(values).sort((x,y)=>x-y);if(!a.length)return NaN;const i=(a.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return l===h?a[l]:a[l]+(a[h]-a[l])*(i-l)}
function deviation(values){const a=clean(values),m=average(a);return a.length&&finite(m)?Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length):NaN}
function yearSpan(hourly){const n=Array.isArray(hourly?.time)?hourly.time.length:Math.max(clean(hourly?.temperature_2m).length,clean(hourly?.relative_humidity_2m).length);return n?n/8760:NaN}
function annualizedHours(hourly,test){const n=Math.max(hourly?.temperature_2m?.length||0,hourly?.relative_humidity_2m?.length||0),years=yearSpan(hourly);if(!n||!finite(years)||years<=0)return NaN;let count=0;for(let i=0;i<n;i++)if(test(i))count++;return count/years}
function riskLevel(score,fallback='待评价'){if(!finite(score))return fallback;const name={CRITICAL:'极高风险',HIGH:'高风险',MEDIUM:'中风险',LOW:'低风险'};return name[band(score)[0]]}
function metric(name,variable,formula,algorithm,value,metricUnit,source,risk_level,decimals=1){
 return {name,variable,formula,algorithm,unit:metricUnit,source,risk_level,value:finite(value)?Number(value):null,decimals};
}
function metricHtml(m){return m.value===null?'--':unit(m.value,m.decimals,m.unit)}
function metricTrace(m){return [m.variable,'｜公式：',m.formula,'｜算法：',m.algorithm,'｜数据源：',m.source,'｜风险等级：',m.risk_level].join('')}
function environmentCard(moduleName,metrics,moduleRisk){
 const first=metrics[0]||metric('状态','--','--','等待数据',NaN,'','待接入','待接入',0);
 const items=metrics.slice(1).map(m=>'<div title="'+esc(metricTrace(m))+'"><span>'+esc(m.name)+'</span><b>'+metricHtml(m)+'</b></div>').join('');
 return '<article class="cockpitKpi" title="'+esc(metricTrace(first))+'"><div class="cockpitKpiTop"><span>'+esc(moduleName)+'</span><em>'+esc(moduleRisk)+'</em></div><div class="cockpitKpiValue">'+metricHtml(first)+'</div><div class="cockpitKpiLabel">'+esc(first.name)+'</div><div class="cockpitKpiItems">'+items+'</div></article>';
}
function buildEnvironmentModules(){
 const r=safeResult(),b=r.base||{},c=r.condensation||{},s=r.salt||{},d=r.dust||{},ca=safeCache(),h=ca?.w?.j?.hourly||{},aq=ca?.aq?.j?.hourly||{};
 const T=clean(h.temperature_2m),gust=clean(h.wind_gusts_10m),solar=clean(h.shortwave_radiation),sea=clean(aq.sea_salt_aerosol),so2=clean(aq.sulphur_dioxide);
 const years=yearSpan(h),tempRisk=riskLevel(Math.max(Number(r.scores?.高温)||0,Number(r.scores?.低温)||0)),humidityRisk=riskLevel(r.scores?.凝露),rainRisk=riskLevel(r.scores?.强降雨),dustRisk=riskLevel(Math.max(Number(r.scores?.粉尘积灰)||0,Number(r.scores?.沙蚀)||0)),windRisk=gust.length?riskLevel(r.scores?.极端风):'待接入',saltRisk=riskLevel(r.scores?.盐雾),altRisk=riskLevel(r.scores?.高海拔),gasRisk=riskLevel(r.composite?.corrosion),iceRisk='待接入';
 const AH=[];for(let i=0;i<Math.max(h.temperature_2m?.length||0,h.relative_humidity_2m?.length||0);i++){const tv=h.temperature_2m?.[i],rv=h.relative_humidity_2m?.[i],t=observed(tv)?Number(tv):NaN,rh=observed(rv)?Number(rv):NaN;if(finite(t)&&finite(rh)){const es=6.112*Math.exp(17.67*t/(t+243.5));AH.push(216.7*(es*rh/100)/(t+273.15))}}

 const ghi=solar.length&&finite(years)&&years>0?solar.reduce((x,y)=>x+y,0)/1000/years:NaN;
 const mold=annualizedHours(h,i=>observed(h.temperature_2m?.[i])&&observed(h.relative_humidity_2m?.[i])&&Number(h.temperature_2m[i])>20&&Number(h.relative_humidity_2m[i])>80);

 const drySalt=sea.length&&typeof params!=='undefined'&&finite(params.saltVd)?average(sea)*Number(params.saltVd)*86400/1000:NaN;
 const modules=[
  {module:'温度',risk_level:tempRisk,metrics:[
   metric('极端最高温','T_max_extreme','max(T)','多年小时温度序列最大值',maximum(T),'℃','ERA5 2 m小时温度',tempRisk,1),
   metric('极端最低温','T_min_extreme','min(T)','多年小时温度序列最小值',T.length?Math.min(...T):NaN,'℃','ERA5 2 m小时温度',tempRisk,1),
   metric('年平均温度','T_mean','ΣT/n','多年小时温度算术平均',b.tavg,'℃','ERA5 2 m小时温度',tempRisk,1),
   metric('日温差P95','DeltaT_day_P95','P95(Tmax−Tmin)','逐日计算最高温减最低温后取P95',b.dayRange,'K','ERA5逐日最高/最低温',tempRisk,1),
   metric('温变速率P95','DeltaT_rate_P95','P95(|Tᵢ₊₁−Tᵢ|/Δt)','相邻小时温差绝对值取P95，Δt=1 h',b.tempRate,'K/h','ERA5 2 m小时温度',tempRisk,1),
   metric('暴晒最高地表温度','T_surface_P99','P99(T_surface)','地表温度序列P99；当前数据源未提供',NaN,'℃','待接地表温度或表面热平衡模型','待接入',1)
  ]},
  {module:'湿度',risk_level:humidityRisk,metrics:[
   metric('年平均相对湿度','RH_mean','ΣRH/n','多年小时相对湿度算术平均',b.rhMean,'%','ERA5 2 m相对湿度',humidityRisk,1),
   metric('高湿时间比例','RH90_ratio','N(RH>90%)/N_total×100%','统计RH>90%的小时占比',b.rh90,'%','ERA5 2 m相对湿度',humidityRisk,1),
   metric('平均绝对湿度','AH_mean','216.7e/(T+273.15)','由温度、相对湿度和饱和水汽压逐小时计算后取均值',b.absHumMean,'g/m³','ERA5温度+相对湿度',humidityRisk,1),
   metric('最大绝对湿度','AH_max','max(AH)','逐小时绝对湿度最大值',maximum(AH),'g/m³','ERA5温度+相对湿度',humidityRisk,1),
   metric('年凝露时间','Condensation_hour','ΣI(Ts≤Td)·Δt','沿用现有瞬态表面温度与露点判据并年化',c.annualCondHours,'h/y','ERA5温湿度+现有凝露工程模型',humidityRisk,0)
  ]},
  {module:'降雨',risk_level:rainRisk,metrics:[
   metric('最大日降雨','Rain_daily_max','max(Rain_day)','多年逐日降雨最大值',b.rainMax,'mm/d','ERA5逐日降雨',rainRisk,1),
   metric('小时强降雨P99','Rain_hour_P99','P99(Rain_hour)','小时降雨量P99',b.rainP99h,'mm/h','ERA5小时降雨',rainRisk,2),
   metric('年降雨量','Rain_year','ΣRain/years','累计降雨量按数据年数年化',b.rainAnnual,'mm/y','ERA5逐日降雨',rainRisk,0),
   metric('雨水pH','Rain_pH','mean(pH) / range(pH)','降水化学样本均值及范围；当前未接入',NaN,'pH','待接降水化学监测','待接入',2),
   metric('冻雨频次','Freezing_rain_count','N(freezing-rain events)/years','冻雨事件去重并年化；当前未接入事件类型',NaN,'次/y','待接冻雨观测/天气现象编码','待接入',1),
   metric('湿雪频次','Wet_snow_count','N(wet-snow events)/years','湿雪事件去重并年化；当前缺少液态含水量',NaN,'次/y','待接湿雪观测或液态含水量','待接入',1)
  ]},
  {module:'PM10 / 颗粒物',risk_level:dustRisk,metrics:[
   metric('PM10平均','PM10_mean','ΣPM10/n','PM10小时浓度算术平均',d.pmMean,'μg/m³','CAMS Global小时PM10',dustRisk,1),
   metric('PM10 P95','PM10_P95','P95(PM10)','PM10小时浓度P95',d.pm95,'μg/m³','CAMS Global小时PM10',dustRisk,1),
   metric('年进入质量','Dust_mass_year','C×Q×t','沿用现有风量、过滤效率和运行时长工程模型',d.annualIn,'kg/y','CAMS PM10+现有设备参数',dustRisk,1),
   metric('沙尘粒径D50','Dust_D50','P50(particle diameter)','粒径谱中位径；当前无原始粒径谱',NaN,'μm','待接粒径谱监测','待接入',1),
   metric('沙蚀通量','Sand_flux','kρpCpVⁿ','颗粒浓度与冲击速度侵蚀模型；当前无可校准通量',NaN,'kg/m²·s','待接颗粒通量/粒径/撞击角数据','待接入',3),
   metric('沙尘暴时间','DustStorm_hour','ΣI(dust-storm event)·Δt/years','事件小时累计并年化；当前无事件标识',NaN,'h/y','待接沙尘暴事件库','待接入',0),
   metric('硅砂比例','SiO2_ratio','m(SiO₂)/m(dust)×100%','颗粒矿物化验统计；当前未接入',NaN,'%','待接颗粒化学成分监测','待接入',1),
   metric('矿物组成','Mineral_composition','composition(dust sample)','矿物组分数据库或样品XRD分析；当前未接入',NaN,'-','待接矿物数据库/现场样品','待接入',0)
  ]},
  {module:'风速',risk_level:windRisk,metrics:[
   metric('平均风速','Wind_mean','ΣV/n','多年小时风速算术平均',b.windMean,'m/s','ERA5 10 m小时风速',windRisk,1),
   metric('设计阵风','Wind_design','V_design','设备设计能力参数，不作为气象观测值',typeof params!=='undefined'?params.capWind:NaN,'m/s','现有设备设计参数',windRisk,0),
   metric('阵风P99','Gust_P99','P99(V_gust)','仅使用直接阵风时间序列；当前ERA5数据未提供时显示 --',percentile(gust,.99),'m/s',gust.length?'直接阵风时间序列':'未接入真实阵风数据','待接入',1),
   metric('湍流强度P95','TI_P95','P95(σV/Vmean)×100%','需要10分钟或更高频风速及窗口标准差；当前小时数据不足',NaN,'%','未接入真实高频风速数据','待接入',1),
   metric('极端风风险评分','Wind_risk_score','normalize(Gust_P99)','仅在获得真实阵风序列后计算；当前不使用代理值',gust.length?r.scores?.极端风:NaN,'0-100',gust.length?'真实阵风序列+既有风险模型':'未接入真实阵风数据','待接入',0)
  ]},
  {module:'盐雾',risk_level:saltRisk,metrics:[
   metric('Cl⁻沉积速率','Cl_dep_rate','F_salt=F_d+F_w','沿用现有海盐气溶胶、沉降速度和海岸修正模型',s.jcl,'mg/m²·d','CAMS海盐+ERA5湿度+现有盐雾模型',saltRisk,2),
   metric('润湿时间','TOW','N(RH>80%)/N_total×100%','RH>80%小时占比',s.towPct,'%','ERA5相对湿度',saltRisk,1),
   metric('海盐浓度P95','SeaSalt_P95','P95(Csalt)','海盐气溶胶小时浓度P95',s.sea95,'μg/m³','CAMS Global sea_salt_aerosol',saltRisk,2),
   metric('海盐浓度P99','SeaSalt_P99','P99(Csalt)','海盐气溶胶小时浓度P99',percentile(sea,.99),'μg/m³','CAMS Global sea_salt_aerosol',saltRisk,2),
   metric('干盐沉降速率','Dry_dep_rate','Csalt×Vd×86400/1000','平均海盐浓度乘沉降速度并换算为日通量',drySalt,'mg/m²·d','CAMS海盐+现有沉降速度参数',saltRisk,2)
  ]},
  {module:'海拔',risk_level:altRisk,metrics:[
   metric('海拔高度','Altitude','H_GIS','点位高程读取',b.elev,'m','Open-Meteo Elevation / ERA5回退',altRisk,0),
   metric('平均气压','Pressure_mean','mean(P_surface)/10','优先使用多年表面气压均值；缺失时核心模型采用标准大气回退',finite(b.pressureMean)?b.pressureMean/10:NaN,'kPa','ERA5表面气压',altRisk,1),
   metric('设计能力裕量','Altitude_margin','H_design−H_site','设计海拔能力上限减场址高程',(typeof params!=='undefined'?params.capAltitude:NaN)-Number(b.elev),'m','现有设计能力参数+场址高程',altRisk,0)
  ]},
  {module:'SO₂ / 腐蚀气体',risk_level:gasRisk,metrics:[
   metric('SO₂ P95','SO2_P95','P95(C_SO₂)','SO₂小时浓度P95',s.so295,'μg/m³','CAMS Global sulphur_dioxide',gasRisk,1),
   metric('SO₂ P99','SO2_P99','P99(C_SO₂)','SO₂小时浓度P99',percentile(so2,.99),'μg/m³','CAMS Global sulphur_dioxide',gasRisk,1),
   metric('H₂S P95','H2S_P95','P95(C_H₂S)','H₂S小时浓度P95；当前未接入',NaN,'μg/m³','待接H₂S监测/再分析数据','待接入',1),
   metric('H₂S P99','H2S_P99','P99(C_H₂S)','H₂S小时浓度P99；当前未接入',NaN,'μg/m³','待接H₂S监测/再分析数据','待接入',1)
  ]},
  {module:'冰雪冻雨',risk_level:iceRisk,metrics:[
   metric('年覆冰小时数','Ice_hour','ΣI(verified icing observation)·Δt/years','仅累计真实覆冰观测；温湿条件不能替代覆冰事实',NaN,'h/y','未接入真实覆冰事件/传感器数据','待接入',0),
   metric('覆冰厚度P95','Ice_thickness_P95','P95(Ice_thickness)','覆冰厚度序列P95；当前未接入',NaN,'mm','待接覆冰厚度监测/液态含水量模型','待接入',1),
   metric('覆冰厚度P99','Ice_thickness_P99','P99(Ice_thickness)','覆冰厚度序列P99；当前未接入',NaN,'mm','待接覆冰厚度监测/液态含水量模型','待接入',1)
  ]},
  {module:'太阳辐照',risk_level:'待评价',metrics:[
   metric('年总辐照量','Solar_year','ΣGHI·Δt/years','小时短波辐射积分并按数据年数年化',ghi,'kWh/m²·y','ERA5 shortwave_radiation','待评价',0),
   metric('UV-B紫外剂量','UV_dose','∫E_UVB(t)dt','UV-B辐照度时间积分；当前未接入光谱数据',NaN,'J/m²','待接UV-B光谱辐照数据','待接入',0)
  ]},
  {module:'生物环境',risk_level:'待评价',metrics:[
   metric('霉菌年生长小时数','Mold_hour','ΣI(T>20℃ ∧ RH>80%)·Δt/years','高温高湿潜势小时累计并年化',mold,'h/y','ERA5温度+相对湿度','待评价',0),
   metric('飞絮/昆虫风险得分','Bio_risk_score','f(T,RH,season,vegetation,events)','环境指数模型；当前缺少物候、植被和虫情数据',NaN,'0-100','待接物候/植被/虫情数据库','待接入',0)
  ]},
  {module:'雷电',risk_level:'待接入',metrics:[
   metric('地闪密度','Lightning_density','N_CG/(area·years)','GIS网格内云地闪次数按面积和年份归一化',NaN,'次/km²·y','待接全球/区域雷电定位网','待接入',2),
   metric('年雷电小时数','Thunder_hour','ΣI(lightning event)·Δt/years','雷电事件小时去重累计并年化',NaN,'h/y','待接雷电事件时间序列','待接入',0)
  ]}
 ];
 window.GE_CORE_ENVIRONMENT_DATA={chain:['原始气象数据','统计算法','工程计算模型','输出环境指标','设备设计风险评价'],modules:modules.map(x=>({module:x.module,risk_level:x.risk_level,indicators:x.metrics.map(({name,variable,formula,algorithm,unit,source,risk_level})=>({name,variable,formula,algorithm,unit,source,risk_level}))}))};
 return modules;
}
function renderKpis(){
 const box=q('#cockpitKpiGrid');if(!box)return;
 const names=['温度','湿度','降雨','PM10 / 颗粒物','风速','盐雾','海拔','SO₂ / 腐蚀气体','冰雪冻雨','太阳辐照','生物环境','雷电'];
 if(!hasResult()){box.innerHTML=names.map(name=>environmentCard(name,[metric('状态','--','--','等待原始数据',NaN,'','待评估','待评估',0)],'待评估')).join('');return}
 const modules=buildEnvironmentModules();box.innerHTML=modules.map(x=>environmentCard(x.module,x.metrics,x.risk_level)).join('');
}
function renderProjectSummary(){
 const card=q('.summaryCard'),pad=q('.pad',card);if(!pad)return;let meta=q('#cockpitProjectMeta');if(!meta){meta=document.createElement('div');meta.id='cockpitProjectMeta';meta.className='cockpitProjectMeta';pad.append(meta)}
 const cur=safeCurrent(),ca=safeCache(),parts=String(cur.name||'--').split(/\s*[·,]\s*/).filter(Boolean),region=parts.slice(1).join(' · ')||'--';
 meta.innerHTML=`<div><span>项目名称</span><b>${esc(parts[0]||cur.name||'--')}</b></div><div><span>国家 / 区域</span><b>${esc(region)}</b></div><div><span>经纬度</span><b>${finite(cur.lat)?Number(cur.lat).toFixed(4):'--'}, ${finite(cur.lon)?Number(cur.lon).toFixed(4):'--'}</b></div><div><span>数据更新时间</span><b>${esc(ca?.w?.end||'--')}</b></div>`;
}

function radarSvg(scores){
 const rows=Object.entries(scores||{});if(!rows.length)return '<div class="cockpitEmpty">等待风险计算</div>';
 const W=290,H=278,cx=145,cy=132,R=88,n=rows.length,pts=(rad)=>rows.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return `${(cx+rad*Math.cos(a)).toFixed(1)},${(cy+rad*Math.sin(a)).toFixed(1)}`}).join(' ');
 const data=rows.map(([_,v],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,rr=R*Math.max(0,Math.min(100,Number(v)||0))/100;return `${(cx+rr*Math.cos(a)).toFixed(1)},${(cy+rr*Math.sin(a)).toFixed(1)}`}).join(' ');
 const axes=rows.map(([name],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a),lx=cx+(R+24)*Math.cos(a),ly=cy+(R+24)*Math.sin(a);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${esc(name)}</text>`}).join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="环境风险雷达图"><g class="radarGrid"><polygon points="${pts(R*.25)}"/><polygon points="${pts(R*.5)}"/><polygon points="${pts(R*.75)}"/><polygon points="${pts(R)}"/>${axes}</g><polygon class="radarData" points="${data}"/></svg>`;
}
function renderRadar(){const box=q('#cockpitRadar');if(!box)return;const r=safeResult();box.innerHTML=`<div class="cockpitRadarTitle"><b>风险雷达</b><span>0–100</span></div>${radarSvg(r.scores)}`}

function renderPhysicsCards(){
 const out=q('#cockpitPhysCards'),body=q('#uiModelBody');if(!out)return;if(!body||!body.children.length){out.innerHTML='<div class="cockpitEmpty">等待物理模型计算</div>';return}
 out.innerHTML=qa('tr',body).map(tr=>{const td=qa('td',tr);if(td.length<6)return'';const btn=q('[data-model]',tr),id=btn?.dataset.model||'',name=td[0].textContent.trim(),risk=td[1].textContent.trim(),key=td[2].textContent.trim(),limit=td[3].textContent.trim(),judge=td[4].textContent.trim();const parts=key.split(/[；;]/).map(x=>x.trim()).filter(Boolean),core=parts.shift()||key,cls=judge.includes('不满足')?'fail':'pass';return `<article class="cockpitPhysCard ${cls}"><div class="cockpitPhysHead"><div><h3>${esc(name)}</h3><span>${esc(risk)}</span></div><em>${esc(judge)}</em></div><div class="cockpitPhysCore">${esc(core)}</div><div class="cockpitPhysAux">${parts.slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="cockpitPhysLimit"><span>设计限值</span><b>${esc(limit)}</b></div><button class="cockpitDetail" data-cockpit-model="${esc(id)}">查看详情</button></article>`}).join('');
 qa('[data-cockpit-model]',out).forEach(b=>b.onclick=()=>q(`#uiModelBody [data-model="${CSS.escape(b.dataset.cockpitModel)}"]`)?.click());
}

function renderTopRisks(){
 const box=q('#cockpitTopRiskBody');if(!box)return;const r=safeResult();if(!r.scores){box.innerHTML='等待计算';return}const rows=Object.entries(r.scores).sort((a,b)=>b[1]-a[1]).slice(0,3);box.innerHTML=rows.map(([env,H],i)=>{const pair=Object.entries(r.matrix?.[env]||{}).sort((a,b)=>b[1]-a[1])[0]||['--',0],b=band(H);return `<button class="cockpitRiskRank" data-env="${esc(env)}"><i>0${i+1}</i><div><b>${esc(env)}</b><span>${esc(pair[0])} · 设备风险 ${pair[1]}/100</span></div><strong>${H}<small>${b[0]}</small></strong></button>`}).join('');qa('.cockpitRiskRank',box).forEach(x=>x.onclick=()=>{try{if(typeof selectEnv==='function')selectEnv(x.dataset.env)}catch{}})
}

function renderJointStats(){
 const card=q('#jointCard');if(!card)return;let stats=q('#cockpitJointStats');const pad=q('.jointPad',card);if(!stats&&pad){stats=document.createElement('div');stats.id='cockpitJointStats';stats.className='cockpitJointStats';pad.prepend(stats)}if(!stats)return;
 let r;try{r=window.V29JointResult}catch{r=null}if(!r?.ok){stats.innerHTML='<div><span>高温时间</span><b>--</b><small>等待逐小时共同有效数据</small></div><div><span>高温高风</span><b>--</b><small>等待计算</small></div><div><span>高温低风</span><b>--</b><small>等待计算</small></div>';return}
 const t=q('#jointHHtemp')?.value||35,wh=q('#jointHHwind')?.value||8,wl=q('#jointHLwind')?.value||3;
 const item=(name,cond,x)=>`<div><span>${esc(name)}</span><b>${fmt(x.annual,0)} <small>h/y</small></b><strong>${fmt(x.pct,2)}%</strong><small>${esc(cond)}</small></div>`;
 stats.innerHTML=item('高温时间',`T ≥ ${t}℃`,r.highT)+item('高温高风',`T ≥ ${t}℃ 且 V ≥ ${wh}m/s`,r.hh)+item('高温低风',`T ≥ ${t}℃ 且 V ≤ ${wl}m/s`,r.hl);
}

function renderSourcesMeta(){const box=q('#cockpitUpdateMeta'),ca=safeCache();if(box)box.innerHTML=ca?.w?`ERA5 <b>${esc(ca.w.start)} ~ ${esc(ca.w.end)}</b> · 最近刷新 ${esc(ca.w.end)}`:'等待真实数据评估'}

function renderAll(){
 ensureLayout();renderKpis();renderProjectSummary();renderRadar();renderPhysicsCards();renderTopRisks();renderJointStats();renderSourcesMeta();
 // V2.9.1 reads the completed engineering summary rendered by ui-engineering.
 // Refresh it after the core result adapter finishes so the visible hero and
 // Engineering Decision do not remain in their initial "waiting" state.
 queueMicrotask(()=>window.CockpitScientific?.refresh?.());
}

function setupAdmin(){
 const admin=q('#adminPage');if(!admin||admin.dataset.cockpitAdmin)return;admin.dataset.cockpitAdmin='1';
 const state=q('#v29ParamState',admin);if(state)state.classList.add('cockpitAdminState');
 const cards=qa('.adminCard',admin);let layout=document.createElement('div');layout.className='cockpitAdminLayout';let aside=document.createElement('aside');aside.className='cockpitAdminNav';let work=document.createElement('main');work.className='cockpitAdminWork';layout.append(aside,work);admin.append(layout);cards.forEach(c=>work.append(c));
 q('.adminGrid',admin)?.classList.add('cockpitLegacyEmpty');q('.lockBanner',admin)?.classList.add('cockpitHiddenSupport');
 const groups=[['status','参数状态'],['cond','凝露模型'],['salt','盐雾腐蚀'],['dust','粉尘积灰'],['erosion','沙蚀模型'],['thermal','热管理'],['extreme','雨雪极端风'],['cap','设计能力'],['risk','风险阈值'],['data','数据源'],['version','版本管理']];
 function groupFor(card){const t=q('h3',card)?.textContent||'';if(t.includes('凝露'))return'cond';if(t.includes('盐雾'))return'salt';if(t.includes('沙尘 / 沙蚀设备'))return'erosion';if(t.includes('粉尘 / 沙蚀扩展'))return'dust';if(t.includes('雨雪 / 高海拔'))return'extreme';if(t.includes('设计能力 / 判据'))return'thermal';if(t.includes('设计能力扩展'))return'cap';if(t.includes('环境风险阈值')||t.includes('风险模型系数'))return'risk';if(t.includes('地图数据源')||t.includes('数据适用性'))return'data';return'cap'}
 cards.forEach(c=>c.dataset.adminGroup=groupFor(c));
 aside.innerHTML='<div class="cockpitAdminNavTitle">参数分类</div>'+groups.map(([k,n],i)=>`<button data-admin-tab="${k}" class="${i===0?'active':''}">${n}</button>`).join('');
 function show(k){qa('[data-admin-tab]',aside).forEach(b=>b.classList.toggle('active',b.dataset.adminTab===k));cards.forEach(c=>c.hidden=!(k==='status'||k==='version')&&c.dataset.adminGroup!==k);if(k==='status'||k==='version')cards.forEach(c=>c.hidden=true);if(state){state.classList.toggle('cockpitAdminFocus',k==='status'||k==='version');state.scrollIntoView({behavior:'smooth',block:'start'})}}
 qa('[data-admin-tab]',aside).forEach(b=>b.onclick=()=>show(b.dataset.adminTab));show('status');
 const acts=q('.v29ManageActions',state);if(acts&&!q('.cockpitAdminMore',acts)){const btns=qa('button',acts);if(btns.length>3){const d=document.createElement('details');d.className='cockpitAdminMore';d.innerHTML='<summary>更多参数操作</summary><div class="cockpitAdminMoreBody"></div>';const body=q('.cockpitAdminMoreBody',d);btns.slice(3).forEach(b=>body.append(b));acts.append(d)}}
 q('.adminActions',admin)?.classList.add('cockpitAdminBottom');
}

function hook(){
 try{if(typeof render==='function'&&!render.__cockpit){const old=render;const wrapped=function(){const x=old.apply(this,arguments);queueMicrotask(renderAll);return x};wrapped.__cockpit=true;render=wrapped}}catch(e){console.warn('Cockpit render hook skipped',e)}
 const joint=q('#jointCard');if(joint&&!joint.dataset.cockpitObserved){joint.dataset.cockpitObserved='1';let scheduled=false;new MutationObserver(records=>{const own=r=>{const el=r.target?.nodeType===1?r.target:r.target?.parentElement;return !!el?.closest?.('#cockpitJointStats')};if(records.length&&records.every(own))return;if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;renderJointStats()},0)}).observe(joint,{childList:true,subtree:true,characterData:true})}
 const admin=q('#adminPage');if(admin&&!q('#v29ParamState',admin)){new MutationObserver(()=>{if(q('#v29ParamState',admin))setupAdmin()}).observe(admin,{childList:true,subtree:true})}
}
function init(){ensureLayout();setupAdmin();hook();renderAll();setTimeout(()=>{ensureLayout();setupAdmin();hook();renderAll()},300);setTimeout(renderAll,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
