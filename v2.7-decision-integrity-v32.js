/* V3.2 decision integrity: data completeness and source-to-decision traceability. */
(function(){
'use strict';
const esc=t=>String(t??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const important={t99:'极端高温',tmin:'极端低温',rhAvg:'平均湿度',rh90:'高湿时长',rainYear:'年降雨',rain1h:'小时降雨',salt:'海盐气溶胶',pm10:'PM10',dust:'矿物沙尘',alt:'海拔',snowHours:'降雪小时',so2:'SO₂',rad95:'太阳辐照',wind95:'风速P95'};
function currentMissing(){return [...(window.__envMissing||[])].filter(k=>Object.prototype.hasOwnProperty.call(important,k))}
function state(){
 const missing=currentMissing(),metrics=window.envHealthV31?.fields||[];
 const unrated=metrics.filter(x=>x.riskStatus==='UNRATED').map(x=>x.id);const domainEvidence=getScenario(selectedScene)?.planMeta?.[selectedPlan]?.verifiedCapabilities||{};const approvedCapabilities=Object.entries(domainEvidence).filter(([,v])=>v?.approved&&String(v.evidenceRef||'').trim().length>=4).map(([domain,v])=>({domain,level:v.level,evidenceRef:v.evidenceRef}));
 return {missing,unrated,approvedCapabilities,capabilitiesPending:approvedCapabilities.length===0,unknown:missing.length>0,sourceVersion:window.envHealthV31?.version||'unavailable',computedAt:new Date().toISOString()};
}
function banner(section,id,title,message){
 const host=document.querySelector('#'+section+' .section-title');if(!host)return;
 let node=document.getElementById(id);if(!node){node=document.createElement('div');node.id=id;node.style.cssText='font-size:11px;line-height:1.55;color:#9a4a06;background:#fff9ed;border:1px solid #f4ddb2;border-radius:6px;padding:7px 10px;margin:6px 0';host.insertAdjacentElement('afterend',node)}
 node.textContent=title+'：'+message;node.hidden=false;
}
const originalRender=renderDecision;
renderDecision=function(){originalRender();const st=state();window.EA_DECISION_INTEGRITY=st;
 document.querySelectorAll('#gapBody tr td:last-child').forEach(td=>{
  if(/^0\s*[·•]\s*已覆盖/.test(td.textContent||''))td.textContent='0 · 规则缺口为0（待验证）';
 });
 const gb=document.getElementById('gapBadge');if(gb&&!/待验证|待评价|核验/.test(gb.textContent||'')){gb.textContent+=' · 待工程验证'}

 if(!st.unknown){['eaSceneUncertainty','eaPlanUncertainty','eaReportUncertainty'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true});const gap=document.getElementById('eaGapUncertainty');if(gap)gap.hidden=true;if(st.capabilitiesPending){banner('gap','eaGapUncertainty','能力证据未核准','当前方案没有已批准的风险域验证记录。规则计算Gap不等于工程验收结果。');}return}
 const missing=st.missing.map(k=>important[k]||k).join('、');
 banner('scenes','eaSceneUncertainty','场景识别待核实','缺少 '+missing+'；主/次场景分数为不完整数据下的暂定结果，不得作为冻结设计输入');
 banner('plan','eaPlanUncertainty','方案推荐待核实','缺少关键环境证据，Standard/Pro/Plus仅为临时建议，不能按等级自动确认防护能力');
 banner('gap','eaGapUncertainty','剩余风险待评价','缺少 '+missing+'；部分风险域即使显示0，也不能据此判定已通过工程验证');
 banner('result','eaReportUncertainty','报告附带数据限制','请在正式设计冻结前补齐未获取指标并验证相关技术措施');
};
const originalSave=saveReportSnapshot;
saveReportSnapshot=function(){const ok=originalSave();if(!ok)return false;
 try{
  const snap=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');if(!snap)return ok;
  const st=state();snap.integrity={...st,missingNames:st.missing.map(k=>important[k]||k),engineeringApproval:st.unknown?'缺少关键环境参数，禁止自动判定通过':st.capabilitiesPending?'缺少获批防护能力证据，待工程验证':'已记录部分获批能力，仍需完整工程复核'};
  snap.requirementTrace=(snap.requirements||[]).map((r,i)=>({id:'REQ-'+String(i+1).padStart(3,'0'),requirement:r.requirement||'',source:r.source||'',evidence:r.evidence||'',verification:r.verify||'',verificationStatus:'待验证'}));
  snap.metricCatalogVersion=st.sourceVersion;
  localStorage.setItem(REPORT_KEY,JSON.stringify(snap));
 }catch(e){console.warn('Decision integrity report metadata unavailable',e)}
 return ok;
};
})();