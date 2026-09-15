import {doseResponse,corrosionClass,chlorideClass} from './model-v330.js';
import {establishIsoSd,normalizeSdSettings} from './iso-sd-v340.js';
import {evaluateSurfaceWetness} from './surface-wetness-v340.js';

export const COASTAL_ASSESSMENT_VERSION='3.4.0';
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const rank={C1:1,C2:2,C3:3,C4:4,C5:5,CX:6,'N/A':0};
export function worseClass(a,b){return (rank[b]||0)>(rank[a]||0)?b:a}
function confidence(result,sd){const q=String(result?.qualityAssessment?.inputGrade||'C').toUpperCase(),proxy=finite(result?.summary?.proxySaltHours)??0,cams=finite(result?.summary?.camsHours)??0,total=proxy+cams;if(sd.formalIso)return sd.confidence||'B';if(total>0&&cams/total>.9&&['A','B','C'].includes(q))return 'C';return 'D'}
export function assessCoastalCorrosion(result,settings={}){
  const s=result?.summary||{},material=s.material||result?.project?.material||'carbon_steel',zone=s.exposureZone||result?.project?.exposureZone||'atmospheric';
  const sdSettings=normalizeSdSettings(settings.sd||{}),sd=establishIsoSd(result,sdSettings),wet=evaluateSurfaceWetness(result,settings.surface||{}),pd=finite(s.meanSo2Dep),rh=finite(s.meanRh),t=finite(s.meanTemp);
  const validBase=zone==='atmospheric'&&[pd,rh,t,sd.sd].every(Number.isFinite),engineeringRate=validBase?doseResponse(material,pd,sd.sd,rh,t):null,engineeringClass=corrosionClass(material,engineeringRate);
  const surfaceRate=validBase&&Number.isFinite(wet.meanSurfaceRh)&&Number.isFinite(wet.meanSurfaceTemp)?doseResponse(material,pd,sd.sd,wet.meanSurfaceRh,wet.meanSurfaceTemp):null,surfaceClass=corrosionClass(material,surfaceRate);
  const manualIsoSd=sd.formalIso?sd.sd:null,formalRate=zone==='atmospheric'&&sd.formalIso&&[pd,rh,t,manualIsoSd].every(Number.isFinite)?doseResponse(material,pd,manualIsoSd,rh,t):null,formalClass=corrosionClass(material,formalRate);
  const recommendedRate=sd.formalIso?formalRate:surfaceRate??engineeringRate,recommendedClass=sd.formalIso?formalClass:surfaceClass!=='N/A'?surfaceClass:engineeringClass;
  const conf=confidence(result,sd),wetDelta=Number.isFinite(surfaceRate)&&Number.isFinite(engineeringRate)&&engineeringRate>0?100*(surfaceRate/engineeringRate-1):null;
  const warnings=[];
  if(zone!=='atmospheric')warnings.push('当前V3.4.0沿海大气腐蚀等级仅对Atmospheric区带给出C1–CX；Splash/Tidal/Submerged继续使用独立区带模型。');
  if(!sd.formalIso)warnings.push('当前Sd为虚拟湿烛Model-equivalent，推荐等级属于工程评估，不等同于ISO 9223正式认证等级。');
  if((finite(s.proxySaltHours)??0)>0)warnings.push('海盐存在Proxy时段，局地近岸源强不确定性上升。');
  if((finite(s.wetHours)??0)>0&&wet.ready)warnings.push('最终工程通道已使用表面温度/表面RH；不再仅依赖空气RH。');
  if(result?.hourly?.some(r=>r.valid&&r.rain>0&&r.wetDepAvailable===false))warnings.push('设备真实表面湿沉降仍缺校准参数；虚拟湿烛因标准采样器防雨不直接加入雨滴沉降，但设备Cl库存可能被低估。');
  return {version:COASTAL_ASSESSMENT_VERSION,zone,material,ready:Number.isFinite(recommendedRate),basis:sd.formalIso?'ISO_9223_FORMAL':'COASTAL_ENGINEERING_SURFACE_ENHANCED',confidence:conf,recommended:{rate:recommendedRate,corrosionClass:recommendedClass,label:sd.formalIso?'ISO 9223 Formal':'Coastal Engineering',formalIso:sd.formalIso},formal:{ready:Number.isFinite(formalRate),rate:formalRate,corrosionClass:formalClass,sd:sd.formalIso?sd.sd:null},engineering:{ready:Number.isFinite(engineeringRate),rate:engineeringRate,corrosionClass:engineeringClass,sd:sd.sd,chlorideClass:chlorideClass(sd.sd)},surfaceEnhanced:{ready:Number.isFinite(surfaceRate),rate:surfaceRate,corrosionClass:surfaceClass,meanSurfaceRh:wet.meanSurfaceRh,meanSurfaceTemp:wet.meanSurfaceTemp,wetnessDeltaPercent:wetDelta},sd,wetness:wet,pd,rh,t,warnings,statement:sd.formalIso?'该等级满足平台Formal门槛：ISO 9225可追溯Sd + Pd + T/RH。':'该等级用于沿海工程真实风险评估；采用虚拟湿烛Sd与金属表面湿润物理增强，必须与Formal ISO等级区分。'};
}
