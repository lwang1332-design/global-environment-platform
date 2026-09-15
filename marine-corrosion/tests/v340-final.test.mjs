import test from 'node:test';
import assert from 'node:assert/strict';
import {virtualWetCandleSd,establishIsoSd,wetCandleMonthlyAverage} from '../iso-sd-v340.js';
import {evaluateSurfaceWetness} from '../surface-wetness-v340.js';
import {assessCoastalCorrosion} from '../coastal-corrosion-v340.js';

function fixture(){
  const hourly=[];
  for(let i=0;i<48;i++){
    const night=i%24<7||i%24>18;
    hourly.push({time:new Date(Date.UTC(2025,0,1,i)).toISOString(),dt:1,valid:true,t:night?24:29,td:23,rh:night?92:68,rain:i===10?2:0,cloud:night?20:55,sw:night?0:550,u10:5,u100:7,wind:5.8,upwindSeaDist:3,ss1:3,ss2:8,ss3:12,spray20:18,surfaceCl:120+i*.5,camsBinCount:3,wetDepAvailable:false});
  }
  return {project:{latitude:18.3,longitude:109.26,height:5,material:'carbon_steel'},hourly,summary:{material:'carbon_steel',exposureZone:'atmospheric',meanSo2Dep:2,meanRh:80,meanTemp:26,proxySaltHours:0,camsHours:48,wetHours:30},qualityAssessment:{inputGrade:'B'},inputSnapshot:{cfg:{material:'carbon_steel',height:5,chlorideFraction:.55,kappa:1.1,camsRadiusRatio80ToDry:2,localSprayScale35Km:12,localSprayScale75Km:6},overrides:{}}};
}

test('virtual wet candle produces finite model-equivalent Sd without corrosion observations',()=>{const r=virtualWetCandleSd(fixture());assert.equal(r.ready,true);assert.ok(r.sd>0);assert.equal(r.formalIso,false);assert.equal(r.method,'MODEL_WET_CANDLE')});
test('wet-candle direct value becomes formal only when method explicitly declares it',()=>{const x=fixture();x.inputSnapshot.overrides.isoChlorideDep=75;const a=establishIsoSd(x,{method:'auto_model'}),b=establishIsoSd(x,{method:'wet_candle_direct'});assert.equal(a.formalIso,false);assert.equal(b.formalIso,true);assert.equal(b.sd,75)});
test('surface model computes surface RH and electrolyte hours',()=>{const w=evaluateSurfaceWetness(fixture(),{thicknessMm:3,drh:75,erh:45});assert.equal(w.ready,true);assert.ok(Number.isFinite(w.meanSurfaceRh));assert.ok(w.wetHours>0);assert.ok(w.brineHours>0)});
test('coastal assessment returns engineering class without formal Sd',()=>{const a=assessCoastalCorrosion(fixture(),{sd:{method:'auto_model'}});assert.equal(a.recommended.formalIso,false);assert.match(a.recommended.corrosionClass,/^C[1-5X]$/);assert.ok(a.recommended.rate>0);assert.equal(a.basis,'COASTAL_ENGINEERING_SURFACE_ENHANCED')});
test('coastal assessment returns Formal ISO only for traceable direct/converted Sd',()=>{const x=fixture();x.inputSnapshot.overrides.isoChlorideDep=60;const a=assessCoastalCorrosion(x,{sd:{method:'wet_candle_direct',source:'station A'}});assert.equal(a.recommended.formalIso,true);assert.equal(a.sd.traceability,'A');assert.ok(a.formal.rate>0)});
test('monthly wet candle average is day weighted',()=>{assert.ok(Math.abs(wetCandleMonthlyAverage([{sd:10,days:10},{sd:20,days:20}])-50/3)<1e-12)});
