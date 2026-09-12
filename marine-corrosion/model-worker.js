import {computeModel} from './model-v328.js';
self.onmessage=event=>{try{self.postMessage({result:computeModel(event.data)})}catch(error){self.postMessage({error:error.message})}};
