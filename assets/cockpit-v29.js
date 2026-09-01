/* V2.9 Engineering Cockpit UI adapter.
 * Presentation / information architecture only.
 * Reads existing result/cache/params/V29JointResult and moves existing DOM nodes.
 * DOES NOT change APIs, formulas, scores, parameters, database or calculation logic.
 */
(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const finite=v=>Number.isFinite(Number(v));
const fmt=(v,n=1)=>finite(v)?Number(v).toFixed(n):'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unit=(v,n,u)=>`${fmt(v,n)}<small>${u}</small>`;
function band(v){v=Number(v)||0;return v>=80?['CRITICAL','critical']:v>=60?['HIGH','high']:v>=30?['MEDIUM','medium']:['LOW','low']}
function hasResult(){try{return !!result?.base}catch{return false}}
function safeResult(){try{return result||{}}catch{return {}}}
function safeCache(){try{return cache||null}catch{return null}}
function safeCurrent(){try{return current||{}}catch{return {}}}

function renameHeads(){
 const names=[['.mapCard','项目定位','项目位置 · 经纬度 · 地图'],['.summaryCard','综合评估','严酷度 · Gap · TOP风险'],['.envCard','核心环境数据','真实环境工程量 KPI'],['.riskCard','环境风险画像','风险分布 · TOP排序'],['.physicsCard','六大物理模型','核心工程指标 · 设计判定'],['.matrixCard','环境 × 设备风险矩阵','R = H × S × E × P'],['.decisionCard','Engineering Decision','失效链 · Gap · 措施 · 验证']];
 names.forEach(([sel,a,b])=>{const c=q(sel),h=q('.head h2',c),s=q('.head span',c);if(h)h.textContent=a;if(s)s.textContent=b});
 const joint=q('#jointCard');if(joint){const h=q('.head h2',joint),s=q('.head span',joint);if(h)h.textContent='风温联合分布';if(s)s.textContent='逐小时温度 × 同时刻风速'}
}

function ensureLayout(){
 const dash=q('#mainPage .dashboard');if(!dash)return;
 document.body.classList.add('cockpit-v29');
 let shell=q('#cockpitLayout');
 if(!shell){
  shell=document.createElement('div');shell.id='cockpitLayout';shell.className='cockpitLayout';dash.prepend(shell);
  const hero=document.createElement('div');hero.className='cockpitHero';hero.id='cockpitHero';
  const envWrap=document.createElement('div');envWrap.className='cockpitSection cockpitEnvSection';envWrap.id='cockpitEnvSection';
  const analysis=document.createElement('div');analysis.className='cockpitAnalysis';analysis.id='cockpitAnalysis';
  const physics=document.createElement('div');physics.className='cockpitSection';physics.id='cockpitPhysicsSection';
  const matrix=document.createElement('div');matrix.className='cockpitSection';matrix.id='cockpitMatrixSection';
  const decision=document.createElement('div');decision.className='cockpitDecision';decision.id='cockpitDecision';
  const sources=document.createElement('section');sources.className='cockpitSources';sources.id='cockpitSources';sources.innerHTML='<div class="cockpitSectionTitle"><div><h2>数据源与更新时间</h2><p>ERA5 / CAMS / Marine / Elevation · 状态与数据周期</p></div><div id="cockpitUpdateMeta">等待数据</div></div><div id="cockpitSourceBody"></div>';
  shell.append(hero,envWrap,analysis,physics,matrix,decision,sources);
 }
 const hero=q('#cockpitHero'),envWrap=q('#cockpitEnvSection'),analysis=q('#cockpitAnalysis'),physics=q('#cockpitPhysicsSection'),matrixWrap=q('#cockpitMatrixSection'),decision=q('#cockpitDecision');
 const map=q('.mapCard'),sum=q('.summaryCard'),env=q('.envCard'),risk=q('.riskCard'),phys=q('.physicsCard'),mat=q('.matrixCard'),dec=q('.decisionCard'),joint=q('#jointCard');
 if(map&&map.parentElement!==hero)hero.append(map);
 if(sum&&sum.parentElement!==hero)hero.append(sum);
 if(env&&env.parentElement!==envWrap)envWrap.append(env);
 if(risk&&risk.parentElement!==analysis)analysis.append(risk);
 if(joint&&joint.parentElement!==analysis)analysis.append(joint);
 if(phys&&phys.parentElement!==physics)physics.append(phys);
 if(mat&&mat.parentElement!==matrixWrap)matrixWrap.append(mat);
 if(dec&&dec.parentElement!==decision){
   let top=q('#cockpitTopRisks');if(!top){top=document.createElement('section');top.id='cockpitTopRisks';top.className='card cockpitTopRisks';top.innerHTML='<div class="head"><h2>TOP 3 Engineering Risks</h2><span>环境 → 设备</span></div><div class="pad" id="cockpitTopRiskBody">等待计算</div>';decision.append(top)}
   decision.append(dec);
 }
 const summary=q('#uiDecisionSummary');const sp=q('.summaryCard .pad');if(summary&&sp&&summary.parentElement!==sp)sp.prepend(summary);
 const source=q('#sourceStatusGrid');const sb=q('#cockpitSourceBody');if(source&&sb&&source.parentElement!==sb)sb.append(source);
 q('#uiPrimaryGrid')?.classList.add('cockpitLegacyEmpty');q('#uiProjectSupport')?.classList.add('cockpitLegacyEmpty');
 prepareEnv();prepareRisk();preparePhysics();prepareDecision();renameHeads();
}

function prepareEnv(){
 const env=q('.envCard'),pad=q('.pad',env);if(!pad)return;
 let grid=q('#cockpitKpiGrid');if(!grid){grid=document.createElement('div');grid.id='cockpitKpiGrid';grid.className='cockpitKpiGrid';pad.prepend(grid)}
 q('#l1bar',env)?.classList.add('cockpitHiddenSupport');q('.envDetails',env)?.classList.add('cockpitHiddenSupport');q('#sourceStatusGrid',env)?.classList.add('cockpitMovedSource');
}
function prepareRisk(){
 const card=q('.riskCard'),pad=q('.pad',card);if(!pad)return;
 let body=q('#cockpitRiskBody');if(!body){body=document.createElement('div');body.id='cockpitRiskBody';body.className='cockpitRiskBody';const radar=document.createElement('div');radar.id='cockpitRadar';radar.className='cockpitRadar';const list=q('#riskList');if(list){list.before(body);body.append(radar,list)}}
}
function preparePhysics(){
 const card=q('.physicsCard'),pad=q('.pad',card);if(!pad)return;
 let grid=q('#cockpitPhysCards');if(!grid){grid=document.createElement('div');grid.id='cockpitPhysCards';grid.className='cockpitPhysCards';pad.prepend(grid)}
 q('.physGrid',card)?.classList.add('cockpitHiddenSupport');q('#uiModelWrap',card)?.classList.add('cockpitHiddenSupport');
}
function prepareDecision(){
 const dec=q('.decisionCard'),pad=q('.pad',dec);if(!pad)return;
 q('.decisionTop',dec)?.classList.add('cockpitHiddenSupport');
 const table=q('#decisionTableWrap',dec);if(table&&!table.closest('details.cockpitDecisionDetails')){const d=document.createElement('details');d.className='cockpitDecisionDetails';const s=document.createElement('summary');s.textContent='查看完整工程措施表';table.before(d);d.append(s,table)}
}

function kpiCard(title,value,label,items,status=''){
 return `<article class="cockpitKpi"><div class="cockpitKpiTop"><span>${esc(title)}</span>${status?`<em>${esc(status)}</em>`:''}</div><div class="cockpitKpiValue">${value}</div><div class="cockpitKpiLabel">${esc(label)}</div><div class="cockpitKpiItems">${items.map(x=>`<div><span>${esc(x[0])}</span><b>${x[1]}</b></div>`).join('')}</div></article>`;
}
function renderKpis(){
 const box=q('#cockpitKpiGrid');if(!box)return;if(!hasResult()){box.innerHTML=Array.from({length:8},(_,i)=>kpiCard(['温度','湿度','风速','降雨','海拔','盐雾','PM10','SO₂'][i],'--','等待真实数据',[['状态','等待评估']] )).join('');return}
 const r=safeResult(),b=r.base||{},c=r.condensation||{},s=r.salt||{},d=r.dust||{};
 const kpis=[
  kpiCard('温度',unit(b.t99,1,'℃'),'Temperature P99',[['极端低温',unit(b.tmin,1,'℃')],['平均温度',unit(b.tavg,1,'℃')],['P95日温差',unit(b.dayRange,1,'K')],['P95温变',unit(b.tempRate,1,'K/h')]],band(r.scores?.高温)[0]),
  kpiCard('湿度',unit(b.rhMean,1,'%'),'Relative Humidity Mean',[['RH>90%',unit(b.rh90,1,'%')],['绝对湿度',unit(b.absHumMean,1,'g/m³')],['凝露时间',unit(c.annualCondHours,0,'h/y')],['最低露点裕量',unit(c.minMargin,2,'K')]],band(r.scores?.凝露)[0]),
  kpiCard('风速',unit(b.gust99,1,'m/s'),'P99 Gust / Proxy',[['平均风速',unit(b.windMean,1,'m/s')],['设计阵风',unit(typeof params!=='undefined'?params.capWind:NaN,0,'m/s')],['极端风风险',`${fmt(r.scores?.极端风,0)}<small>/100</small>`]],band(r.scores?.极端风)[0]),
  kpiCard('降雨',unit(b.rainMax,1,'mm/d'),'Maximum Daily Rain',[['P99小时雨',unit(b.rainP99h,2,'mm/h')],['年降雨',unit(b.rainAnnual,0,'mm/y')],['强降雨风险',`${fmt(r.scores?.强降雨,0)}<small>/100</small>`]],band(r.scores?.强降雨)[0]),
  kpiCard('海拔',unit(b.elev,0,'m'),'Elevation',[['平均气压',unit(finite(b.pressureMean)?b.pressureMean/10:NaN,1,'kPa')],['高海拔风险',`${fmt(r.scores?.高海拔,0)}<small>/100</small>`],['能力上限',unit(typeof params!=='undefined'?params.capAltitude:NaN,0,'m')]],band(r.scores?.高海拔)[0]),
  kpiCard('盐雾',unit(s.jcl,2,'mg/m²·d'),'Cl⁻ Deposition',[['TOW',unit(s.towPct,1,'%')],['Sea Salt P95',unit(s.sea95,2,'μg/m³')],['盐雾风险',`${fmt(r.scores?.盐雾,0)}<small>/100</small>`]],band(r.scores?.盐雾)[0]),
  kpiCard('PM10',unit(d.pm95,1,'μg/m³'),'PM10 P95',[['PM10均值',unit(d.pmMean,1,'μg/m³')],['年进入质量',unit(d.annualIn,1,'kg/y')],['积灰风险',`${fmt(r.scores?.粉尘积灰,0)}<small>/100</small>`]],band(r.scores?.粉尘积灰)[0]),
  kpiCard('SO₂',unit(s.so295,1,'μg/m³'),'SO₂ P95',[['设计参考',unit(typeof params!=='undefined'?params.capSo2:NaN,0,'μg/m³')],['腐蚀复合风险',`${fmt(r.composite?.corrosion,0)}<small>/100</small>`],['数据源','CAMS Global']],band(r.composite?.corrosion)[0])
 ];box.innerHTML=kpis.join('');
}

function renderProjectSummary(){
 const card=q('.summaryCard'),pad=q('.pad',card);if(!pad)return;let meta=q('#cockpitProjectMeta');if(!meta){meta=document.createElement('div');meta.id='cockpitProjectMeta';meta.className='cockpitProjectMeta';pad.append(meta)}
 const cur=safeCurrent(),ca=safeCache(),parts=String(cur.name||'--').split(/\s*[·,]\s*/).filter(Boolean),region=parts.slice(1).join(' · ')||'--';
 meta.innerHTML=`<div><span>项目名称</span><b>${esc(parts[0]||cur.name||'--')}</b></div><div><span>国家 / 区域</span><b>${esc(region)}</b></div><div><span>经纬度</span><b>${finite(cur.lat)?Number(cur.lat).toFixed(4):'--'}, ${finite(cur.lon)?Number(cur.lon).toFixed(4):'--'}</b></div><div><span>数据更新时间</span><b>${esc(ca?.w?.end||'--')}</b></div>`;
}

function radarSvg(scores){
 const rows=Object.entries(scores||{});if(!rows.length)return '<div class="cockpitEmpty">等待风险计算</div>';
 const W=290,H=278,cx=145,cy=132,R=88,n=rows.length,pts=(rad)=>rows.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return `${(cx+rad*Math.cos(a)).toFixed(1)},${(cy+rad*Math.sin(a)).toFixed(1)}`}).join(' ');
 const data=rows.map(([_,v],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,rr=R*Math.max(0,Math.min(100,Number(v)||0))/100;return `${(cx+rr*Math.cos(a)).toFixed(1)},${(cy+rr*Math.sin(a)).toFixed(1)}`}).join(' ');
 const axes=rows.map(([name],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a),lx=cx+(R+24)*Math.cos(a),ly=cy+(R+24)*Math.sin(a);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${esc(name)}</text>`}).join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="环境风险雷达图"><g class="radarGrid"><polygon points="${pts(R*.25)}"/><polygon points="${pts(R*.5)}"/><polygon points="${pts(R*.75)}"/><polygon points="${pts(R)}"/>${axes}</g><polygon class="radarData" points="${data}"/></svg>`;
}
function renderRadar(){const box=q('#cockpitRadar');if(!box)return;const r=safeResult();box.innerHTML=`<div class="cockpitRadarTitle"><b>风险雷达</b><span>0–100</span></div>${radarSvg(r.scores)}`}

