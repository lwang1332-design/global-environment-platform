/* Global Environment Platform V3.3 - registry-consistent risk/capability view */
(()=>{
'use strict';
if(window.GERiskV33?.installed)return;
const finite=Number.isFinite,observed=v=>v!==null&&v!==''&&finite(Number(v));
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const lin=(x,a,b)=>observed(x)&&observed(a)&&observed(b)&&Number(b)!==Number(a)?clamp((Number(x)-Number(a))/(Number(b)-Number(a))*100):NaN;
function P(){try{return window.params||params||{}}catch{return{}}}
function R(){try{return window.result||result||null}catch{return null}}
function SENS(){try{return window.sensitivity||sensitivity||{}}catch{return{}}}
function EXP(){try{return window.exposure||exposure||{}}catch{return{}}}
function A(){return window.GETrendAnalysis}
function metric(m,k){try{return A()?.prepareIndicator?.(m,k)||null}catch{return null}}
function val(m,k){const i=metric(m,k),v=i?.summaryValue??i?.staticValue;return observed(v)?Number(v):NaN}
function validScore(v){return observed(v)?clamp(Number(v)):null}
function capability(){
 const defs=[
  ['高温','温度','temp_design_p99'],['低温','温度','temp_low_p1'],['最大湿度','湿度','rh_max'],['露点裕量','湿度','surface_dew_margin'],['凝露小时','湿度','cond_annual_hours'],
  ['盐沉积','盐雾','cl_dep_rate'],['PM10','PM10 / 颗粒物','pm10_p95'],['散热衰减','海拔','heat_loss'],['日温差','温度','day_range_p95'],['温变速率','温度','temp_rate_p95'],
  ['日降雨','降雨','rain_daily_max'],['小时降雨','降雨','rain_hour_p99'],['阵风','风速','gust_p99'],['降雪','冰雪冻雨','snow_daily_max'],['海拔','海拔','altitude'],
  ['SO2','SO₂ / 腐蚀气体','so2_p95'],['NO2','SO₂ / 腐蚀气体','no2_p95'],['TOW','盐雾','tow']
 ];
 const rows=defs.map(([name,m,k])=>{const i=metric(m,k),v=i?.summaryValue??i?.staticValue,e=i?.designEvaluation;return{name,module:m,key:k,valid:observed(v)&&!!e,pass:observed(v)&&e?!!e.pass:false,value:observed(v)?Number(v):null,design:e||null,unit:i?.summaryUnit||i?.unit||'',source:i?.source||'',dataCode:i?.dataCode||'N/A'}});const valid=rows.filter(x=>x.valid),passed=valid.filter(x=>x.pass);return{rows,validCount:valid.length,passedCount:passed.length,adapt:valid.length?100*passed.length/valid.length:NaN};
}
function scores(){
 const p=P(),r=R(),legacy={...(r?.scores||{})};
 const ht=val('温度','temp_design_p99'),lt=val('温度','temp_low_p1'),rain=val('降雨','rain_daily_max'),alt=val('海拔','altitude'),gust=val('风速','gust_p99');
 if(observed(ht))legacy.高温=validScore(lin(ht,p.hiA,p.hiB));
 if(observed(lt))legacy.低温=validScore(lin(-lt,p.loA,p.loB));
 if(observed(rain))legacy.强降雨=validScore(lin(rain,p.rainA,p.rainB));
 if(observed(alt))legacy.高海拔=validScore(lin(alt,p.altA,p.altB));
 if(observed(gust))legacy.极端风=validScore(lin(gust,p.windA,p.windB));else delete legacy.极端风;
 Object.keys(legacy).forEach(k=>{if(!observed(legacy[k]))delete legacy[k]});
 return legacy;
}
function severity(sc){
 const p=P(),v=Object.values(sc).filter(observed).map(Number).sort((a,b)=>b-a);if(!v.length)return NaN;const avg=v.reduce((a,b)=>a+b,0)/v.length;
 const w1=observed(p.w1)?Number(p.w1):.4,w2=observed(p.w2)?Number(p.w2):.25,w3=observed(p.w3)?Number(p.w3):.15,wa=observed(p.wavg)?Number(p.wavg):.2;
 return Math.round(clamp(w1*(v[0]||0)+w2*(v[1]||0)+w3*(v[2]||0)+wa*avg));
}
function matrix(sc){
 const sens=SENS(),exp=EXP(),p=P(),protect=observed(p.protect)?Number(p.protect):1,out={};
 for(const [env,H] of Object.entries(sc)){const row=sens?.[env];if(!row)continue;out[env]={};for(const [eq,sv] of Object.entries(row)){const E=observed(exp?.[eq])?Number(exp[eq]):1;out[env][eq]=Math.round(clamp(Number(H)*(Number(sv)/100)*E*protect))}}
 return out;
}
function composites(sc){
 const r=R()||{},rh90=val('湿度','rh90_ratio'),so2=val('SO₂ / 腐蚀气体','so2_p95'),salt=sc.盐雾??r?.scores?.盐雾,cond=sc.凝露??r?.scores?.凝露,foul=sc.粉尘积灰??r?.scores?.粉尘积灰,high=sc.高温,alt=sc.高海拔;
 const corrosion=[salt,cond,observed(rh90)?lin(rh90,10,60):NaN,observed(so2)?lin(so2,10,100):NaN];const cw=[.45,.30,.15,.10];let cs=0,ws=0;corrosion.forEach((x,i)=>{if(observed(x)){cs+=Number(x)*cw[i];ws+=cw[i]}});
 const thermal=[[high,.45],[foul,.30],[alt,.25]].filter(x=>observed(x[0]));const ts=thermal.reduce((s,x)=>s+Number(x[0])*x[1],0),tw=thermal.reduce((s,x)=>s+x[1],0);
 return{corrosion:ws?Math.round(cs/ws):null,thermal:tw?Math.round(ts/tw):null};
}
function view(){
 const sc=scores(),cap=capability(),sev=severity(sc),gap=observed(sev)&&observed(cap.adapt)?Math.max(0,Math.round(sev-cap.adapt)):NaN,mat=matrix(sc),comp=composites(sc);
 return{version:'V3.3 Registry Risk',scores:sc,capability:cap,severity:sev,adapt:observed(cap.adapt)?Math.round(cap.adapt):null,gap:observed(gap)?gap:null,matrix:mat,composite:comp};
}
function mutateResult(v){
 const r=R();if(!r)return;
 r.scores={...v.scores};r.matrix=v.matrix;r.severity=v.severity;r.adapt=v.adapt;r.gap=v.gap;r.composite={...(r.composite||{}),...v.composite};r.capabilityChecks=v.capability.rows.map(x=>[x.name,x.valid,x.pass]);r.riskVersion=v.version;
}
function level(v){v=Number(v);return !finite(v)?'--':v>=80?'CRITICAL':v>=60?'HIGH':v>=30?'MEDIUM':'LOW'}
function renderRiskList(v){
 const box=document.getElementById('riskList');if(!box)return;const rows=Object.entries(v.scores).sort((a,b)=>b[1]-a[1]);
 box.innerHTML=rows.map(([k,x])=>'<div class="riskrow" data-v33-env="'+k+'"><div class="riskhead"><span>'+k+'</span><b>'+Math.round(x)+'</b></div><div class="riskActual">Registry V3.3 · '+level(x)+'</div><div class="bar"><i style="width:'+clamp(x)+'%"></i></div></div>').join('');
 box.querySelectorAll('[data-v33-env]').forEach(el=>el.onclick=()=>{try{if(typeof selectEnv==='function')selectEnv(el.dataset.v33Env)}catch{}});
}
function renderMatrix(v){
 const table=document.getElementById('matrix');if(!table)return;const envs=Object.keys(v.matrix),eqs=[...new Set(envs.flatMap(e=>Object.keys(v.matrix[e]||{})))];if(!envs.length||!eqs.length)return;
 const cls=x=>x>=60?'h':x>=30?'m':'l';
 table.innerHTML='<thead><tr><th>环境</th>'+eqs.map(e=>'<th>'+e+'</th>').join('')+'</tr></thead><tbody>'+envs.map(env=>'<tr><td class="rowhead">'+env+'</td>'+eqs.map(eq=>{const x=v.matrix[env]?.[eq]??0;return '<td><div tabindex="0" class="cell '+cls(x)+'" data-env="'+env+'" data-eq="'+eq+'">'+x+'</div></td>'}).join('')+'</tr>').join('')+'</tbody>';
}
function renderSummary(v){
 const sev=document.getElementById('severity'),ad=document.getElementById('adapt'),gap=document.getElementById('gap');if(sev)sev.textContent=observed(v.severity)?v.severity:'--';if(ad)ad.textContent=observed(v.adapt)?v.adapt:'--';if(gap)gap.textContent=observed(v.gap)?v.gap:'--';const badge=document.getElementById('riskBadge');if(badge){badge.textContent=!observed(v.adapt)?'能力数据不足':v.adapt<60?'设计能力明显不足':v.adapt<85?'存在能力缺口':'设计能力基本覆盖';badge.className='badge '+(observed(v.gap)&&v.gap>=20?'r':observed(v.gap)&&v.gap>=8?'a':'g')}const hero=document.getElementById('cockpitHeroDecision');if(hero){const topEnv=Object.entries(v.scores).sort((a,b)=>b[1]-a[1])[0]?.[0]||'--';hero.innerHTML='<div class="heroDecisionMain"><span>综合环境风险 · Registry V3.3</span><strong>'+(observed(v.severity)?v.severity:'--')+' <em>'+level(v.severity)+'</em></strong><p>仅基于有效且可追溯环境指标；无可靠阵风等指标不参与综合排序。</p></div><div class="heroDecisionJudgements"><div><span>环境严酷等级</span><b>'+level(v.severity)+'</b></div><div><span>Design Gap</span><b>'+(observed(v.gap)?v.gap:'--')+'</b></div><div><span>TOP1 环境风险</span><b>'+topEnv+'</b></div></div>'}
 const radar=document.getElementById('cockpitRadar');if(radar){const rows=Object.entries(v.scores);if(rows.length){const W=290,H=278,cx=145,cy=132,R=88,n=rows.length,pts=rad=>rows.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return (cx+rad*Math.cos(a)).toFixed(1)+','+(cy+rad*Math.sin(a)).toFixed(1)}).join(' '),data=rows.map(([,x],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,rr=R*clamp(x)/100;return (cx+rr*Math.cos(a)).toFixed(1)+','+(cy+rr*Math.sin(a)).toFixed(1)}).join(' '),axes=rows.map(([name],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a),lx=cx+(R+24)*Math.cos(a),ly=cy+(R+24)*Math.sin(a);return '<line x1="'+cx+'" y1="'+cy+'" x2="'+x+'" y2="'+y+'"/><text x="'+lx+'" y="'+ly+'" text-anchor="middle" dominant-baseline="middle">'+name+'</text>'}).join('');radar.innerHTML='<div class="cockpitRadarTitle"><b>风险雷达 · Registry V3.3</b><span>0–100</span></div><svg viewBox="0 0 '+W+' '+H+'"><g class="radarGrid"><polygon points="'+pts(R*.25)+'"/><polygon points="'+pts(R*.5)+'"/><polygon points="'+pts(R*.75)+'"/><polygon points="'+pts(R)+'"/>'+axes+'</g><polygon class="radarData" points="'+data+'"/></svg>'}}
 const top=document.getElementById('cockpitTopRiskBody');if(top){const rows=Object.entries(v.scores).sort((a,b)=>b[1]-a[1]).slice(0,3);top.innerHTML=rows.map(([env,H],i)=>{const pair=Object.entries(v.matrix?.[env]||{}).sort((a,b)=>b[1]-a[1])[0]||['--',0];return '<button class="cockpitRiskRank" data-env="'+env+'"><i>0'+(i+1)+'</i><div><b>'+env+'</b><span>'+pair[0]+' · 设备风险 '+pair[1]+'/100</span></div><strong>'+Math.round(H)+'<small>'+level(H)+'</small></strong></button>'}).join('')}
}
function sync(render=true){if(!A()?.prepareIndicator)return null;const v=view();mutateResult(v);window.GERiskV33.last=v;if(render){renderRiskList(v);renderMatrix(v);renderSummary(v)}return v}
const baseAssess=window.assess;if(typeof baseAssess==='function'&&!baseAssess.__riskV33){const wrapped=async function(){const out=await baseAssess.apply(this,arguments);try{sync(false);setTimeout(()=>sync(true),0)}catch(e){console.warn('[GE Risk V3.3] sync failed',e)}return out};wrapped.__riskV33=true;window.assess=wrapped}
document.addEventListener('ge:v33-data-updated',()=>setTimeout(()=>sync(true),0));
window.GERiskV33={installed:true,version:'3.3.0',sync,view,last:null};
setTimeout(()=>{try{if(R()?.scores&&A()?.prepareIndicator)sync(true)}catch{}},1800);
})();