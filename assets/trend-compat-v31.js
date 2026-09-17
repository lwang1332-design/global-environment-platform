/* V3.1 trend registry/UI compatibility adapter.
 * Keeps the engineering registry authoritative while exposing a stable UI contract.
 */
(()=>{
'use strict';
const A=window.GETrendAnalysis;
if(!A||A.uiCompat==='v31.1')return;
const oldPrepareIndicator=A.prepareIndicator?.bind(A);
const statusMap={A:'A 已接入',B:'B 可直接接入',C:'C 可模型计算',D:'D 站点/区域可接',E:'E 数据受限','A/B':'A/B 已接入/可直接接入','C/D':'C/D 模型/区域可接'};
const classMap=v=>{const s=String(v||'');if(s==='未接入')return'未接入';if(s.includes('静态')||s.includes('GIS'))return'GIS/静态环境数据';if(s.includes('模型值'))return'工程模型值';if(s.includes('派生')||s.includes('统计'))return'工程派生';if(s.includes('再分析')||s.includes('模式')||s.includes('档案')||s.includes('观测'))return'真实数据';return s||'未接入'};
const status=v=>{const s=String(v||'');return statusMap[s]||s||'E 数据受限'};
function normalize(i,moduleName){if(!i)return null;const module=i.module||moduleName||'',key=i.key||i.metricKey||i.name;return{...i,module,key,id:i.id||`${module}::${key}`,summaryUnit:i.summaryUnit||i.unit,unit:i.unit||i.seriesUnit||'',series:i.series||i.raw||[],raw:i.raw||i.series||[],rawResolution:i.rawResolution||i.coverage?.resolution||i.sourceResolution||'按数据源',method:i.method||i.underlyingLabel||'',originalDataClass:i.originalDataClass||i.dataClass,dataClass:classMap(i.dataClass),accessStatus:status(i.accessStatus)}}
function prepareIndicator(moduleName,key){return normalize(oldPrepareIndicator?.(moduleName,key),moduleName)}
function prepareModule(moduleName){const mod=A.moduleCatalog?.().find(m=>m.module===moduleName);if(!mod)return null;const indicators=(mod.indicators||[]).map(i=>prepareIndicator(moduleName,i.key)).filter(Boolean),available=indicators.filter(i=>i.trendAvailable),rawDefaults=(mod.indicators||[]).filter(i=>i.defaultSelected).slice(0,3).map(i=>i.key),defaults=(rawDefaults.length?rawDefaults:available.slice(0,3).map(i=>i.key)).map(k=>`${moduleName}::${k}`);return{module:moduleName,requestedYears:A.selectedYears?.()||1,indicators,defaultSelected:defaults}}
function prepareAll(){return(A.moduleCatalog?.()||[]).map(m=>prepareModule(m.module)).filter(Boolean)}
const aliases={
 '极端最高温':'temp_max','极端最低温':'temp_min','年平均温度':'temp_mean','日温差P95':'day_range_p95','温变速率P95':'temp_rate_p95','暴晒最高地表温度':'surface_temp_p99',
 '年平均相对湿度':'rh_mean','高湿时间比例':'rh90_ratio','平均绝对湿度':'ah_mean','最大绝对湿度':'ah_max','年凝露时间':'cond_hours',
 '最大单日降雨':'rain_daily_max','最大日降雨':'rain_daily_max','小时降雨P99':'rain_hour_p99','年累计降雨':'rain_total','累计降雨':'rain_total','风驱雨联合指数':'wdr','风驱雨指数':'wdr',
 'PM10平均':'pm10_mean','PM10 P95':'pm10_p95','PM2.5 P95':'pm25','Dust P95':'dust','年进入质量':'dust_mass_year','等效年化进入颗粒质量':'dust_mass_year',
 '平均风速':'wind_mean','10 m风速':'wind_mean','设计阵风':'gust_p99','阵风P99':'gust_p99','最大阵风':'gust_max','极端风风险评分':'gust_p99',
 'Cl⁻沉积速率':'cl_dep_rate','润湿时间':'tow','TOW':'tow','海盐浓度P95':'seasalt_p95','海盐浓度P99':'seasalt_p99','干盐沉降速率':'dry_dep_rate','总盐干沉积速率':'dry_dep_rate',
 '项目海拔':'altitude','海拔高度':'altitude','平均气压':'pressure_mean','表面气压':'pressure_mean','空气密度':'air_density','海拔设计裕量':'altitude_margin','设计海拔裕量':'altitude_margin',
 'SO₂ P95':'so2_p95','SO₂ P99':'so2_p99','NO₂ P95':'no2_p95','O₃ P95':'ozone_p95',
 '最大日降雪':'snow_daily_max','累计降雪':'snow_total','冻融循环':'freeze_thaw','冻融循环事件':'freeze_thaw',
 '年总太阳辐照':'solar_total','累计短波辐照':'solar_total','短波辐射P99':'solar_irradiance','短波辐照度':'solar_irradiance','极端高辐照':'solar_irradiance','UV Index':'uv_index',
 '霉菌年生长小时数':'mold_hours','霉菌生长潜势小时':'mold_hours','霉菌生长气候潜势':'mold_hours','霉菌气候潜势小时':'mold_hours',
 '雷电密度':'lightning_density','长期雷电闪频密度':'lightning_density','年雷电小时数':'thunder_hours','年雷电小时':'thunder_hours','雷电次数':'lightning_count'
};
function prepareIndicatorByName(moduleName,name){const mod=A.moduleCatalog?.().find(m=>m.module===moduleName);if(!mod)return null;const direct=(mod.indicators||[]).find(i=>i.name===name);if(direct)return prepareIndicator(moduleName,direct.key);const key=aliases[name];if(key){const hit=(mod.indicators||[]).find(i=>i.key===key);if(hit)return prepareIndicator(moduleName,hit.key)}const norm=s=>String(s||'').replace(/[\s（）()\/·_-]/g,'').replace(/年|极端|平均/g,'');const target=norm(name),fuzzy=(mod.indicators||[]).find(i=>norm(i.name)===target||norm(i.name).includes(target)||target.includes(norm(i.name)));return fuzzy?prepareIndicator(moduleName,fuzzy.key):null}
A.prepareIndicator=prepareIndicator;
A.prepareModule=prepareModule;
A.prepareAll=prepareAll;
A.prepareIndicatorByName=prepareIndicatorByName;
A.uiCompat='v31.1';
A.metricAliases=aliases;
})();