function renderPhysicsCards(){
 const out=q('#cockpitPhysCards'),body=q('#uiModelBody');if(!out)return;if(!body||!body.children.length){out.innerHTML='<div class="cockpitEmpty">等待物理模型计算</div>';return}
 out.innerHTML=qa('tr',body).map(tr=>{const td=qa('td',tr);if(td.length<6)return'';const btn=q('[data-model]',tr),id=btn?.dataset.model||'',name=td[0].textContent.trim(),risk=td[1].textContent.trim(),key=td[2].textContent.trim(),limit=td[3].textContent.trim(),judge=td[4].textContent.trim();const parts=key.split(/[；;]/).map(x=>x.trim()).filter(Boolean),core=parts.shift()||key,cls=judge.includes('不满足')?'fail':'pass';return `<article class="cockpitPhysCard ${cls}"><div class="cockpitPhysHead"><div><h3>${esc(name)}</h3><span>${esc(risk)}</span></div><em>${esc(judge)}</em></div><div class="cockpitPhysCore">${esc(core)}</div><div class="cockpitPhysAux">${parts.slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="cockpitPhysLimit"><span>设计限值</span><b>${esc(limit)}</b></div><button class="cockpitDetail" data-cockpit-model="${esc(id)}">查看详情</button></article>`}).join('');
 qa('[data-cockpit-model]',out).forEach(b=>b.onclick=()=>q(`#uiModelBody [data-model="${CSS.escape(b.dataset.cockpitModel)}"]`)?.click());
}

