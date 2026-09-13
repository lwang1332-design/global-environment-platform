import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_VERSION,normalizeV331Inputs,validateV331Inputs,deriveManagedOverrides,deriveManagedModelParams,
  applyManualGisOverride,screeningCorrosion,inputReadiness,stableInputHash
} from '../input-policy-v331.js';

test('V3.3.1 app version is explicit while science kernel remains separate',()=>{
  assert.equal(APP_VERSION,'3.3.1');
});

test('SO2 Pc is converted to Pd=0.8Pc and unrelated overrides are preserved',()=>{
  const input=normalizeV331Inputs({so2Mode:'pc',so2Pc:12.5});
  const out=deriveManagedOverrides(input,{waveHeight:2.1,so2Dep:1,isoChlorideDep:99});
  assert.equal(out.so2Dep,10);
  assert.equal(out.waveHeight,2.1);
  assert.equal(Object.hasOwn(out,'isoChlorideDep'),false);
});

test('direct Pd and ISO Sd are passed as explicit overrides',()=>{
  const out=deriveManagedOverrides({so2Mode:'pd',so2Pd:8.4,isoSd:27.3},{salinity:34});
  assert.equal(out.so2Dep,8.4);
  assert.equal(out.isoChlorideDep,27.3);
  assert.equal(out.salinity,34);
});

test('auto SO2 mode clears only managed Pd/Sd without inventing a fallback',()=>{
  const out=deriveManagedOverrides({so2Mode:'auto'},{so2Dep:1,isoChlorideDep:10,camsSo2:2e-9});
  assert.equal(Object.hasOwn(out,'so2Dep'),false);
  assert.equal(Object.hasOwn(out,'isoChlorideDep'),false);
  assert.equal(out.camsSo2,2e-9);
});

test('Wet parameters are absent by default and only enabled with explicit values',()=>{
  const off=deriveManagedModelParams({wetEnabled:false},{wetScavengingRatePerMm:.02,wetScavengingHeightM:500,kappa:1.1});
  assert.equal(Object.hasOwn(off,'wetScavengingRatePerMm'),false);
  assert.equal(Object.hasOwn(off,'wetScavengingHeightM'),false);
  assert.equal(off.kappa,1.1);
  const on=deriveManagedModelParams({wetEnabled:true,wetRatePerMm:.015,wetHeightM:800},{kappa:1.1});
  assert.equal(on.wetScavengingRatePerMm,.015);
  assert.equal(on.wetScavengingHeightM,800);
});

test('manual GIS override is explicitly screening-only and supplies all 5-degree bins',()=>{
  const base={distanceToCoastKm:3,elevation:10,provenance:{type:'CALC/FALLBACK',source:'Natural Earth'},bearingBins:[{bearing:0,seaDistanceKm:4,fetchKm:20}]};
  const out=applyManualGisOverride(base,{gisEnabled:true,gisDistanceToCoastKm:2.5,gisUpwindSeaDistanceKm:7,gisFetchKm:45});
  assert.equal(out.distanceToCoastKm,2.5);
  assert.equal(out.bearingBins.length,72);
  assert.ok(out.bearingBins.every(b=>b.seaDistanceKm===7&&b.fetchKm===45));
  assert.equal(out.provenance.type,'OVERRIDE/SCREENING');
  assert.match(out.provenance.note,/不可替代GSHHG/);
});

test('engineering screening rate is available with Pd + engineering Cl but remains non-formal',()=>{
  const out=screeningCorrosion({material:'carbon_steel',pd:12.63,engineeringCl:30,rh:80,t:28});
  assert.equal(out.ready,true);
  assert.ok(Math.abs(out.rate-48.49)<.1);
  assert.equal(out.corrosionClass,'C3');
  assert.match(out.warning,/不是ISO 9225/);
});

test('input readiness exposes three-level calculability without treating missing ISO Sd as failure',()=>{
  const l1=inputReadiness({so2Mode:'auto'});
  assert.equal(l1.environmentScreening,true);
  assert.equal(l1.corrosionScreeningManualReady,false);
  assert.equal(l1.formalIsoManualReady,false);
  const l2=inputReadiness({so2Mode:'pc',so2Pc:10});
  assert.equal(l2.manualPd,8);
  assert.equal(l2.corrosionScreeningManualReady,true);
  assert.equal(l2.formalIsoManualReady,false);
  const l3=inputReadiness({so2Mode:'pc',so2Pc:10,isoSd:20});
  assert.equal(l3.formalIsoManualReady,true);
});

test('validation rejects enabled advanced modes with missing required values',()=>{
  assert.equal(validateV331Inputs({so2Mode:'pc'}).valid,false);
  assert.equal(validateV331Inputs({gisEnabled:true,gisUpwindSeaDistanceKm:4}).valid,false);
  assert.equal(validateV331Inputs({wetEnabled:true,wetRatePerMm:.01}).valid,false);
  assert.equal(validateV331Inputs({so2Mode:'auto'}).valid,true);
});

test('stable input hash is deterministic',()=>{
  const a=stableInputHash({so2Mode:'pc',so2Pc:5,isoSd:3});
  const b=stableInputHash({isoSd:3,so2Pc:5,so2Mode:'pc'});
  assert.equal(a,b);
});
