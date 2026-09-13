import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION,SCIENCE_MODEL_VERSION,SO2_AUTO_POLICY} from '../input-policy-v332.js';
import {fetchCamsSo2Auto,mergeAutoSo2} from '../sources-v332.js';

const originalFetch=globalThis.fetch;
test.after(()=>{globalThis.fetch=originalFetch});

function mockJson(body){
  globalThis.fetch=async()=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
}

test('V3.3.2 changes data/app layer while science kernel remains V3.3.0',()=>{
  assert.equal(APP_VERSION,'3.3.2');
  assert.equal(SCIENCE_MODEL_VERSION,'3.3.0');
  assert.equal(SO2_AUTO_POLICY.historical.dataset,'cams-global-reanalysis-eac4-monthly');
  assert.equal(SO2_AUTO_POLICY.current.modelLevel,'137');
});

test('historical CAMS EAC4 monthly SO2 expands to each UTC hour of the same month',async()=>{
  mockJson({configured:true,dataset:'cams-global-reanalysis-eac4-monthly',source:'CAMS EAC4 monthly reanalysis',modelLevel:'60',resolution:'0.75° monthly mean',retrievedAt:'2026-09-13T00:00:00Z',time:['2025-01-15T12:00:00Z','2025-02-15T12:00:00Z'],so2:[1e-9,2e-9],units:{upstream:'kg kg**-1'},grid:{latitude:10.5,longitude:106.5}});
  const baseTimes=['2025-01-01T00:00:00Z','2025-01-31T23:00:00Z','2025-02-01T00:00:00Z','2025-02-28T23:00:00Z'];
  const out=await fetchCamsSo2Auto({lat:10.5,lon:106.6,mode:'historical',year:2025,baseTimes,url:'https://example.test/api/so2'});
  assert.deepEqual(out.so2,[1e-9,1e-9,2e-9,2e-9]);
  assert.ok(out.flags.so2.every(x=>x==='DATA'));
  assert.match(out.provenance.source,/EAC4/);
});

test('current CAMS forecast 3-hour SO2 is boundedly aligned to hourly platform axis',async()=>{
  mockJson({configured:true,dataset:'cams-global-atmospheric-composition-forecasts',source:'CAMS Global atmospheric composition forecast',modelLevel:'137',resolution:'~0.4° / 3 h / 5 d',cycle:'2026-09-13T00:00:00Z',retrievedAt:'2026-09-13T01:00:00Z',time:['2026-09-13T00:00:00Z','2026-09-13T03:00:00Z'],so2:[1e-9,4e-9],units:{upstream:'kg kg**-1'},grid:{latitude:10.4,longitude:106.4}});
  const baseTimes=['2026-09-13T00:00:00Z','2026-09-13T01:00:00Z','2026-09-13T02:00:00Z','2026-09-13T03:00:00Z'];
  const out=await fetchCamsSo2Auto({lat:10.5,lon:106.6,mode:'current',baseTimes,url:'https://example.test/api/so2'});
  assert.equal(out.so2.length,4);
  assert.ok(Math.abs(out.so2[0]-1e-9)<1e-15);
  assert.ok(Math.abs(out.so2[1]-2e-9)<1e-15);
  assert.ok(Math.abs(out.so2[2]-3e-9)<1e-15);
  assert.ok(Math.abs(out.so2[3]-4e-9)<1e-15);
  assert.match(out.provenance.source,/Forecast/);
});

test('SO2 Auto merge replaces only SO2 and preserves CAMS sea-salt bins',()=>{
  const cams={time:['2025-01-01T00:00:00Z'],ss1:[1],ss2:[2],ss3:[3],so2:[9],flags:{ss1:['DATA'],ss2:['DATA'],ss3:['DATA'],so2:['DATA']},fieldMeta:{},provenance:{type:'DIRECT',source:'CAMS Direct'}};
  const so2={time:[...cams.time],so2:[5e-9],flags:{so2:['DATA']},fieldMeta:{so2:{unit:'kg/kg'}},provenance:{type:'DATA/REANALYSIS',source:'CAMS EAC4 monthly reanalysis',dataset:'eac4',modelLevel:'60'}};
  const out=mergeAutoSo2(cams,so2);
  assert.deepEqual(out.ss1,[1]);assert.deepEqual(out.ss2,[2]);assert.deepEqual(out.ss3,[3]);
  assert.deepEqual(out.so2,[5e-9]);
  assert.match(out.provenance.source,/CAMS Direct/);
  assert.match(out.provenance.source,/EAC4/);
});

test('SO2 Auto rejects an unconfigured backend instead of inventing Pd',async()=>{
  mockJson({configured:false,error:{code:'NOT_CONFIGURED',message:'CAMS_ADS_API_KEY is not configured'}});
  await assert.rejects(()=>fetchCamsSo2Auto({lat:10,lon:106,mode:'historical',year:2025,baseTimes:['2025-01-01T00:00:00Z'],url:'https://example.test/api/so2'}),/not configured|未配置/i);
});