function renderTopRisks(){
 const box=q('#cockpitTopRiskBody');if(!box)return;const r=safeResult();if(!r.scores){box.innerHTML='等待计算';return}const rows=Object.entries(r.scores).sort((a,b)=>b[1]-a[1]).slice(0,3);box.innerHTML=rows.map(([env,H],i)=>{const pair=Object.entries(r.matrix?.[env]||{}).sort((a,b)=>b[1]-a[1])[0]||['--',0],b=band(H);return `<button class="cockpitRiskRank" data-env="${esc(env)}"><i>0${i+1}</i><div><b>${esc(env)}</b><span>${esc(pair[0])} · 设备风险 ${pair[1]}/100</span></div><strong>${H}<small>${b[0]}</small></strong></button>`}).join('');qa('.cockpitRiskRank',box).forEach(x=>x.onclick=()=>{try{if(typeof selectEnv==='function')selectEnv(x.dataset.env)}catch{}})
}

function renderJointStats(){
 const card=q('#jointCard');if(!card)return;let stats=q('#cockpitJointStats');const pad=q('.jointPad',card);if(!stats&&pad){stats=document.createElement('div');stats.id='cockpitJointStats';stats.className='cockpitJointStats';pad.prepend(stats)}if(!stats)return;
 let r;try{r=window.V29JointResult}catch{r=null}if(!r?.ok){stats.innerHTML='<div><span>高温时间</span><b>--</b><small>等待逐小时共同有效数据</small></div><div><span>高温高风</span><b>--</b><small>等待计算</small></div><div><span>高温低风</span><b>--</b><small>等待计算</small></div>';return}
 const t=q('#jointHHtemp')?.value||35,wh=q('#jointHHwind')?.value||8,wl=q('#jointHLwind')?.value||3;
 const item=(name,cond,x)=>`<div><span>${esc(name)}</span><b>${fmt(x.annual,0)} <small>h/y</small></b><strong>${fmt(x.pct,2)}%</strong><small>${esc(cond)}</small></div>`;
 stats.innerHTML=item('高温时间',`T ≥ ${t}℃`,r.highT)+item('高温高风',`T ≥ ${t}℃ 且 V ≥ ${wh}m/s`,r.hh)+item('高温低风',`T ≥ ${t}℃ 且 V ≤ ${wl}m/s`,r.hl);
}

