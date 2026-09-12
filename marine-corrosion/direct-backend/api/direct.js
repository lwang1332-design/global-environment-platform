// Vercel gateway. Credentials are read only from server environment variables.
// Async mode requires the data worker's durable /v1/tasks protocol. No in-memory
// queue is presented as durable in a serverless function.
const ALLOWED_ORIGINS=['https://lwang1332-design.github.io'];
const services=reason=>Object.fromEntries(['era5','cams','cmems'].map(k=>[k,{configured:false,dataAvailable:false,error:{code:'NOT_CONFIGURED',message:reason}}]));
const safeError=(status)=>({code:status===401||status===403?'AUTH':status===404?'NOT_FOUND':status===429?'RATE_LIMIT':'UPSTREAM',message:'上游数据服务请求失败；服务端凭据不会返回浏览器'});
export default async function handler(req,res){
 const origin=req.headers?.origin;
 if(origin&&ALLOWED_ORIGINS.includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Cache-Control','no-store');
 if(origin&&!ALLOWED_ORIGINS.includes(origin))return res.status(403).json({error:{code:'ORIGIN',message:'此来源未获允许'}});
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:{code:'METHOD',message:'仅支持GET/POST'}});
 const base=process.env.ENGINEERING_DATA_API_URL,token=process.env.ENGINEERING_DATA_API_TOKEN,asyncMode=process.env.DIRECT_TASK_PROTOCOL==='async';
 const health=req.method==='GET'&&!req.query?.job;
 if(!base){const body={version:'3.2.8',gatewayHealthy:true,dataAvailable:false,services:services('尚未配置原始数据工作服务 ENGINEERING_DATA_API_URL')};return res.status(health?200:503).json({...body,...(!health?{error:{code:'NOT_CONFIGURED',message:'数据工作服务尚未配置；请使用明确标记的替代数据'}}:{})})}
 let upstream;try{upstream=new URL(base);if(upstream.protocol!=='https:'||upstream.username||upstream.password)throw new Error()}catch{return res.status(503).json({error:{code:'NOT_CONFIGURED',message:'工作服务地址必须为不含凭据的HTTPS地址'}})}
 const headers={Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})};let route='/v1/health',options={headers};
 if(req.method==='POST'){
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return res.status(400).json({error:{code:'INPUT',message:'无效JSON'}})}
  const validNumber=v=>typeof v==='number'&&Number.isFinite(v);
  if(!b||!validNumber(b.lat)||Math.abs(b.lat)>90||!validNumber(b.lon)||Math.abs(b.lon)>180||!validNumber(b.height)||b.height<2||b.height>150||!['historical','current'].includes(b.mode)||b.mode==='historical'&&(!Number.isInteger(b.year)||b.year<1940||b.year>=new Date().getUTCFullYear()))return res.status(400).json({error:{code:'INPUT',message:'请检查坐标、年份、模式和高度'}});
  const payload={lat:b.lat,lon:b.lon,height:b.height,mode:b.mode,...(b.mode==='historical'?{year:b.year}:{})};
  if(asyncMode){route='/v1/tasks';options={method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(payload)}}
  else{route='/v1/'+b.mode+'/context?'+new URLSearchParams(Object.fromEntries(Object.entries(payload).filter(([k])=>k!=='mode')))}
 }else if(req.query?.job){if(!asyncMode)return res.status(409).json({error:{code:'PROTOCOL',message:'原工作服务尚未提供持久任务接口'}});if(!/^[A-Za-z0-9_-]{1,200}$/.test(req.query.job))return res.status(400).json({error:{code:'INPUT',message:'任务编号无效'}});route='/v1/tasks/'+encodeURIComponent(req.query.job)}
 try{
  const response=await fetch(base.replace(/\/$/,'')+route,{...options,signal:AbortSignal.timeout(25000),redirect:'error'});
  if(!response.ok)return res.status(response.status).json({error:safeError(response.status)});
  const data=await response.json();
  if(response.status===202){if(!/^[A-Za-z0-9_-]{1,200}$/.test(data.jobId||''))return res.status(502).json({error:{code:'INVALID_RESPONSE',message:'工作服务未返回有效任务编号'}});return res.status(202).json({version:'3.2.8',status:['queued','running'].includes(data.status)?data.status:'queued',jobId:data.jobId,retryAfterSeconds:Math.max(2,Math.min(15,Number(data.retryAfterSeconds)||3))})}
  const allowed=['weather','cams','ocean','gis','services','status','jobId','result','era5','cmems'];const body=Object.fromEntries(allowed.filter(k=>data[k]!==undefined).map(k=>[k,data[k]]));
  if(!health&&!body.weather&&!body.cams&&!body.ocean&&!body.services&&!body.result)return res.status(502).json({error:{code:'INVALID_RESPONSE',message:'工作服务响应不包含环境数据或服务状态'}});
  return res.status(200).json({...body,version:'3.2.8',...(health?{gatewayHealthy:true,note:'健康检查不是本次有效数据验证'}:{})});
 }catch(error){return res.status(error.name==='TimeoutError'?504:502).json({error:{code:error.name==='TimeoutError'?'TIMEOUT':'UPSTREAM',message:asyncMode?'数据服务暂未响应，可恢复已有任务':'原同步工作服务未在25秒内返回；需要启用持久任务接口或上游缓存'}})}
}
