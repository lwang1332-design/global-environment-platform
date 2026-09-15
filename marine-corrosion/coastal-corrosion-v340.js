import {doseResponse,corrosionClass,chlorideClass} from './model-v330.js';
import {establishIsoSd,normalizeSdSettings} from './iso-sd-v340.js';
import {evaluateSurfaceWetness} from './surface-wetness-v340.js';

export const COASTAL_ASSESSMENT_VERSION='3.4.0';
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const rank={C1:1,C2:2,C3:3,C4:4,C5:5,CX:6,'N/A':0};
export function worseClass(a,b){return (rank[b]||0)>(rank[a]||0)?b:a}
function confidence(result,sd){const q=String(result?.qualityAssessment?.inputGrade||'C').toUpperCase(),proxy=finite(result?.summary?.proxySaltHours)??0,cams=finite(result?.summary?.camsHours)??0,total=proxy+cams;if(sd.formalIso)return sd.confidence||'B';if(total>0&&cams/total>.9&&['A','B','C'].includes(q)&&((finite(sd.camsFluxCoveragePercent)??0)>=90||!sd.fluxEvidence?.ready))return 'C';return 'D'}
export function assessCoastalCorrosion(result,settings={}){
  const s=result?.summary||{},material=s.material||result?.project?.material||'carbon_steel',zone=s.exposureZone||result?.project?.exposureZone||'atmospheric';
  const sdSettings=normalizeSdSettings(settings.sd||{}),sd=establishIsoSd(result,sdSettings),wet=evaluateSurfaceWetness(result,settings.surface||{}),pd=finite(s.meanSo2Dep),rh=finite(s.meanRh),t=finite(s.meanTemp);
  const validBase=zone==='atmospheric'&&[pd,rh,t,sd.sd].every(Number.isFinite),engineeringRate=validBase?doseResponse(material,pd,sd.sd,rh,t):null,engineeringClass=corrosionClass(material,engineeringRate);
  const surfaceRawRate=validBase&&Number.isFinite(wet.meanSurfaceRh)&&Number.isFinite(wet.meanSurfaceTemp)?doseResponse(material,pd,sd.sd,wet.meanSurfaceRh,wet.meanSurfaceTemp):null,surfaceRawClass=corrosionClass(material,surfaceRawRate);
  const surfaceEnvelopeRate=Number.isFinite(engineeringRate)&&Number.isFinite(surfaceRawRate)?Math.max(engineeringRate,surfaceRawRate):(surfaceRawRate??engineeringRate),surfaceEnvelopeClass=corrosionClass(material,surfaceEnvelopeRate),downgradeBlocked=Number.isFinite(surfaceRawRate)&&Number.isFinite(engineeringRate)&&surfaceRawRate<engineeringRate;
  const manualIsoSd=sd.formalIso?sd.sd:null,formalRate=zone==='atmospheric'&&sd.formalIso&&[pd,rh,t,manualIsoSd].every(Number.isFinite)?doseResponse(material,pd,manualIsoSd,rh,t):null,formalClass=corrosionClass(material,formalRate);
  const recommendedRate=sd.formalIso?formalRate:surfaceEnvelopeRate??engineeringRate,recommendedClass=corrosionClass(material,recommendedRate);
  const conf=confidence(result,sd),rawWetDelta=Number.isFinite(surfaceRawRate)&&Number.isFinite(engineeringRate)&&engineeringRate>0?100*(surfaceRawRate/engineeringRate-1):null,wetDelta=Number.isFinite(rawWetDelta)?Math.max(0,rawWetDelta):null;
  const warnings=[];
  if(zone!=='atmospheric')warnings.push('当前V3.4.0沿海大气腐蚀等级仅对Atmospheric区带给出C1–CX；Splash/Tidal/Submerged继续使用独立区带模型。');
  if(!sd.formalIso)warnings.push('当前Sd为Model-equivalent工程值，推荐等级属于工程评估，不等同于ISO 9223正式认证等级。');
  if((finite(s.proxySaltHours)??0)>0)warnings.push('海盐存在Proxy时段，局地近岸源强不确定性上升。');
  if(sd.fluxEvidence?.ready)warnings.push(`已纳入CAMS真实海盐干沉降、重力沉降及湿沉降通量；通量覆盖率${(finite(sd.camsFluxCoveragePercent)??0).toFixed(1)}%。`);else warnings.push('CAMS海盐沉降通量当前不可用；Model-equivalent Sd退回虚拟湿烛捕集通道，缺失通量未按0处理。');
  if(downgradeBlocked)warnings.push('Surface-Wetness原始剂量响应低于ISO-based工程基准；按保守包络规则禁止降级，推荐值保持不低于ISO-based Engineering。');
  if(wet.ready)warnings.push('Surface-Wetness使用金属表面温度/表面RH、DRH/ERH潮解滞回和重算表面盐库存；其作用是识别增量风险，不替代Formal ISO。');
  return {version:COASTAL_ASSESSMENT_VERSION,zone,material,ready:Number.isFinite(recommendedRate),basis:sd.formalIso?'ISO_9223_FORMAL':'COASTAL_ENGINEERING_CONSERVATIVE_ENVELOPE',confidence:conf,recommended:{rate:recommendedRate,corrosionClass:recommendedClass,label:sd.formalIso?'ISO 9223 Formal':'Coastal Engineering Conservative',formalIso:sd.formalIso,envelopeRule:sd.formalIso?'FORMAL_ISO':'MAX(ISO_BASED_ENGINEERING,SURFACE_WETNESS_RAW)'},formal:{ready:Number.isFinite(formalRate),rate:formalRate,corrosionClass:formalClass,sd:sd.formalIso?sd.sd:null},engineering:{ready:Number.isFinite(engineeringRate),rate:engineeringRate,corrosionClass:engineeringClass,sd:sd.sd,chlorideClass:chlorideClass(sd.sd)},surfaceEnhanced:{ready:Number.isFinite(surfaceEnvelopeRate),rate:surfaceEnvelopeRate,corrosionClass:surfaceEnvelopeClass,rawRate:surfaceRawRate,rawCorrosionClass:surfaceRawClass,meanSurfaceRh:wet.meanSurfaceRh,meanSurfaceTemp:wet.meanSurfaceTemp,wetnessDeltaPercent:wetDelta,rawWetnessDeltaPercent:rawWetDelta,downgradeBlocked},sd,wetness:wet,pd,rh,t,warnings,statement:sd.formalIso?'该等级满足平台Formal门槛：ISO 9225可追溯Sd + Pd + T/RH。':'该等级用于沿海工程风险评估：Model-equivalent Sd对虚拟湿烛与CAMS真实沉降通量取保守包络；Surface-Wetness只允许增加风险，不允许把ISO-based工程基准降级。'};
}
