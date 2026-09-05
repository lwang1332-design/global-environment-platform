const SHELF_CLOUD_API='https://vzlnwrxscufkchxkdjus.supabase.co/functions/v1/v27-shelf';
let shelfCloudMeta={version:'LOCAL-FALLBACK',updatedAt:null,source:'fallback'};
let shelfMatchRule={...MATCH_RULE};

const DEFAULT_SCENARIO_MODEL={
  version:'V2.8-SCENE-2',
  mix:{core:.72,support:.28,epsilon:.02,maxInteraction:.15},
  confidence:{high:65,medium:50,secondaryMin:25,compositeDelta:10},
  priors:{
    '海上':{'海洋气候':8,'滨海盐雾气候':0,'常温内陆气候':0},
    '陆上':{'海洋气候':0,'常温内陆气候':1.15},
    '陆上滨海':{'滨海盐雾气候':5,'海洋气候':0,'常温内陆气候':.35},
    '沙漠/戈壁':{'沙戈荒气候':5,'海洋气候':0,'常温内陆气候':.25},
    '高原':{'高原高寒气候':5,'海洋气候':0,'常温内陆气候':.35},
    '工矿区':{'工矿腐蚀环境':5,'海洋气候':0,'常温内陆气候':.35}
  },
  floors:{
    '海上':{'海洋气候':.88},'陆上滨海':{'滨海盐雾气候':.55},'沙漠/戈壁':{'沙戈荒气候':.55},
    '高原':{'高原高寒气候':.55},'工矿区':{'工矿腐蚀环境':.55}
  },
  scenarios:{
    '热带雨林气候':{core:[['rh90',.35],['rainYear',.35],['condProxy',.30]],support:[['t99',.28],['rain1h',.24],['rhAvgHigh',.28],['rad95',.10],['wind95',.10]],interaction:[[['rh90','rainYear','t99'],.10]]},
    '滨海盐雾气候':{core:[['salt',.50],['rh90',.25],['condProxy',.25]],support:[['rain1h',.25],['wind95',.25],['rhAvgHigh',.30],['corrosionProxy',.20]],interaction:[[['salt','rh90'],.10]]},
    '沙戈荒气候':{core:[['dust',.35],['pm10',.30],['lowRain',.35]],support:[['t99',.25],['rad95',.25],['wind95',.20],['lowHumidity',.30]],interaction:[[['dust','wind95','t99'],.10]]},
    '高温环境':{core:[['t99',1]],support:[['rad95',.55],['lowHumidity',.15],['alt',.15],['wind95',.15]],interaction:[[['t99','rad95'],.08]]},
    '高原高寒气候':{core:[['alt',.60],['tmin',.40]],support:[['rad95',.25],['snowHours',.25],['condProxy',.20],['lowHumidity',.15],['wind95',.15]],interaction:[[['alt','tmin'],.10]]},
    '寒地暴雪气候':{core:[['tmin',.55],['snowHours',.45]],support:[['wind95',.35],['rh90',.20],['condProxy',.20],['rad95',.10],['alt',.15]],interaction:[[['tmin','snowHours','wind95'],.10]]},
    '海洋气候':{core:[['seaExposure',.55],['salt',.25],['rh90',.20]],support:[['wind95',.30],['rain1h',.20],['condProxy',.20],['corrosionProxy',.20],['rainYear',.10]],interaction:[[['salt','rh90','wind95'],.10]]},
    '工矿腐蚀环境':{core:[['so2',.55],['corrosionProxy',.45]],support:[['pm10',.25],['dust',.20],['rh90',.20],['condProxy',.20],['rainYear',.15]],interaction:[[['so2','rh90'],.10]]}
  }
};
let shelfScenarioModel=JSON.parse(JSON.stringify(DEFAULT_SCENARIO_MODEL));
let lastSceneRanking=[];

