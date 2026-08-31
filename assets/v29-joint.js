/* V2.9 风温联合分布：逐小时同时间戳温度 + 风速确定性统计，不使用AI生成底层数字。 */
(()=>{
'use strict';
const $j=id=>document.getElementById(id);
const DEF={tempHigh:35,windHigh:8,windLow:3,tempOp:'>=',windOp:'<=',tempBin:2,windBin:1};
let ui=loadUI(),latest=null,hoverBins=[];
function loadUI(){try{return{...DEF,...JSON.parse(localStorage.getItem('GE_V29_JOINT_UI')||'{}')}}catch{return{...DEF}}}
function saveUI(){localStorage.setItem('GE_V29_JOINT_UI',JSON.stringify(ui))}
function finite(v){return Number.isFinite(Number(v))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function paired(){
 const h=cache?.w?.j?.hourly||{},times=h.time||[],T=h.temperature_2m||[];
 let V=h.wind_speed_10m||[];
 if(!V.length&&Array.isArray(h.u10)&&Array.isArray(h.v10))V=h.u10.map((u,i)=>finite(u)&&finite(h.v10[i])?Math.hypot(Number(u),Number(h.v10[i])):NaN);
 const n=Math.min(times.length||T.length,T.length,V.length),out=[];
 for(let i=0;i<n;i++)if(finite(T[i])&&finite(V[i]))out.push({time:times[i]||String(i),t:Number(T[i]),v:Number(V[i])});
 return out;
}
function compare(v,op,lim){return op==='>='?v>=lim:v<=lim}
function yearsSpan(data){if(data.length<2)return data.length?1/365.2425:0;const a=Date.parse(data[0].time),b=Date.parse(data[data.length-1].time);if(Number.isFinite(a)&&Number.isFinite(b)&&b>=a)return Math.max((b-a+3600000)/(365.2425*24*3600000),1/365.2425);return Math.max(data.length/8766,1/365.2425)}
function stat(data,pred,ys){let n=0;for(const x of data)if(pred(x))n++;return{count:n,pct:data.length?100*n/data.length:0,annual:ys?n/ys:0}}
function calc(){
 const data=paired();if(data.length<24)return{ok:false,data,reason:'风温联合分析数据不足：温度与风速共同有效小时少于24h'};
 const ys=yearsSpan(data),t=Number(ui.tempHigh),wh=Number(ui.windHigh),wl=Number(ui.windLow);
 const highT=stat(data,x=>x.t>=t,ys),highW=stat(data,x=>x.v>=wh,ys),hh=stat(data,x=>x.t>=t&&x.v>=wh,ys),hl=stat(data,x=>x.t>=t&&x.v<=wl,ys);
 const general=stat(data,x=>compare(x.t,ui.tempOp,t)&&compare(x.v,ui.windOp,Number(ui.windGeneral??wl)),ys);
 const first=data[0].time,last=data[data.length-1].time;
 return{ok:true,data,ys,valid:data.length,first,last,highT,highW,hh,hl,general};
}
function inject(){
 if($j('jointCard'))return;
 const card=document.createElement('section');card.id='jointCard';card.className='card jointCard';card.innerHTML=`<div class="head"><h2>06 风温联合分布分析</h2><span>Wind–Temperature Joint Distribution · ERA5逐小时同时间戳</span></div><div class="pad jointPad"><div class="jointControls"><div class="jointCondition"><b>自定义联合条件</b><label>温度 <select id="jointTempOp"><option value=">=">≥</option><option value="<=">≤</option></select><input id="jointTemp" type="number" step="1"> ℃</label><label>风速 <select id="jointWindOp"><option value=">=">≥</option><option value="<=">≤</option></select><input id="jointWind" type="number" min="0" step="0.5"> m/s</label><button id="jointCalc">计算联合占比</button><div class="jointAnswer"><span>满足条件时间</span><strong id="jointAnnual">-- h/y</strong><span>时间占比</span><strong id="jointPct">-- %</strong><span>有效数据</span><strong id="jointValid">-- h</strong></div><p id="jointSentence">等待逐小时数据。</p></div><div class="jointQuick"><div class="jointQuickCard"><b>高温高风</b><label>T ≥ <input id="jointHHtemp" type="number" step="1"> ℃</label><label>V ≥ <input id="jointHHwind" type="number" min="0" step="0.5"> m/s</label><strong id="jointHHres">-- h/y ｜ --%</strong></div><div class="jointQuickCard hotlow"><b>高温低风</b><label>T ≥ <input id="jointHLtemp" type="number" step="1"> ℃</label><label>V ≤ <input id="jointHLwind" type="number" min="0" step="0.5"> m/s</label><strong id="jointHLres">-- h/y ｜ --%</strong></div></div></div><div class="jointChartWrap"><div class="jointChartTitle"><div><b>二维风温联合分布 Heatmap</b><span>温度 2℃/bin · 风速 1m/s/bin · 色深=时间占比</span></div><div class="jointLegend"><i></i>出现概率增加 <em></em>当前条件区域</div></div><div class="jointCanvasBox"><canvas id="jointCanvas"></canvas><div id="jointTip" class="jointTip"></div></div></div><div class="jointBottom"><div><table class="jointTable"><thead><tr><th>场景</th><th>条件</th><th>小时数 h/y</th><th>时间占比</th></tr></thead><tbody id="jointTableBody"></tbody></table><div class="jointMeta" id="jointMeta"></div></div><div class="jointConclusion"><b>风温联合工程结论</b><p id="jointConclusion">等待计算。</p></div></div></div>`;
 const primary=document.querySelector('#uiPrimaryGrid');if(primary)primary.after(card);else document.querySelector('.physicsCard')?.after(card);
 const mh=document.querySelector('.matrixCard .head h2'),dh=document.querySelector('.decisionCard .head h2');if(mh)mh.textContent='07 环境 × 设备风险矩阵';if(dh)dh.textContent='08 工程决策建议';
 const set=(id,v)=>{const e=$j(id);if(e)e.value=v};set('jointTemp',ui.tempHigh);set('jointHHtemp',ui.tempHigh);set('jointHLtemp',ui.tempHigh);set('jointHHwind',ui.windHigh);set('jointHLwind',ui.windLow);set('jointWind',ui.windGeneral??ui.windLow);$j('jointTempOp').value=ui.tempOp;$j('jointWindOp').value=ui.windOp;
 const update=()=>{ui.tempHigh=Number($j('jointTemp').value);ui.tempOp=$j('jointTempOp').value;ui.windGeneral=Number($j('jointWind').value);ui.windOp=$j('jointWindOp').value;saveUI();render()};
 ['jointTemp','jointWind','jointTempOp','jointWindOp'].forEach(id=>$j(id)?.addEventListener('change',update));$j('jointCalc')?.addEventListener('click',update);
 $j('jointHHtemp')?.addEventListener('input',e=>{ui.tempHigh=Number(e.target.value);$j('jointTemp').value=ui.tempHigh;$j('jointHLtemp').value=ui.tempHigh;saveUI();render()});
 $j('jointHLtemp')?.addEventListener('input',e=>{ui.tempHigh=Number(e.target.value);$j('jointTemp').value=ui.tempHigh;$j('jointHHtemp').value=ui.tempHigh;saveUI();render()});
 $j('jointHHwind')?.addEventListener('input',e=>{ui.windHigh=Math.max(0,Number(e.target.value));saveUI();render()});
 $j('jointHLwind')?.addEventListener('input',e=>{ui.windLow=Math.max(0,Number(e.target.value));if(ui.windOp==='<='){$j('jointWind').value=ui.windLow;ui.windGeneral=ui.windLow}saveUI();render()});
 window.addEventListener('resize',()=>{if(latest?.ok)draw(latest)});
 const canvas=$j('jointCanvas');canvas?.addEventListener('mousemove',tipMove);canvas?.addEventListener('mouseleave',()=>{$j('jointTip').style.display='none'});
}
function render(){inject();latest=calc();window.V29JointResult=latest;if(!latest.ok){['jointAnnual','jointPct','jointValid'].forEach(id=>{$j(id).textContent='--'});$j('jointSentence').textContent=latest.reason;$j('jointConclusion').textContent=latest.reason;$j('jointTableBody').innerHTML='';clearCanvas();return}
 const g=latest.general; $j('jointAnnual').textContent=`${g.annual.toFixed(0)} h/y`;$j('jointPct').textContent=`${g.pct.toFixed(2)} %`;$j('jointValid').textContent=`${latest.valid} h`;
 const T=Number(ui.tempHigh),V=Number(ui.windGeneral??ui.windLow),ts=ui.tempOp==='>='?'≥':'≤',vs=ui.windOp==='>='?'≥':'≤';$j('jointSentence').textContent=`T ${ts} ${T}℃ 且 V ${vs} ${V}m/s 的时间折算约为 ${g.annual.toFixed(0)} h/y，占共同有效统计时间 ${g.pct.toFixed(2)}%。`;
 $j('jointHHres').textContent=`${latest.hh.annual.toFixed(0)} h/y ｜ ${latest.hh.pct.toFixed(2)}%`;$j('jointHLres').textContent=`${latest.hl.annual.toFixed(0)} h/y ｜ ${latest.hl.pct.toFixed(2)}%`;
 const rows=[['高温',`T≥${T}℃`,latest.highT],['高风',`V≥${ui.windHigh}m/s`,latest.highW],['高温高风',`T≥${T}℃ & V≥${ui.windHigh}m/s`,latest.hh],['高温低风',`T≥${T}℃ & V≤${ui.windLow}m/s`,latest.hl]];
 $j('jointTableBody').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2].annual.toFixed(1)}</td><td>${r[2].pct.toFixed(2)}%</td></tr>`).join('');
 $j('jointMeta').innerHTML=`统计周期：<b>${esc(String(latest.first).slice(0,10))} ～ ${esc(String(latest.last).slice(0,10))}</b>　共同有效样本：<b>${latest.valid} h</b>　自定义联合累计：<b>${g.count} h</b>　折算周期：<b>${latest.ys.toFixed(2)} y</b>`;
 $j('jointConclusion').textContent=`项目折算年平均约有 ${latest.highT.annual.toFixed(0)}h 处于 T≥${T}℃ 环境，占共同有效时间 ${latest.highT.pct.toFixed(2)}%；其中高温低风 T≥${T}℃ 且 V≤${ui.windLow}m/s 约 ${latest.hl.annual.toFixed(0)}h/y，占比 ${latest.hl.pct.toFixed(2)}%。建议将该高温低风工况作为冷却系统高温设计、热平衡校核及高温满载验证的重点环境边界。`;
 draw(latest);}
function clearCanvas(){const c=$j('jointCanvas');if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height)}
function buildBins(r){const tb=2,vb=1,data=r.data;let tmin=Math.floor(Math.min(...data.map(x=>x.t))/tb)*tb,tmax=Math.ceil(Math.max(...data.map(x=>x.t))/tb)*tb+tb,vmin=0,vmax=Math.ceil(Math.max(...data.map(x=>x.v))/vb)*vb+vb;if(tmax-tmin<10){tmin-=4;tmax+=4}vmax=Math.max(10,vmax);const rows=Math.ceil((tmax-tmin)/tb),cols=Math.ceil((vmax-vmin)/vb),counts=Array.from({length:rows},()=>Array(cols).fill(0));for(const x of data){const ri=Math.floor((x.t-tmin)/tb),ci=Math.floor((x.v-vmin)/vb);if(ri>=0&&ri<rows&&ci>=0&&ci<cols)counts[ri][ci]++}return{tb,vb,tmin,tmax,vmin,vmax,rows,cols,counts}}
function draw(r){const c=$j('jointCanvas');if(!c||!r.ok)return;const box=c.parentElement,w=Math.max(320,box.clientWidth),h=Math.max(300,Math.min(470,260+w*.18)),dpr=Math.min(2,window.devicePixelRatio||1);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.width=w+'px';c.style.height=h+'px';const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);const B=buildBins(r),L=54,R=18,Tp=18,Bt=42,pw=w-L-R,ph=h-Tp-Bt,cw=pw/B.cols,ch=ph/B.rows,maxN=Math.max(1,...B.counts.flat());hoverBins=[];x.clearRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(0,0,w,h);
 for(let ri=0;ri<B.rows;ri++)for(let ci=0;ci<B.cols;ci++){const n=B.counts[ri][ci],pct=100*n/r.valid,alpha=n?0.12+0.78*Math.sqrt(n/maxN):0.025,px=L+ci*cw,py=Tp+(B.rows-1-ri)*ch,t0=B.tmin+ri*B.tb,v0=B.vmin+ci*B.vb,selected=compare(t0+B.tb/2,ui.tempOp,Number(ui.tempHigh))&&compare(v0+B.vb/2,ui.windOp,Number(ui.windGeneral??ui.windLow));x.fillStyle=n?`rgba(23,105,210,${alpha})`:'#F7F9FC';x.fillRect(px,py,Math.max(1,cw-.35),Math.max(1,ch-.35));if(selected){x.strokeStyle='#D9363E';x.lineWidth=selected?0.7:0;x.strokeRect(px+.3,py+.3,Math.max(0,cw-.8),Math.max(0,ch-.8))}hoverBins.push({x:px,y:py,w:cw,h:ch,t0,t1:t0+B.tb,v0,v1:v0+B.vb,n,pct})}
 x.strokeStyle='#94A3B8';x.lineWidth=1;x.beginPath();x.moveTo(L,Tp);x.lineTo(L,h-Bt);x.lineTo(w-R,h-Bt);x.stroke();x.fillStyle='#64748B';x.font='11px sans-serif';x.textAlign='right';for(let tv=Math.ceil(B.tmin/4)*4;tv<=B.tmax;tv+=4){const py=Tp+(B.tmax-tv)/ (B.tmax-B.tmin)*ph;x.fillText(tv+'℃',L-6,py+4)}x.textAlign='center';const step=B.cols>24?4:2;for(let vv=0;vv<=B.vmax;vv+=step){const px=L+(vv-B.vmin)/(B.vmax-B.vmin)*pw;x.fillText(vv,px,h-Bt+17)}x.fillText('风速 V / m·s⁻¹',L+pw/2,h-5);x.save();x.translate(12,Tp+ph/2);x.rotate(-Math.PI/2);x.fillText('温度 T / ℃',0,0);x.restore();
 // 明确画出用户阈值边界，不用颜色推断数值。
 const tx=L+(Number(ui.windGeneral??ui.windLow)-B.vmin)/(B.vmax-B.vmin)*pw,ty=Tp+(B.tmax-Number(ui.tempHigh))/(B.tmax-B.tmin)*ph;x.strokeStyle='#D9363E';x.lineWidth=2;x.setLineDash([5,4]);if(tx>=L&&tx<=w-R){x.beginPath();x.moveTo(tx,Tp);x.lineTo(tx,h-Bt);x.stroke()}if(ty>=Tp&&ty<=h-Bt){x.beginPath();x.moveTo(L,ty);x.lineTo(w-R,ty);x.stroke()}x.setLineDash([]);x.fillStyle='#D9363E';x.font='bold 11px sans-serif';x.textAlign='left';x.fillText(ui.tempOp==='>='&&ui.windOp==='<='?'高温低风风险区':'联合条件区域',L+7,Tp+14)}
function tipMove(e){const c=$j('jointCanvas'),tip=$j('jointTip');if(!c||!tip)return;const r=c.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,b=hoverBins.find(z=>px>=z.x&&px<z.x+z.w&&py>=z.y&&py<z.y+z.h);if(!b){tip.style.display='none';return}tip.innerHTML=`温度：${b.t0.toFixed(0)}～${b.t1.toFixed(0)}℃<br>风速：${b.v0.toFixed(0)}～${b.v1.toFixed(0)}m/s<br>时间：${b.n} h<br>占比：${b.pct.toFixed(3)}%`;tip.style.display='block';tip.style.left=Math.min(r.width-150,px+12)+'px';tip.style.top=Math.max(4,py-18)+'px'}
function extendReport(){if(typeof reportHtml!=='function'||reportHtml.__v29Joint)return;const base=reportHtml;const wrapped=function(){let html=base.apply(this,arguments),r=window.V29JointResult;if(!r?.ok)return html;const T=Number(ui.tempHigh),section=`<section class="page"><h2>风温联合分布分析（V2.9）</h2><div class="formula">Iᵢ=1，当 Tᵢ ${ui.tempOp==='>='?'≥':'≤'} ${T}℃ 且 Vᵢ ${ui.windOp==='>='?'≥':'≤'} ${Number(ui.windGeneral??ui.windLow)}m/s；否则 Iᵢ=0</div><div class="formula">Hjoint=ΣIᵢ·Δt，ERA5逐小时数据 Δt=1h；Pjoint=Hjoint/Hvalid×100%</div><table><tr><th>指标</th><th>结果</th></tr><tr><td>共同有效样本</td><td>${r.valid} h</td></tr><tr><td>自定义联合条件累计</td><td>${r.general.count} h</td></tr><tr><td>折算年均</td><td>${r.general.annual.toFixed(1)} h/y</td></tr><tr><td>联合时间占比</td><td>${r.general.pct.toFixed(2)}%</td></tr><tr><td>高温低风 T≥${T}℃ & V≤${ui.windLow}m/s</td><td>${r.hl.annual.toFixed(1)} h/y · ${r.hl.pct.toFixed(2)}%</td></tr></table><div class="note">联合概率严格使用同一小时的温度和风速有效样本配对，分母为温度与风速共同有效小时 Hvalid，不固定使用8760。</div></section>`;return html.replace('</body>',section+'</body>')};wrapped.__v29Joint=true;reportHtml=wrapped}
function init(){inject();const old=calculate;calculate=function(){const r=old.apply(this,arguments);render();return r};extendReport();if(cache)render()}
window.V29Joint={render,calc,get result(){return latest},get settings(){return ui}};init();
})();
