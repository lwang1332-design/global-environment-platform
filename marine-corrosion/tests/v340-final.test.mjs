import test from 'node:test';
import assert from 'node:assert/strict';
import {virtualWetCandleSd,establishIsoSd,wetCandleMonthlyAverage,camsFluxEquivalentSd} from '../iso-sd-v340.js';
import {evaluateSurfaceWetness} from '../surface-wetness-v340.js';
import {assessCoastalCorrosion} from '../coastal-corrosion-v340.js';

const fluxKeys=['ssDry1','ssDry2','ssDry3','ssSed1','ssSed2','ssSed3','ssWetConv1','ssWetConv2','ssWetConv3','ssWetLs1','ssWetLs2','ssWetLs3'];
function fixture(){
  const hourly=[];
  for(let i=0;i<48;i++){
    const night=i%24<7||i%24>18;
    hourly.push({time:new Date(Date.UTC(2025,0,1,i)).toISOString(),dt:1,valid:true,t:night?24:29,td:23,rh:night?92:68,rain:i===10?2:0,cloud:night?20:55,sw:night?0:550,u10:5,u100:7,wind:5.8,upwindSeaDist:3,ss1:3,ss2:8,ss3:12,spray20:18,clDep:45,surfaceCl:120+i*.5,camsBinCount:3,wetDepAvailable:false});
  }
  const cams={time:hourly.map(r=>r.time),autoSeaSaltFlux:{source:'CAMS archived operational sea-salt deposition flux',productType:'ARCHIVED_FORECAST_FLUX'}};
  fluxKeys.forEach((k,j)=>{cams[k]=Array(48).fill((j<6?1.0:0.5)*1e-11)});
  return {project:{latitude:18.3,longitude:109.26,height:5,material:'carbon_steel',mode:'historical'},hourly,summary:{material:'carbon_steel',exposureZone:'atmospheric',mode:'historical',meanSo2Dep:2,meanRh:80,meanTemp:26,proxySaltHours:0,camsHours:48,wetHours:30},qualityAssessment:{inputGrade:'B'},inputSnapshot:{cfg:{material:'carbon_steel',height:5,chlorideFraction:.55,kappa:1.1,camsRadiusRatio80ToDry:2,camsDryMassFactor:4.3,localSprayScale35Km:12,localSprayScale75Km:6,washEfficiency:.65},overrides:{}},inputData:{cams}};
}

test('CAMS flux equivalent Sd is finite and traceable',()=>{const r=camsFluxEquivalentSd(fixture());assert.equal(r.ready,true);assert.ok(r.sd>0);assert.equal(r.coveragePercent,100);assert.ok(r.dryCl>0);assert.ok(r.sedimentationCl>0);assert.ok(r.wetCl>0)});
test('virtual wet candle produces finite model-equivalent Sd without corrosion observations',()=>{const r=virtualWetCandleSd(fixture());assert.equal(r.ready,true);assert.ok(r.sd>0);assert.equal(r.formalIso,false);assert.match(r.method,/MODEL_WET_CANDLE/);assert.equal(r.camsFluxCoveragePercent,100);assert.ok(Number.isFinite(r.collectorModelSd));assert.ok(Number.isFinite(r.camsBulkFluxSd));assert.equal(r.sd,Math.max(r.collectorModelSd,r.camsBulkFluxSd))});
test('wet-candle direct value becomes formal only when method explicitly declares it',()=>{const x=fixture();x.inputSnapshot.overrides.isoChlorideDep=75;const a=establishIsoSd(x,{method:'auto_model'}),b=establishIsoSd(x,{method:'wet_candle_direct'});assert.equal(a.formalIso,false);assert.equal(b.formalIso,true);assert.equal(b.sd,75)});
test('surface model recomputes salt inventory with CAMS flux envelope',()=>{const w=evaluateSurfaceWetness(fixture(),{thicknessMm:3,drh:75,erh:45});assert.equal(w.ready,true);assert.ok(Number.isFinite(w.meanSurfaceRh));assert.ok(w.wetHours>0);assert.ok(w.brineHours>0);assert.equal(w.camsFluxCoveragePercent,100);assert.ok(w.meanEffectiveClDep>=w.meanDirectFluxClDep);assert.ok(w.meanSurfaceCl>=0)});
test('coastal assessment uses conservative envelope and cannot downgrade engineering baseline',()=>{const a=assessCoastalCorrosion(fixture(),{sd:{method:'auto_model'}});assert.equal(a.recommended.formalIso,false);assert.match(a.recommended.corrosionClass,/^C[1-5X]$/);assert.ok(a.recommended.rate>0);assert.equal(a.basis,'COASTAL_ENGINEERING_CONSERVATIVE_ENVELOPE');assert.ok(a.recommended.rate>=a.engineering.rate);assert.equal(a.surfaceEnhanced.rate,Math.max(a.engineering.rate,a.surfaceEnhanced.rawRate));if(a.surfaceEnhanced.rawRate<a.engineering.rate)assert.equal(a.surfaceEnhanced.downgradeBlocked,true)});
test('coastal assessment returns Formal ISO only for traceable direct/converted Sd',()=>{const x=fixture();x.inputSnapshot.overrides.isoChlorideDep=60;const a=assessCoastalCorrosion(x,{sd:{method:'wet_candle_direct',source:'station A'}});assert.equal(a.recommended.formalIso,true);assert.equal(a.sd.traceability,'A');assert.ok(a.formal.rate>0)});
test('monthly wet candle average is day weighted',()=>{assert.ok(Math.abs(wetCandleMonthlyAverage([{sd:10,days:10},{sd:20,days:20}])-50/3)<1e-12)});
