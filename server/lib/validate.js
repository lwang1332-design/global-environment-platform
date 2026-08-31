'use strict';

const SCHEMA_VERSION = '2.9';
const DEFAULT_KEYS = [
  'delta','rho','cp','eps','alpha','sky','dewMargin','Q','D','rpm','impactEta','filterEta','ne','eiMass','eiVel',
  'capHigh','capLow','capDew','capCondHours','capCl','capPm','capEi','capHeatLoss','hiA','hiB','loA','loB','windA','windB',
  'w1','w2','w3','wavg','protect','marineKm','coastalKm','camsDays','saltVd','saltClFrac','towRh','towTmin','towTmax',
  'saltWSea','saltWTow','saltWSo2','filterBypass','opHours','particleD50','particleRho','impactAngle','materialK',
  'condDtMin','condFilmMargin','condMassK','gustFactor','rainA','rainB','snowA','snowB','altA','altB','capRh',
  'capDayRange','capTempRate','capRainDay','capRainHour','capWind','capSnow','capAltitude','capSo2','capNo2','capTow'
];
function isFiniteNumber(v){return typeof v==='number'&&Number.isFinite(v)}
function between(v,a,b){return isFiniteNumber(v)&&v>=a&&v<=b}
function positive(v){return isFiniteNumber(v)&&v>0}
function nonNegative(v){return isFiniteNumber(v)&&v>=0}
function validateParameters(parameters){
  const errors={};
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))return{ok:false,errors:{_root:'parameters 必须为 JSON 对象'}};
  for(const key of DEFAULT_KEYS)if(!isFiniteNumber(parameters[key]))errors[key]='必须为有限数值';
  const p=parameters,set=(k,msg,cond)=>{if(!errors[k]&&!cond)errors[k]=msg};
  set('delta','金属厚度必须 > 0 mm',positive(p.delta));set('rho','密度必须 > 0',positive(p.rho));set('cp','比热必须 > 0',positive(p.cp));
  set('eps','发射率范围 0 < ε ≤ 1',p.eps>0&&p.eps<=1);set('alpha','太阳吸收率范围 0 ≤ α ≤ 1',between(p.alpha,0,1));set('sky','天空温差必须 ≥ 0',nonNegative(p.sky));set('dewMargin','露点安全裕量必须 ≥ 0',nonNegative(p.dewMargin));
  set('Q','通风量必须 > 0',positive(p.Q));set('D','风机直径必须 > 0',positive(p.D));set('rpm','转速必须 ≥ 0',nonNegative(p.rpm));set('impactEta','撞击效率范围 0～1',between(p.impactEta,0,1));set('filterEta','过滤效率范围 0～1',between(p.filterEta,0,1));set('filterBypass','旁通率范围 0～1',between(p.filterBypass,0,1));set('ne','速度指数必须 > 0',positive(p.ne));set('eiMass','EI基准质量必须 > 0',positive(p.eiMass));set('eiVel','EI基准速度必须 > 0',positive(p.eiVel));set('particleD50','颗粒D50必须 > 0',positive(p.particleD50));set('particleRho','颗粒密度必须 > 0',positive(p.particleRho));set('impactAngle','撞击角范围 0～90°',between(p.impactAngle,0,90));set('materialK','材料修正系数必须 > 0',positive(p.materialK));set('opHours','年运行小时范围 0～8784 h',between(p.opHours,0,8784));
  set('saltVd','盐沉积速度必须 ≥ 0',nonNegative(p.saltVd));set('saltClFrac','Cl⁻质量分数范围 0～1',between(p.saltClFrac,0,1));set('towRh','TOW湿度阈值范围 0～100%',between(p.towRh,0,100));set('towTmin','TOW最低温度必须小于最高温度',isFiniteNumber(p.towTmin)&&isFiniteNumber(p.towTmax)&&p.towTmin<p.towTmax);set('saltWSea','盐雾权重范围 0～1',between(p.saltWSea,0,1));set('saltWTow','TOW权重范围 0～1',between(p.saltWTow,0,1));set('saltWSo2','SO₂权重范围 0～1',between(p.saltWSo2,0,1));
  if(isFiniteNumber(p.saltWSea)&&isFiniteNumber(p.saltWTow)&&isFiniteNumber(p.saltWSo2)&&p.saltWSea+p.saltWTow+p.saltWSo2<=0)errors.saltWSea='盐雾/TOW/SO₂权重之和必须 > 0';
  set('condDtMin','模型时间步长必须满足 0 < Δt ≤ 60 min',p.condDtMin>0&&p.condDtMin<=60);set('condMassK','凝露质量修正系数必须 > 0',positive(p.condMassK));set('gustFactor','阵风估算系数必须 > 0',positive(p.gustFactor));
  set('capLow','最低设计温度必须小于最高设计温度',isFiniteNumber(p.capLow)&&isFiniteNumber(p.capHigh)&&p.capLow<p.capHigh);set('capRh','最大RH范围 0～100%',between(p.capRh,0,100));set('capTow','TOW允许占比范围 0～100%',between(p.capTow,0,100));
  ['capCondHours','capCl','capPm','capEi','capHeatLoss','capDayRange','capTempRate','capRainDay','capRainHour','capWind','capSnow','capAltitude','capSo2','capNo2','marineKm','coastalKm','camsDays'].forEach(k=>set(k,'必须 ≥ 0',nonNegative(p[k])));
  [['hiA','hiB','高温评分起点必须小于满分值'],['loA','loB','低温评分起点必须小于满分值'],['windA','windB','风速评分起点必须小于满分值'],['rainA','rainB','降雨评分起点必须小于满分值'],['snowA','snowB','降雪评分起点必须小于满分值'],['altA','altB','高海拔评分起点必须小于满分值']].forEach(([a,b,msg])=>{if(isFiniteNumber(p[a])&&isFiniteNumber(p[b])&&!(p[a]<p[b]))errors[a]=msg});
  ['w1','w2','w3','wavg'].forEach(k=>set(k,'风险权重范围 0～1',between(p[k],0,1)));set('protect','防护系数必须 > 0',positive(p.protect));
  return{ok:Object.keys(errors).length===0,errors};
}
function normalizeConfigBody(body){const parameters=body&&body.parameters,description=String(body?.description||'').trim().slice(0,500),updatedBy=String(body?.updatedBy||'admin').trim().slice(0,80)||'admin',schemaVersion=String(body?.schemaVersion||SCHEMA_VERSION);return{parameters,description,updatedBy,schemaVersion}}
module.exports={SCHEMA_VERSION,DEFAULT_KEYS,validateParameters,normalizeConfigBody};
