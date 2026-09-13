import {normalizeDirectCams as normalizeDirectCams328} from './sources-v328.js';
export {
  alignSeries,DIRECT_URL,SourceError,classifyError,requestJson,fetchDirectGateway,fetchDirectHealth,UNITS,convertUnit,
  fetchOpenMeteoHistorical,fetchOpenMeteoCurrent,fetchOpenMeteoMarine,normalizeDirectWeather,normalizeDirectOcean
} from './sources-v328.js';

export function normalizeDirectCams(c,t){
  const out=normalizeDirectCams328(c,t);
  if(!out)return out;
  out.provenance={...out.provenance,seaSaltMassBasis:'RH80',seaSaltSizeBasis:'RH80',scienceModel:'V3.3.0 converts sea-salt mass to dry salt before deposition'};
  for(const key of ['ss1','ss2','ss3'])if(out.fieldMeta?.[key])out.fieldMeta[key]={...out.fieldMeta[key],referenceRhPercent:80,massBasis:'wet sea-salt mass at RH80; model converts /4.3 to dry salt',sizeBasis:'CAMS bin boundaries defined at RH80'};
  return out;
}
