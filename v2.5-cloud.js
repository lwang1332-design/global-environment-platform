const SHELF_CLOUD_API='https://vzlnwrxscufkchxkdjus.supabase.co/functions/v1/v27-shelf';
let shelfCloudMeta={version:'LOCAL-FALLBACK',updatedAt:null,source:'fallback'};
let shelfMatchRule={...MATCH_RULE};

function shelfSetRunDisabled(v){['topRun','placeRun','coordRun'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=v})}
function shelfResetToBuiltIn(){cfg={scenarios:{}};activePackages=packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]);riskRules=mergeRiskRules(DEFAULT_RISK_RULES,{});shelfMatchRule={...MATCH_RULE}}
function shelfPatchMatchHelpers(){
  matchClass=function(score){return score>=shelfMatchRule.high?'high':score>=shelfMatchRule.medium?'mid':'low'};
  matchLabel=function(score){return score>=shelfMatchRule.high?'高匹配':score>=shelfMatchRule.medium?'中匹配':'低匹配'};
}
function shelfPatchReport(){
  const baseSave=saveReportSnapshot;
  saveReportSnapshot=function(){const ok=baseSave();if(!ok)return false;try{const s=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');if(s){s.version='V2.7-CLOUD';s.cloudConfig={...shelfCloudMeta};s.matchRule={...shelfMatchRule};localStorage.setItem(REPORT_KEY,JSON.stringify(s))}}catch(e){console.warn('报告云端版本快照写入失败',e)}return true};
  const baseRender=renderResult;
  renderResult=function(){baseRender();const box=document.getElementById('resultChips');if(box&&!box.textContent.includes('云端配置：'))box.insertAdjacentHTML('beforeend',`<span>云端配置：${shelfCloudMeta.version}</span>`)};
}
async function syncShelfCloud(){
  shelfSetRunDisabled(true);shelfResetToBuiltIn();shelfPatchMatchHelpers();
  status.shelf=['Supabase Cloud Config','风险规则、场景匹配阈值、9场景技术货架、12升级包','加载中','—'];renderStatus();
  const msg=document.getElementById('locMsg');if(msg)msg.textContent='正在同步云端技术货架，请稍候…';
  try{
    const r=await fetch(`${SHELF_CLOUD_API}/config/latest?ts=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
    const j=await r.json(),row=j?.config,c=row?.config;if(!c)throw Error('云端未返回配置');
    cfg={scenarios:c.scenarios||{}};
    activePackages=Array.isArray(c.packages)&&c.packages.length?c.packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]):packages.map(p=>[p[0],p[1],p[2],[...(p[3]||[])]]);
    riskRules=mergeRiskRules(DEFAULT_RISK_RULES,c.riskRules||{});shelfMatchRule={...MATCH_RULE,...(c.matchRule||{})};shelfPatchMatchHelpers();
    shelfCloudMeta={version:row.version||'CLOUD',updatedAt:row.updatedAt||null,source:'cloud'};
    status.shelf[2]='成功';status.shelf[3]=`${shelfCloudMeta.version}${shelfCloudMeta.updatedAt?' · '+new Date(shelfCloudMeta.updatedAt).toLocaleString():''}`;
    if(msg)msg.textContent=`云端技术货架 ${shelfCloudMeta.version} 已加载。点击“地名检索并分析”或“按经纬度分析”开始。`;
  }catch(e){
    shelfResetToBuiltIn();shelfCloudMeta={version:'LOCAL-FALLBACK',updatedAt:null,source:'fallback'};status.shelf[2]='失败';status.shelf[3]='已回退内置规则 · '+(e.message||String(e));
    if(msg){msg.className='msg error';msg.textContent='云端技术货架读取失败，当前使用内置回退规则：'+(e.message||String(e))}
  }finally{renderStatus();shelfSetRunDisabled(false);if(Object.keys(env).length)renderDecision();else{const box=document.getElementById('resultChips');if(box)box.innerHTML=`<span>等待项目环境分析</span><span>规则：${shelfCloudMeta.version}</span>`}}
}

shelfPatchReport();syncShelfCloud();
