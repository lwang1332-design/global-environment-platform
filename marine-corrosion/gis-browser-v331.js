import {resolveGis as resolveGis330,fallbackGisContext as fallbackGisContext330} from './gis-browser-v330.js';
import {applyManualGisOverride,INPUT_STORAGE_KEY} from './input-policy-v331.js';

function readManualInputs(){
  if(typeof localStorage==='undefined')return {};
  try{return JSON.parse(localStorage.getItem(INPUT_STORAGE_KEY)||'{}')||{}}catch{return {}}
}

export async function fallbackGisContext(lat,lon,signal){
  const base=await fallbackGisContext330(lat,lon,signal);
  return applyManualGisOverride(base,readManualInputs());
}

export async function resolveGis(lat,lon,direct,signal){
  const base=await resolveGis330(lat,lon,direct,signal);
  return applyManualGisOverride(base,readManualInputs());
}
