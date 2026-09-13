import test from 'node:test';
import assert from 'node:assert/strict';
import {number,alignSeries,hourAxis,HOUR} from '../data-quality.js';
import {computeModel,pct,doseResponse,MODEL_VERSION,validateParameters} from '../model-v330.js';
import {convertUnit,normalizeDirectCams,normalizeDirectWeather} from '../sources-v330.js';
import {traceData} from '../review-ui-v330.js';

const weather=(time,changes={})=>{const data={time,flags:{},provenance:{source:'synthetic V3.3 core test',type:'TEST'},fieldMeta:{}};for(const [key,value] of Object.entries({t:25,td:20,rh:85,rain:0,u10:5,u100:6,wd:180,pressure:1013.25,cloud:50,sw:100,blh:800,...changes})){data[key]=Array.isArray(value)?value:Array(time.length).fill(value);data.flags[key]=data[key].map(v=>number(v)===null?'MISSING':'RAW')}return data};
const ocean=(time,changes={})=>{const data={time,flags:{},provenance:{source:'synthetic ocean',type:'TEST'},fieldMeta:{}};for(const [key,value] of Object.entries({hs:1.5,tp:7,salinity:35,...changes})){data[key]=Array.isArray(value)?value:Array(time.length).fill(value);data.flags[key]=data[key].map(v=>number(v)===null?'MISSING':'RAW')}return data};
const cams=(time,changes={})=>{const data={time,flags:{},provenance:{source:'synthetic CAMS RH80',type:'TEST'},fieldMeta:{}};for(const [key,value] of Object.entries({ss1:1e-9,ss2:2e-9,ss3:3e-9,so2:2e-9,...changes})){data[key]=Array.isArray(value)?value:Array(time.length).fill(value);data.flags[key]=data[key].map(v=>number(v)===null?'MISSING':'RAW')}return data};
const gis={distanceToCoastKm:1,siteMedium:'land',bearingBins:[{bearing:175,seaDistanceKm:1,fetchKm:90},{bearing:185,seaDistanceKm:2,fetchKm:110}],provenance:{source:'synthetic GIS',confidence:'A'}};
const input=(time,cfg={},changes={},overrides={})=>({weather:weather(time,changes),ocean:ocean(time),cams:cams(time),gis,cfg:{latitude:20,longitude:110,height:10,material:'carbon_steel',mode:'current',exposureZone:'atmospheric',...cfg},overrides});

test('V3.3 core keeps missing and valid zero distinct',()=>{
  for(const value of [null,undefined,'',' ',NaN,Infinity,{},[],false])assert.equal(number(value),null);
  assert.equal(number(0),0);assert.equal(number('0'),0);
  assert.equal(doseResponse('carbon_steel',null,3,85,25),null);
  assert.equal(MODEL_VERSION,'3.3.0');
});

test('time alignment still sorts/deduplicates, bounds gaps, handles circular wind and never interpolates rain',()=>{
  const time=hourAxis(2024).slice(0,7),a=alignSeries(time,{time:[time[3],time[1],time[1]],hs:[4,0,99],wd:[10,350,270],rain:[2,0,9]},['hs','wd','rain'],{circularFields:['wd'],accumulatedFields:['rain']});
  assert.deepEqual(a.hs,[null,0,2,4,null,null,null]);assert.equal(a.wd[2],0);assert.equal(a.rain[2],null);assert.equal(a.audit.duplicates,1);
});

test('unit normalization remains strict and unknown units reject',()=>{
  assert.ok(Math.abs(convertUnit(298.15,'K','°C')-25)<1e-9);assert.equal(convertUnit(101325,'Pa','hPa'),1013.25);assert.equal(convertUnit(36,'km/h','m/s'),10);assert.throws(()=>convertUnit(1,'ppm','kg/kg'),/单位/);
});

