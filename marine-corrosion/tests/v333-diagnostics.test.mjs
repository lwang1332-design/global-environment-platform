import test from 'node:test';
import assert from 'node:assert/strict';
import {doseResponse} from '../model-v330.js';
import {doseTerms,buildDiagnosticChain,buildBiasWaterfall,doseSensitivity,structuralGaps} from '../diagnostics-v333.js';

test('dose term decomposition closes exactly on V3.3.0 dose response',()=>{
  const cases=[['carbon_steel',5,60,80,25],['zinc',3,40,85,20],['copper',2,20,75,30],['aluminium',1,10,70,35]];
  for(const [m,pd,sd,rh,t] of cases){const x=doseTerms(m,pd,sd,rh,t),r=doseResponse(m,pd,sd,rh,t);assert.ok(Math.abs(x.total-r)<1e-12);assert.ok(Math.abs(x.closureError)<1e-12)}
});

function fixture(){return {
  project:{latitude:10.9,longitude:106.6,height:2,material:'carbon_steel',mode:'historical'},
  inputSnapshot:{modelVersion:'3.3.0',cfg:{material:'carbon_steel',height:2,chlorideFraction:.55,characteristicLength:1},overrides:{}},
  summary:{material:'carbon_steel',mode:'historical',meanTemp:28,meanRh:80,meanWaveHeight:1.5,meanSalinity:35,airSaltMean:10,saltDepMean:20,clDepMean:11,isoClDepMean:null,cumulativeCl:4,surfaceClMean:25,surfaceClMax:90,towHours:4000,wetHours:5000,condHours:800,saltWetHours:4200,longestWet:18,meanSo2Dep:5,meanSo2Conc:6,meanPhysicalSo2Dep:2,screeningFirstYearCorrosion:doseResponse('carbon_steel',5,11,80,28),isoFirstYearCorrosion:null,screeningCorrosionClass:'C3',isoCorrosionClass:'N/A',seaSaltSource:'CAMS_RH80_TO_DRY+EST_SPRAY',camsHours:8760,proxySaltHours:0},
  annual:[{year:2025,summary:{validForAnnualEstimate:true,meanSo2Dep:5,clDepMean:11,isoClDepMean:null,meanRh:80,meanTemp:28}}],
  hourly:[{valid:true,dt:1,rain:1,dryDep:8,impactionDep:12,wetDep:0,wetDepAvailable:false},{valid:true,dt:1,rain:0,dryDep:10,impactionDep:10,wetDep:0,wetDepAvailable:true}],
  quality:[{key:'so2',originalMissingPercent:0}],qualityAssessment:{inputGrade:'B'},provenance:{cams:{source:'CAMS EAC4'}}
}}

test('diagnostic chain reports wet deposition and wetness structural gaps without changing prediction',()=>{
  const r=fixture(),expected=r.summary.screeningFirstYearCorrosion,d=buildDiagnosticChain(r);assert.equal(d.basis.key,'SCREENING');assert.equal(d.corrosion.predicted,expected);assert.equal(d.wetness.coupledToDoseResponse,false);const codes=new Set(structuralGaps(d).map(x=>x.code));assert.ok(codes.has('WET_DEP_DISABLED'));assert.ok(codes.has('WETNESS_NOT_COUPLED'));
});

test('observed reference is used only for bias waterfall and never changes model prediction',()=>{
  const d=buildDiagnosticChain(fixture()),before=d.corrosion.predicted,w=buildBiasWaterfall(d,46.4);assert.equal(d.corrosion.predicted,before);assert.equal(w.predicted,before);assert.ok(Math.abs(w.steps.reduce((s,x)=>s+x.delta,0)-46.4)<1e-9);assert.ok(Math.abs(w.bias-(before-46.4))<1e-9);
});

test('dose sensitivity is diagnostic-only and contains four input families',()=>{
  const rows=doseSensitivity(fixture(),[-.2,.2]);assert.equal(rows.length,8);assert.deepEqual(new Set(rows.map(x=>x.parameter)),new Set(['Pd','Cl/Sd','RH','T']));assert.ok(rows.every(x=>x.basis==='dose_response_only'));
});
