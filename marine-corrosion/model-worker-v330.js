import {computeModel} from './model-v330.js';
self.onmessage=e=>{try{self.postMessage({result:computeModel(e.data)})}catch(error){self.postMessage({error:error?.message||String(error)})}}