test('Direct CAMS alignment preserves partial bins instead of extending values',()=>{
  const t=hourAxis(2024).slice(0,3),c=normalizeDirectCams({time:t.slice(0,1),ss1:[0],ss2:[1e-9],ss3:[null],so2:[2e-9],units:{ss1:'kg/kg',ss2:'kg/kg',ss3:'kg/kg',so2:'kg/kg'}},t);
  assert.deepEqual(c.ss1,[0,null,null]);assert.equal(c.ss3[0],null);assert.equal(c.provenance.seaSaltMassBasis,'RH80');
  assert.equal(normalizeDirectWeather({time:t,rain:[null,0,1]}).rain[0],null);
});

test('Current reports real duration and never emits annual ISO corrosion',()=>{
  const t=hourAxis(2024).slice(0,4),r=computeModel(input(t,{}, {},{isoChlorideDep:30,so2Dep:12.63}));
  assert.equal(r.summary.hours,4);assert.equal(r.summary.firstYearCorrosion,null);assert.equal(r.summary.annualCl,null);
});

test('1/3/5-year historical statistics remain full-series and formal ISO is gated by standard-equivalent inputs',()=>{
  for(const n of [1,3,5]){
    const years=Array.from({length:n},(_,i)=>2025-n+i),time=years.flatMap(hourAxis);
    const r=computeModel(input(time,{mode:'historical',requestedYears:years},{u10:time.map((_,i)=>i%137===0?45:5)},{isoChlorideDep:30,so2Dep:12.63}));
    const expected=years.reduce((s,y)=>s+hourAxis(y).length,0);
    assert.equal(r.summary.hours,expected);assert.equal(r.summary.expectedHours,expected);assert.equal(r.summary.airSaltP99,pct(r.hourly.map(x=>x.airSalt),.99));assert.equal(r.annual.length,n);assert.ok(r.summary.firstYearCorrosion>0);assert.equal(r.summary.isoClDepMean,30);assert.equal(r.summary.meanSo2Dep,12.63);
  }
  const missingIso=computeModel(input(hourAxis(2025),{mode:'historical',requestedYears:[2025]}));
  assert.equal(missingIso.summary.firstYearCorrosion,null);assert.ok(Number.isFinite(missingIso.summary.screeningFirstYearCorrosion));
});

test('partial requested multi-year cycle never becomes a complete annual estimate',()=>{
  const r=computeModel(input(hourAxis(2024),{mode:'historical',requestedYears:[2023,2024,2025]}, {},{isoChlorideDep:30,so2Dep:12.63}));
  assert.equal(r.summary.firstYearCorrosion,null);assert.equal(r.summary.annualCl,null);assert.ok(r.summary.coveragePercent<34);
});

test('V3.3 trace exposes new scientific interfaces and contains no legacy Pd=1 or old wet formula',()=>{
  const r=computeModel(input(hourAxis(2025).slice(0,3),{}, {},{isoChlorideDep:30,so2Dep:12.63}));
  const so2=traceData(r,'so2').parts.map(x=>x.join(' ')).join(' '),cl=traceData(r,'clDep').parts.map(x=>x.join(' ')).join(' '),air=traceData(r,'airSalt').parts.map(x=>x.join(' ')).join(' ');
  assert.match(so2,/0\.8|ISO 9223接口/);assert.doesNotMatch(so2,/缺测使用1 mg/);
  assert.match(cl,/工程Cl|ISO Sd|Wet V3\.3/);assert.doesNotMatch(cl,/0\.022/);
  assert.match(air,/RH80/);assert.match(air,/Fetch仅作用一次/);
});

test('V3.3 parameter validation covers new science parameters',()=>{
  assert.doesNotThrow(()=>validateParameters({height:10,isoSo2ConcentrationFactor:.8,localSprayScale35Km:12,localSprayScale75Km:6},{}));
  assert.throws(()=>validateParameters({height:10,proxyDistanceFloor:.9},{}),/参数超出范围/);
  assert.doesNotThrow(()=>validateParameters({height:10},{isoChlorideDep:30}));
});