function renderSourcesMeta(){const box=q('#cockpitUpdateMeta'),ca=safeCache();if(box)box.innerHTML=ca?.w?`ERA5 <b>${esc(ca.w.start)} ~ ${esc(ca.w.end)}</b> · 最近刷新 ${esc(ca.w.end)}`:'等待真实数据评估'}

function renderAll(){
 ensureLayout();renderKpis();renderProjectSummary();renderRadar();renderPhysicsCards();renderTopRisks();renderJointStats();renderSourcesMeta();
 // V2.9.1 reads the completed engineering summary rendered by ui-engineering.
 // Refresh it after the core result adapter finishes so the visible hero and
 // Engineering Decision do not remain in their initial "waiting" state.
 queueMicrotask(()=>window.CockpitScientific?.refresh?.());
}

function setupAdmin(){
 const admin=q('#adminPage');if(!admin||admin.dataset.cockpitAdmin)return;admin.dataset.cockpitAdmin='1';
 const state=q('#v29ParamState',admin);if(state)state.classList.add('cockpitAdminState');
 const cards=qa('.adminCard',admin);let layout=document.createElement('div');layout.className='cockpitAdminLayout';let aside=document.createElement('aside');aside.className='cockpitAdminNav';let work=document.createElement('main');work.className='cockpitAdminWork';layout.append(aside,work);admin.append(layout);cards.forEach(c=>work.append(c));
 q('.adminGrid',admin)?.classList.add('cockpitLegacyEmpty');q('.lockBanner',admin)?.classList.add('cockpitHiddenSupport');
 const groups=[['status','参数状态'],['cond','凝露模型'],['salt','盐雾腐蚀'],['dust','粉尘积灰'],['erosion','沙蚀模型'],['thermal','热管理'],['extreme','雨雪极端风'],['cap','设计能力'],['risk','风险阈值'],['data','数据源'],['version','版本管理']];
 function groupFor(card){const t=q('h3',card)?.textContent||'';if(t.includes('凝露'))return'cond';if(t.includes('盐雾'))return'salt';if(t.includes('沙尘 / 沙蚀设备'))return'erosion';if(t.includes('粉尘 / 沙蚀扩展'))return'dust';if(t.includes('雨雪 / 高海拔'))return'extreme';if(t.includes('设计能力 / 判据'))return'thermal';if(t.includes('设计能力扩展'))return'cap';if(t.includes('环境风险阈值')||t.includes('风险模型系数'))return'risk';if(t.includes('地图数据源')||t.includes('数据适用性'))return'data';return'cap'}
 cards.forEach(c=>c.dataset.adminGroup=groupFor(c));
 aside.innerHTML='<div class="cockpitAdminNavTitle">参数分类</div>'+groups.map(([k,n],i)=>`<button data-admin-tab="${k}" class="${i===0?'active':''}">${n}</button>`).join('');
 function show(k){qa('[data-admin-tab]',aside).forEach(b=>b.classList.toggle('active',b.dataset.adminTab===k));cards.forEach(c=>c.hidden=!(k==='status'||k==='version')&&c.dataset.adminGroup!==k);if(k==='status'||k==='version')cards.forEach(c=>c.hidden=true);if(state){state.classList.toggle('cockpitAdminFocus',k==='status'||k==='version');state.scrollIntoView({behavior:'smooth',block:'start'})}}
 qa('[data-admin-tab]',aside).forEach(b=>b.onclick=()=>show(b.dataset.adminTab));show('status');
 const acts=q('.v29ManageActions',state);if(acts&&!q('.cockpitAdminMore',acts)){const btns=qa('button',acts);if(btns.length>3){const d=document.createElement('details');d.className='cockpitAdminMore';d.innerHTML='<summary>更多参数操作</summary><div class="cockpitAdminMoreBody"></div>';const body=q('.cockpitAdminMoreBody',d);btns.slice(3).forEach(b=>body.append(b));acts.append(d)}}
 q('.adminActions',admin)?.classList.add('cockpitAdminBottom');
}

function hook(){
 try{if(typeof render==='function'&&!render.__cockpit){const old=render;const wrapped=function(){const x=old.apply(this,arguments);queueMicrotask(renderAll);return x};wrapped.__cockpit=true;render=wrapped}}catch(e){console.warn('Cockpit render hook skipped',e)}
 const joint=q('#jointCard');if(joint&&!joint.dataset.cockpitObserved){joint.dataset.cockpitObserved='1';let scheduled=false;new MutationObserver(records=>{const own=r=>{const el=r.target?.nodeType===1?r.target:r.target?.parentElement;return !!el?.closest?.('#cockpitJointStats')};if(records.length&&records.every(own))return;if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;renderJointStats()},0)}).observe(joint,{childList:true,subtree:true,characterData:true})}
 const admin=q('#adminPage');if(admin&&!q('#v29ParamState',admin)){new MutationObserver(()=>{if(q('#v29ParamState',admin))setupAdmin()}).observe(admin,{childList:true,subtree:true})}
}
function init(){ensureLayout();setupAdmin();hook();renderAll();setTimeout(()=>{ensureLayout();setupAdmin();hook();renderAll()},300);setTimeout(renderAll,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
