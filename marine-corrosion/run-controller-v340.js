import {RunCoordinator as RunCoordinator333,DataCache,abortable,computeInWorker,mergeEnvironments} from './run-controller-v333.js';
import {assessCoastalCorrosion} from './coastal-corrosion-v340.js';
export {DataCache,abortable,computeInWorker,mergeEnvironments};
export const DATA_VERSION='3.3.2';
export const DIAGNOSTIC_VERSION='3.3.3';
export const COASTAL_VERSION='3.4.0';
export const SETTINGS_KEY='marineV340Settings';

export function readV340Settings(){try{return JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY)||'{}')||{}}catch{return {}}}
export function saveV340Settings(settings){try{globalThis.localStorage?.setItem(SETTINGS_KEY,JSON.stringify(settings||{}))}catch{}return settings||{}}

export class RunCoordinator extends RunCoordinator333{
  async run(input,onProgress=()=>{},options={}){
    const result=await super.run(input,onProgress,options);
    let assessment=null;
    try{assessment=assessCoastalCorrosion(result,readV340Settings());result.coastalAssessment=assessment;globalThis.__MARINE_V340_LAST_RESULT__=result;globalThis.__MARINE_V340_LAST_ASSESSMENT__=assessment;globalThis.dispatchEvent?.(new CustomEvent('marine:v340',{detail:{result,assessment,version:COASTAL_VERSION}}));}catch(error){globalThis.dispatchEvent?.(new CustomEvent('marine:v340:error',{detail:{error:String(error?.message||error)}}));}
    return result;
  }
}
