/* V3.1 trend registry/UI compatibility adapter.
 * Keeps the richer engineering registry while exposing a stable UI contract.
 */
(()=>{
'use strict';
const A=window.GETrendAnalysis;
if(!A||A.uiCompat==='v31')return;
const oldPrepareIndicator=A.prepareIndicator?.bind(A);
const statusMap={A:'A 已接入',B:'B 可直接接入',C:'C 可模型计算',D:'D 站点/区域可接',E:'E 数据受限'};
const classMap=v=>{
 const s=String(v||'');
 if(s==='未接入')return'未接入';
 if(s.includes('静态')||s.includes('GIS'))return'GIS/静态环境数据';
 if(s.includes('模型值'))return'工程模型值';
 if(s.includes('派生'))return'工程派生';
 if(s.includes('再分析')||s.includes('模式')||s.includes('档案')||s.includes('观测'))return'真实数据';
 return s||'未接入';
};
const status=v=>{const s=String(v||'');return statusMap[s]||s||'E 数据受限'};
function normalize(i,moduleName){
 if(!i)return null;
 const module=i.module||moduleName||'',key=i.key||i.metricKey||i.name;
 return {...i,module,key,id:i.id||`${module}::${key}`,summaryUnit:i.summaryUnit||i.unit,unit:i.unit||i.seriesUnit||'',series:i.series||i.raw||[],raw:i.raw||i.series||[],rawResolution:i.rawResolution||i.coverage?.resolution||i.sourceResolution||'',dataClass:classMap(i.dataClass),accessStatus:i.trendAvailable?statusMap.A:status(i.accessStatus)};
}
function prepareIndicator(moduleName,key){return normalize(oldPrepareIndicator?.(moduleName,key),moduleName)}
function prepareModule(moduleName){
 const mod=A.moduleCatalog?.().find(m=>m.module===moduleName);if(!mod)return null;
 const indicators=(mod.indicators||[]).map(i=>prepareIndicator(moduleName,i.key)).filter(Boolean),available=indicators.filter(i=>i.trendAvailable),rawDefaults=(mod.indicators||[]).filter(i=>i.defaultSelected).slice(0,3).map(i=>i.key),defaults=(rawDefaults.length?rawDefaults:available.slice(0,3).map(i=>i.key)).map(k=>`${moduleName}::${k}`);
 return{module:moduleName,requestedYears:A.selectedYears?.()||1,indicators,defaultSelected:defaults};
}
function prepareAll(){return(A.moduleCatalog?.()||[]).map(m=>prepareModule(m.module)).filter(Boolean)}
const aliases={
 '高湿时间比例':'RH>90%比例',
 '年进入质量':'等效年化进入颗粒质量',
 '平均风速':'10 m风速',
 '设计阵风':'阵风P99',
 '暴晒最高地表温度':'暴晒最高地表温度P99',
 '霉菌年生长小时数':'霉菌生长气候潜势小时',
 '年雷电小时数':'年雷电小时'
};
function prepareIndicatorByName(moduleName,name){
 const mod=A.moduleCatalog?.().find(m=>m.module===moduleName);if(!mod)return null;
 const target=aliases[name]||name,ind=(mod.indicators||[]).find(i=>i.name===name||i.name===target);
 return ind?prepareIndicator(moduleName,ind.key):null;
}
A.prepareIndicator=prepareIndicator;
A.prepareModule=prepareModule;
A.prepareAll=prepareAll;
A.prepareIndicatorByName=prepareIndicatorByName;
A.uiCompat='v31';
A.metricAliases=aliases;
})();
