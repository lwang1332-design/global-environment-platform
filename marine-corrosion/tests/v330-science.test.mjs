import test from 'node:test';
import assert from 'node:assert/strict';
import {hourAxis,number} from '../data-quality.js';
import {
  MODEL_VERSION,computeModel,camsDrySaltConcentration,camsAmbientDiameter,wetDepositionFlux,
  distanceFactor,fetchFactor,isoSo2DepFromConcentration,doseResponse
} from '../model-v330.js';

const gis={distanceToCoastKm:5,siteMedium:'land',bearingBins:[{bearing:175,seaDistanceKm:5,fetchKm:50},{bearing:185,seaDistanceKm:7,fetchKm:70}],provenance:{source:'synthetic test'}};
const mk=(times,keyValues={})=>{const d={time:times,flags:{},provenance:{source:'synthetic test'}};for(const [k,v] of Object.entries(keyValues)){d[k]=Array.isArray(v)?v:Array(times.length).fill(v);d.flags[k]=d[k].map(x=>number(x)===null?'MISSING':'RAW')}return d};
function input(year=2025,{camsChanges={},cfg={},overrides={}}={}){const t=hourAxis(year);return {weather:mk(t,{t:28,td:24,rh:80,rain:0,pressure:1013.25,cloud:50,u10:5,u100:6,wd:180,sw:100,blh:800}),ocean:mk(t,{hs:1.5,tp:7,salinity:35}),cams:mk(t,{ss1:1e-9,ss2:1e-9,ss3:1e-9,so2:2e-9,...camsChanges}),gis,cfg:{latitude:10.9,longitude:106.6,height:10,material:'carbon_steel',exposureZone:'atmospheric',mode:'historical',requestedYears:[year],...cfg},overrides}}

test('V3.3.0 CAMS sea-salt mass is converted from RH80 basis to dry salt and size is RH-normalized',()=>{
  assert.equal(MODEL_VERSION,'3.3.0');
  const rho=1.2,q=4.3e-9;
  assert.ok(Math.abs(camsDrySaltConcentration(q,rho,4.3,1)-1.2)<1e-12);
  const d80=camsAmbientDiameter(1,80,1.1),d90=camsAmbientDiameter(1,90,1.1);
  assert.ok(d80>3&&d80<3.3);
  assert.ok(d90>d80);
});

test('partial CAMS bins are preserved and only missing bins use Proxy fill',()=>{
  const r=computeModel(input(2025,{camsChanges:{ss2:null}}));
  assert.equal(r.hourly[0].camsBinCount,2);
  assert.equal(r.hourly[0].bins[0].source,'CAMS_RH80_TO_DRY');
  assert.equal(r.hourly[0].bins[1].source,'PROXY_FILL');
  assert.equal(r.hourly[0].bins[2].source,'CAMS_RH80_TO_DRY');
});

test('SO2 missing no longer silently becomes Pd=1 and blocks formal ISO result',()=>{
  const r=computeModel(input(2025,{camsChanges:{so2:null},cfg:{isoChlorideEquivalentFactor:1}}));
  assert.equal(r.hourly[0].isoSo2Dep,null);
  assert.equal(r.summary.isoFirstYearCorrosion,null);
  assert.ok(r.qualityAssessment.reasons.some(x=>x.includes('Pd=1')));
});

test('ISO SO2 equivalence uses Pd = 0.8 Pc while physical deposition is kept separately',()=>{
  assert.equal(isoSo2DepFromConcentration(10,.8),8);
  const r=computeModel(input(2025,{cfg:{isoChlorideEquivalentFactor:1}}));
  assert.ok(Number.isFinite(r.hourly[0].physicalSo2Dep));
  assert.ok(Number.isFinite(r.hourly[0].isoSo2Dep));
  assert.notEqual(r.hourly[0].physicalSo2Dep,r.hourly[0].isoSo2Dep);
});

test('engineering chloride and ISO Sd are separate; formal ISO needs verified factor or explicit override',()=>{
  const screening=computeModel(input());
  assert.ok(Number.isFinite(screening.summary.clDepMean));
  assert.equal(screening.summary.isoClDepMean,null);
  assert.equal(screening.summary.isoFirstYearCorrosion,null);
  assert.ok(Number.isFinite(screening.summary.screeningFirstYearCorrosion));
  const formal=computeModel(input(2025,{overrides:{isoChlorideDep:30}}));
  assert.equal(formal.summary.isoClDepMean,30);
  assert.ok(Number.isFinite(formal.summary.isoFirstYearCorrosion));
});

test('wet deposition is dimensionally closed and excluded until scavenging parameters are supplied',()=>{
  assert.equal(wetDepositionFlux(10,5,1,null,null),null);
  assert.ok(wetDepositionFlux(10,5,1,.01,100)>0);
  const noWet=computeModel(input());
  assert.equal(noWet.hourly[0].wetDep,0);
  const rainy=input(2025,{cfg:{wetScavengingRatePerMm:.01,wetScavengingHeightM:100}});rainy.weather.rain=rainy.weather.rain.map(()=>5);rainy.weather.flags.rain=rainy.weather.rain.map(()=> 'RAW');
  const withWet=computeModel(rainy);
  assert.ok(withWet.hourly[0].wetDep>0);
});

test('Proxy uses one continuous distance factor and one fetch factor, without 100 km discontinuity',()=>{
  assert.ok(distanceFactor(99)>distanceFactor(101));
  assert.ok(Math.abs(distanceFactor(99)-distanceFactor(101))<.02);
  assert.ok(fetchFactor(250)>fetchFactor(0));
});

test('Vietnam 10.9/106.6 point is diagnostic only: 46.4 is not used to fit or force the model',()=>{
  const observed=46.4;
  const r=computeModel(input(2025,{camsChanges:{so2:null}}));
  assert.equal(r.project.latitude,10.9);assert.equal(r.project.longitude,106.6);
  assert.equal(r.summary.experienceCalibration.applied,false);
  assert.equal(r.summary.isoFirstYearCorrosion,null);
  assert.notEqual(r.summary.screeningFirstYearCorrosion,observed);
  assert.equal(r.inputSnapshot.modelVersion,'3.3.0');
});

test('ISO dose response remains unchanged by V3.3.0 interface corrections',()=>{
  const r=doseResponse('carbon_steel',12.63,30,80,28);
  assert.ok(Math.abs(r-48.48850366462365)<1e-10);
});