function shelfSetRunDisabled(v){['topRun','placeRun','coordRun'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=v})}
function shelfResetToBuiltIn(){cfg={scenarios:{}};activePackages=packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]);riskRules=mergeRiskRules(DEFAULT_RISK_RULES,{});shelfMatchRule={...MATCH_RULE};shelfScenarioModel=JSON.parse(JSON.stringify(DEFAULT_SCENARIO_MODEL))}
function shelfPatchMatchHelpers(){
  matchClass=function(score){return score>=shelfMatchRule.high?'high':score>=shelfMatchRule.medium?'mid':'low'};
  matchLabel=function(score){return score>=shelfMatchRule.high?'高匹配':score>=shelfMatchRule.medium?'中匹配':'低匹配'};
}
function installScenePresentation(){
  const p=document.querySelector('#scene .section-title p');
  if(p)p.textContent='系统根据机组类型、项目地理位置及真实环境数据自动识别，仅显示置信度最高的主场景和次场景；无需人工选择部署环境。';
  if(!document.getElementById('sceneTop2Style')){
    const st=document.createElement('style');st.id='sceneTop2Style';st.textContent='.scenes{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:720px){.scenes{grid-template-columns:1fr}}';document.head.appendChild(st);
  }
}
function sigmoidEvidence(v,medium,high,direction='high'){
  v=Number(v);medium=Number(medium);high=Number(high);if(!Number.isFinite(v)||!Number.isFinite(medium)||!Number.isFinite(high))return 0;
  const span=Math.abs(high-medium);if(span<1e-9)return direction==='low'?(v<=high?1:0):(v>=high?1:0);
  const mid=(medium+high)/2,k=2*Math.log(9)/span,z=k*(v-mid);
  const p=direction==='low'?1/(1+Math.exp(z)):1/(1+Math.exp(-z));return Math.max(0,Math.min(1,p));
}
function metricEvidence(metric){
  const r=riskRules[metric];if(!r)return 0;return sigmoidEvidence(env[metric],r.medium,r.high,r.direction||'high');
}
function resolvedDeployment(){
  const mt=document.getElementById('machineType')?.value||'';
  if(mt==='海上')return '海上';
  const text=[document.getElementById('place')?.value||'',document.getElementById('projectName')?.value||''].join(' ');
  const plateauName=/(高原|西藏|拉萨|日喀则|青海|西宁|格尔木|玉树|昌都|那曲|阿里)/i.test(text);
  const desertName=/(沙漠|戈壁|荒漠|沙地|若羌|敦煌|哈密|吐鲁番|酒泉|阿拉善|和田|巴音郭楞|库尔勒)/i.test(text);
  const industrialName=/(工矿|矿区|煤矿|工业园|钢铁|化工|冶炼|矿山)/i.test(text);
  const coastalName=/(滨海|沿海|海岸|海湾|港区|三亚|海口|青岛|烟台|威海|大连|厦门|深圳|珠海|湛江|阳江|汕头|汕尾|北海|防城港|盐城|南通|连云港|舟山|宁波|温州|福州|泉州|漳州|上海|天津|秦皇岛|唐山|东营|日照|营口)/i.test(text);
  if(plateauName)return '高原';
  if(desertName)return '沙漠/戈壁';
  if(industrialName)return '工矿区';
  if(coastalName)return '陆上滨海';
  const alt=Number(env.alt||0),salt=metricEvidence('salt'),dust=Math.max(metricEvidence('dust'),metricEvidence('pm10')),dry=sigmoidEvidence(env.rainYear,900,300,'low'),so2=metricEvidence('so2');
  if(alt>=1800||metricEvidence('alt')>=.65)return '高原';
  if(salt>=.55)return '陆上滨海';
  if(dry>=.65&&dust>=.50)return '沙漠/戈壁';
  if(so2>=.70)return '工矿区';
  return '陆上';
}
function sceneFeatureEvidence(){
  const f={};Object.keys(riskRules).forEach(k=>f[k]=metricEvidence(k));
  f.rhAvgHigh=sigmoidEvidence(env.rhAvg,70,85,'high');
  f.lowHumidity=sigmoidEvidence(env.rhAvg,75,45,'low');
  f.lowRain=sigmoidEvidence(env.rainYear,900,300,'low');
  f.condProxy=Math.sqrt(Math.max(0,(f.rh90||0)*(f.rhAvgHigh||0)));
  f.corrosionProxy=1-(1-(f.salt||0))*(1-(f.so2||0))*(1-.5*(f.condProxy||0));
  f.seaExposure=document.getElementById('machineType')?.value==='海上'?1:.001;
  return f;
}
function weightedGeo(items,f){
  const eps=Number(shelfScenarioModel.mix?.epsilon??.02),sw=(items||[]).reduce((s,x)=>s+Number(x[1]||0),0)||1;
  const log=(items||[]).reduce((s,x)=>s+Number(x[1]||0)*Math.log(eps+Math.max(0,Math.min(1,Number(f[x[0]]||0)))),0)/sw;
  return Math.max(0,Math.min(1,Math.exp(log)-eps));
}
function weightedMean01(items,f){const sw=(items||[]).reduce((s,x)=>s+Number(x[1]||0),0)||1;return Math.max(0,Math.min(1,(items||[]).reduce((s,x)=>s+Number(x[1]||0)*Number(f[x[0]]||0),0)/sw))}
function applyPriorOdds(p,mul){mul=Number(mul??1);if(mul<=0)return 0;p=Math.max(.001,Math.min(.999,Number(p)||0));const odds=p/(1-p)*mul;return odds/(1+odds)}
function scenarioOne(name,def,f,dep){
  const core=weightedGeo(def.core||[],f),support=weightedMean01(def.support||[],f),mix=shelfScenarioModel.mix||{};
  let inter=0;(def.interaction||[]).forEach(x=>{const names=x[0]||[],w=Number(x[1]||0);inter+=w*names.reduce((p,k)=>p*Number(f[k]||0),1)});inter=Math.min(Number(mix.maxInteraction??.15),inter);
  let raw=Math.max(0,Math.min(.97,Number(mix.core??.72)*core+Number(mix.support??.28)*support+inter));
  const prior=Number(shelfScenarioModel.priors?.[dep]?.[name]??1);let conf=applyPriorOdds(raw,prior);
  const floor=Number(shelfScenarioModel.floors?.[dep]?.[name]??0);if(floor)conf=Math.max(conf,floor);
  const parts=[...(def.core||[]).map(x=>({k:x[0],w:x[1],v:Number(f[x[0]]||0),kind:'核心'})),...(def.support||[]).map(x=>({k:x[0],w:x[1],v:Number(f[x[0]]||0),kind:'辅助'}))];
  const labels={t99:'P99高温',tmin:'极端低温',rh90:'RH>90%',rainYear:'年降水',rain1h:'1h强降雨',salt:'海盐气溶胶',pm10:'PM10',dust:'Dust',alt:'海拔',snowHours:'降雪',so2:'SO₂',rad95:'太阳辐射',wind95:'P95风速',rhAvgHigh:'高湿',lowHumidity:'低湿',lowRain:'少降水',condProxy:'凝露潜势',corrosionProxy:'腐蚀协同',seaExposure:'海上机型'};
  const basis=parts.sort((a,b)=>b.v*b.w-a.v*a.w).slice(0,3).map(x=>`${x.kind}${labels[x.k]||x.k} ${Math.round(x.v*100)}%`).join('；')+(prior!==1?`；机组/地理先验 ${dep}×${prior}`:'');
  return{name,score:Math.round(conf*100),confidence:conf,core:Math.round(core*100),support:Math.round(support*100),prior,basis,modelVersion:shelfScenarioModel.version||'SCENE'};
}
sceneScores=function(){
  const dep=resolvedDeployment(),f=sceneFeatureEvidence(),arr=[];
  Object.entries(shelfScenarioModel.scenarios||{}).forEach(([name,def])=>arr.push(scenarioOne(name,def,f,dep)));
  const maxSpecial=Math.max(0,...arr.map(x=>x.confidence));let normal=Math.max(.03,Math.min(.95,.95-.90*maxSpecial));normal=applyPriorOdds(normal,Number(shelfScenarioModel.priors?.[dep]?.['常温内陆气候']??1));
  arr.push({name:'常温内陆气候',score:Math.round(normal*100),confidence:normal,core:Math.round((1-maxSpecial)*100),support:Math.round((1-maxSpecial)*100),prior:Number(shelfScenarioModel.priors?.[dep]?.['常温内陆气候']??1),basis:'专项场景置信度反向残差；特殊环境证据越低，常温内陆置信度越高',modelVersion:shelfScenarioModel.version||'SCENE'});
  arr.sort((a,b)=>b.score-a.score);
  if(dep==='海上'){
    const oi=arr.findIndex(x=>x.name==='海洋气候');if(oi>0){const [o]=arr.splice(oi,1);o.score=Math.max(o.score,Math.min(99,arr[0].score+5),88);o.confidence=o.score/100;arr.unshift(o)}
  }
  lastSceneRanking=arr;return arr;
};
renderScenes=function(){
  const arr=sceneScores(),visible=arr.slice(0,2);if(!visible.some(s=>s.name===selectedScene))selectedScene=visible[0]?.name||'';const a=visible[0],b=visible[1],delta=a&&b?a.score-b.score:0,composite=delta<Number(shelfScenarioModel.confidence?.compositeDelta??10);
  $('sceneBadge').textContent=a?`主场景：${a.name} ${a.score}% · 次场景：${b?.name||'—'} ${b?.score??0}%${composite?' · 复合场景':''}`:'等待环境数据';
  $('sceneGrid').innerHTML=visible.map((s,i)=>{const d=getScenario(s.name),cl=matchClass(s.score);return `<div class="scene score-${cl} ${i===0?'primary-scene':''} ${selectedScene===s.name?'selected-scene':''}" onclick="selectScene('${s.name}')"><span class="pill">${i===0?'主场景':'次场景'}</span><h4>${s.name}</h4><p>${d.def}</p><p><b>关键特征：</b>${d.features}</p><p><b>${matchLabel(s.score)}</b> · 场景置信度 ${s.score}%</p><div class="scorebar"><i class="bar-${cl}" style="width:${s.score}%"></i></div><p class="score-basis">核心证据 ${s.core}% · 辅助证据 ${s.support}%<br>识别依据：${s.basis}</p></div>`}).join('');return arr;
};
function shelfPatchReport(){
  const baseSave=saveReportSnapshot;
  saveReportSnapshot=function(){const ok=baseSave();if(!ok)return false;try{const s=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');if(s){const ranked=sceneScores();s.version='V2.8-SCENE';s.cloudConfig={...shelfCloudMeta};s.matchRule={...shelfMatchRule};s.scenarioModelVersion=shelfScenarioModel.version;s.primaryScene=ranked[0]||null;s.secondaryScene=ranked[1]||null;s.project.geoContext=resolvedDeployment();if(s.project.deploymentType)delete s.project.deploymentType;localStorage.setItem(REPORT_KEY,JSON.stringify(s))}}catch(e){console.warn('报告场景模型快照写入失败',e)}return true};
  const baseRender=renderResult;
  renderResult=function(){baseRender();const ranked=sceneScores(),box=document.getElementById('resultChips');if(box){const second=ranked[1];if(second&&!box.textContent.includes('次场景：'))box.insertAdjacentHTML('beforeend',`<span>次场景：${second.name} ${second.score}%</span>`);if(!box.textContent.includes('云端配置：'))box.insertAdjacentHTML('beforeend',`<span>云端配置：${shelfCloudMeta.version}</span>`)} };
}
async function syncShelfCloud(){
  shelfSetRunDisabled(true);shelfResetToBuiltIn();shelfPatchMatchHelpers();
  status.shelf=['Supabase Cloud Config','风险规则、场景识别模型、9场景技术货架、12升级包','加载中','—'];renderStatus();
  const msg=document.getElementById('locMsg');if(msg)msg.textContent='正在同步云端技术货架与场景识别模型，请稍候…';
  try{
    const r=await fetch(`${SHELF_CLOUD_API}/config/latest?ts=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
    const j=await r.json(),row=j?.config,c=row?.config;if(!c)throw Error('云端未返回配置');
    cfg={scenarios:c.scenarios||{}};
    activePackages=Array.isArray(c.packages)&&c.packages.length?c.packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]):packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]);
    riskRules=mergeRiskRules(DEFAULT_RISK_RULES,c.riskRules||{});shelfMatchRule={...MATCH_RULE,...(c.matchRule||{})};shelfScenarioModel=c.scenarioModel||JSON.parse(JSON.stringify(DEFAULT_SCENARIO_MODEL));shelfPatchMatchHelpers();
    shelfCloudMeta={version:row.version||'CLOUD',updatedAt:row.updatedAt||null,source:'cloud'};
    status.shelf[2]='成功';status.shelf[3]=`${shelfCloudMeta.version} · ${shelfScenarioModel.version||'SCENE'}${shelfCloudMeta.updatedAt?' · '+new Date(shelfCloudMeta.updatedAt).toLocaleString():''}`;
    if(msg)msg.textContent=`云端技术货架 ${shelfCloudMeta.version} / 场景模型 ${shelfScenarioModel.version} 已加载。点击“地名检索并分析”或“按经纬度分析”开始。`;
  }catch(e){
    shelfResetToBuiltIn();shelfCloudMeta={version:'LOCAL-FALLBACK',updatedAt:null,source:'fallback'};status.shelf[2]='失败';status.shelf[3]='已回退内置规则 · '+(e.message||String(e));
    if(msg){msg.className='msg error';msg.textContent='云端技术货架读取失败，当前使用内置回退规则：'+(e.message||String(e))}
  }finally{renderStatus();shelfSetRunDisabled(false);if(Object.keys(env).length)renderDecision();else{const box=document.getElementById('resultChips');if(box)box.innerHTML=`<span>等待项目环境分析</span><span>规则：${shelfCloudMeta.version}</span><span>场景模型：${shelfScenarioModel.version}</span>`}}
}

installScenePresentation();
shelfPatchReport();
syncShelfCloud();