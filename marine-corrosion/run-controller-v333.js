import {RunCoordinator as RunCoordinator332,DataCache,abortable,computeInWorker,mergeEnvironments} from './run-controller-v332.js';
export {DataCache,abortable,computeInWorker,mergeEnvironments};
export const DATA_VERSION='3.3.2';
export const DIAGNOSTIC_VERSION='3.3.3';

export class RunCoordinator extends RunCoordinator332{
  async run(input,onProgress=()=>{},options={}){
    const result=await super.run(input,onProgress,options);
    try{
      globalThis.dispatchEvent?.(new CustomEvent('marine:result',{detail:{result,diagnosticVersion:DIAGNOSTIC_VERSION,scienceModelVersion:result?.inputSnapshot?.modelVersion||'3.3.0'}}));
    }catch{}
    return result;
  }
}
