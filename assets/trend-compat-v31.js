/* V3.1 trend registry/UI compatibility adapter.
 * Keeps the engineering registry authoritative while exposing a stable UI contract.
 * Legacy card labels are mapped only when the physical/statistical meaning is compatible.
 */
(()=>{
'use strict';
const A=window.GETrendAnalysis;
if(!A||A.uiCompat==='v31.2')return;
const oldPrepareIndicator=A.prepareIndicator?.bind(A);
const statusMap={A:'A 已接入',B:'B 可直接接入',C:'C 可模型计算',D:'D 站点/区域可接',E:'E 数据受限','A/B':'A/B 已接入/可直接接入','C/D':'C/D 模型/区域可接'};
const classMap=v=>{const s=String(v||'');if(s==='未接入')return'未接入';if(s.includes('静态')||s.includes('GIS'))return'GIS/静态环境数据';if(s.includes('模型值'))return'工程模型值';if(s.includes('派生')||s.includes('统计'))return'工程派生';if(s.includes('再分析')||s.includes('模式')||s.includes('档案')||s.includes('观测'))return'真实数据';return s||'未接入'};
const status=v=>{const s=String(v||'');return statusMap[s]||s||'E 数据受限'};
function normalize(i,moduleName){
 if(!i)return null;
 const module=i.module||moduleName||'',key=i.key||i.metricKey||i.name;
 let unit=i.unit||i.seriesUnit||'',summaryUnit=i.summaryUnit||i.unit||'';
 // These registry metrics summarize a 0/1 state, while the card summary is a percentage/count.
 if(['rh90_ratio','cond_hours','mold_hours','tow','freeze_thaw'].includes(key))unit='0/1';
 // Underlying curves are daily/hourly contributions even when the card is a cumulative statistic.
 if(key==='rain_total')unit='mm/d';
 if(key==='solar_total')unit='kWh/m²/时步';
 return{...i,module,key,id:i.id||`${module}::${key}`,summaryUnit,unit,series:i.series||i.raw||[],raw:i.raw||i.series||[],rawResolution:i.rawResolution||i.coverage?.resolution||i.sourceResolution||'按数据源',method:i.method||i.underlyingLabel||'',originalDataClass:i.originalDataClass||i.dataClass,dataClass:classMap(i.dataClass),accessStatus:status(i.accessStatus)};
}
function prepareIndicator(moduleName,key){return normalize(oldPrepareIndicator?.(moduleName,key),moduleName)}
function prepareModule(moduleName){const mod=A.moduleCatalog?.().find(m=>m.module===moduleName);if(!mod)return null;const indicators=(mod.indicators||[]).map(i=>prepareIndicator(moduleName,i.key)).filter(Boolean),available=indicators.filter(i=>i.trendAvailable),rawDefaults=(mod.indicators||[]).filter(i=>i.defaultSelected).slice(0,3).map(i=>i.key),defaults=(rawDefaults.length?rawDefaults:available.slice(0,3).map(i=>i.key)).map(k=>`${moduleName}::${k}`);return{module:moduleName,requestedYears:A.selectedYears?.()||1,indicators,defaultSelected:defaults}}
function prepareAll(){return(A.moduleCatalog?.()||[]).map(m=>prepareModule(m.module)).filter(Boolean)}
const aliases={
 '极端最高温':'temp_max','极端最低温':'temp_min','年平均温度':'temp_mean','日温差P95':'day_range_p95','温变速率P95':'temp_rate_p95','暴晒最高地表温度':'surface_temp_p99',
 '年平均相对湿度':'rh_mean','高湿时间比例':'rh90_ratio','平均绝对湿度':'ah_mean','最大绝对湿度':'ah_max','年凝露时间':'cond_hours',
 '最大单日降雨':'rain_daily_max','最大日降雨':'rain_daily_max','小时强降雨P99':'rain_hour_p99','小时降雨P99':'rain_hour_p99','年降雨量':'rain_total','年累计降雨':'rain_total','累计降雨':'rain_total','风驱雨联合指数':'wdr','风驱雨指数':'wdr',
 'PM10平均':'pm10_mean','PM10 P95':'pm10_p95','PM2.5 P95':'pm25','Dust P95':'dust','年进入质量':'dust_mass_year','等效年化进入颗粒质量':'dust_mass_year',
 '平均风速':'wind_mean','10 m风速':'wind_mean','阵风P99':'gust_p99','最大阵风':'gust_max',
 'Cl⁻沉积速率':'cl_dep_rate','润湿时间':'tow','TOW':'tow','海盐浓度P95':'seasalt_p95','海盐浓度P99':'seasalt_p99','干盐沉降速率':'dry_dep_rate','总盐干沉积速率':'dry_dep_rate',
 '项目海拔':'altitude','海拔高度':'altitude','平均气压':'pressure_mean','表面气压':'pressure_mean','空气密度':'air_density','设计能力裕量':'altitude_margin','海拔设计裕量':'altitude_margin','设计海拔裕量':'altitude_margin',
 'SO₂ P95':'so2_p95','SO₂ P99':'so2_p99','NO₂ P95':'no2_p95','O₃ P95':'ozone_p95',
 '最大日降雪':'snow_daily_max','累计降雪':'snow_total','冻融循环':'freeze_thaw','冻融循环事件':'freeze_thaw','年覆冰小时数':'ice_hours','覆冰厚度P99':'ice_thickness',
 '年总辐照量':'solar_total','年总太阳辐照':'solar_total','累计短波辐照':'solar_total','短波辐射P99':'solar_irradiance','短波辐照度':'solar_irradiance','极端高辐照':'solar_irradiance','UV Index':'uv_index',
 '霉菌年生长小时数':'mold_hours','霉菌生长潜势小时':'mold_hours','霉菌生长气候潜势':'mold_hours','霉菌气候潜势小时':'mold_hours','飞絮/昆虫风险得分':'bio_risk_score',
 '地闪密度':'lightning_density','雷电密度':'lightning_density','长期雷电闪频密度':'lightning_density','年雷电小时数':'thunder_hours','年雷电小时':'thunder_hours','雷电次数':'lightning_count'
};
function safeParam(name){try{const v=window.params?.[name]??params?.[name];return Number.isFinite(Number(v))?Number(v):null}catch{return null}}
function legacyDescriptor(moduleName,name){
 const defs={
  '设计阵风':{unit:'m/s',dataClass:'GIS/静态环境数据',source:'管理员设计能力参数',accessStatus:'A 已接入',staticValue:safeParam('capWind'),note:'该值本身就是设备设计阵风能力，不映射为气象阵风P99。'},
  '极端风风险评分':{unit:'0-100',dataClass:'工程派生',source:'真实阵风 + 既有风险模型',accessStatus:'C 可模型计算',note:'当前卡片为综合风险结果，不伪造逐时风险序列；获得真实阵风后由风险引擎计算。'},
  '湿雪频次':{unit:'次/y',dataClass:'未接入',source:'气象数据 + 湿球温度/液态含水量模型',accessStatus:'C 可模型计算',note:'可通过物理判据/区域观测建立，当前尚无可靠全球连续时序。'},
  '沙蚀通量':{unit:'kg/m²·s',dataClass:'未接入',source:'颗粒浓度 + 粒径 + 撞击速度/角度模型',accessStatus:'C 可模型计算',note:'具备模型计算可能，但需要粒径谱与通量校准后才可工程化使用。'},
  '硅砂比例':{unit:'%',dataClass:'未接入',source:'颗粒化学成分/地质数据库/现场样品',accessStatus:'D 站点/区域可接',note:'属于区域或样品型数据，不生成全球伪时序。'},
  'H₂S P99':{unit:'μg/m³',dataClass:'未接入',source:'区域/工矿专项监测',accessStatus:'D 站点/区域可接',note:'H₂S不建议伪造成全球连续场；作为项目专项输入。'},
  '覆冰厚度P95':{unit:'mm',dataClass:'未接入',source:'液态含水量 + 温度 + 风速覆冰模型/监测',accessStatus:'C/D 模型/区域可接',note:'P95与P99统计含义不同，不能用P99替代P95。'}
 };
 const d=defs[name];if(!d)return null;const key=`legacy_${String(name).replace(/\W/g,'_')}`;return{module:moduleName,key,id:`${moduleName}::${key}`,name,summaryUnit:d.unit,unit:d.unit,dataClass:d.dataClass,source:d.source,accessStatus:d.accessStatus,staticValue:d.staticValue??null,trendAvailable:false,raw:[],series:[],coverage:null,design:null,analysis:{valid:false,count:0},rawResolution:'静态/未接入',method:'',formula:'',sourceVariable:'',note:d.note};
}
function applyLegacyView(i,name){if(!i)return i;const x={...i};if(name==='年凝露时间'){x.summaryUnit='h/y';x.method=[x.method,'卡片为年化凝露小时；趋势展示逐时0/1凝露状态，且凝露持续时间达到配置阈值后才计入。'].filter(Boolean).join('；')}if(name==='年降雨量'){x.summaryUnit='mm/y';x.method=[x.method,'卡片为年化降雨量；趋势展示底层逐日降雨量。'].filter(Boolean).join('；')}if(name==='年总辐照量'||name==='年总太阳辐照'){x.summaryUnit='kWh/m²·y';x.method=[x.method,'卡片为年化总辐照量；趋势展示底层逐时辐照能量贡献。'].filter(Boolean).join('；')}if(name==='霉菌年生长小时数'){x.summaryUnit='h/y';x.method=[x.method,'卡片为年化气候潜势小时；趋势展示逐时0/1气候适生状态，不代表实际霉菌观测。'].filter(Boolean).join('；')}if(name==='润湿时间'){x.summaryUnit='%';x.method=[x.method,'卡片为TOW时间占比；趋势展示逐时0/1润湿状态。'].filter(Boolean).join('；')}return x}
function prepareIndicatorByName(moduleName,name){const mod=A.moduleCatalog?.().find(m=>m.module===moduleName);if(!mod)return legacyDescriptor(moduleName,name);const direct=(mod.indicators||[]).find(i=>i.name===name);if(direct)return applyLegacyView(prepareIndicator(moduleName,direct.key),name);const key=aliases[name];if(key){const hit=(mod.indicators||[]).find(i=>i.key===key);if(hit)return applyLegacyView(prepareIndicator(moduleName,hit.key),name)}const legacy=legacyDescriptor(moduleName,name);if(legacy)return legacy;const norm=s=>String(s||'').replace(/[\s（）()\/·_-]/g,'').replace(/年|极端|平均/g,'');const target=norm(name),fuzzy=(mod.indicators||[]).find(i=>norm(i.name)===target||norm(i.name).includes(target)||target.includes(norm(i.name)));return fuzzy?applyLegacyView(prepareIndicator(moduleName,fuzzy.key),name):null}
A.prepareIndicator=prepareIndicator;
A.prepareModule=prepareModule;
A.prepareAll=prepareAll;
A.prepareIndicatorByName=prepareIndicatorByName;
A.uiCompat='v31.2';
A.metricAliases=aliases;
})();