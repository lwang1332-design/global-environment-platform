/* V3: isolated 02 diagnostic module. No changes to scenario matching algorithms. */
(function(){
'use strict';
const FIELDS=[["温度","极端高温","℃","t99","ERA5"],["温度","极端低温","℃","tmin","ERA5"],["温度","平均温度","℃"],["温度","日温差P95","K"],["温度","温变速率P95","K/h"],["湿度","RH均值","%","rhAvg","ERA5"],["湿度","RH>80%时长","h/y"],["湿度","凝露概率","%"],["湿度","凝露时长","h/y"],["湿度","最大连续凝露","h"],["风速","年平均风速","m/s"],["风速","风速P99","m/s"],["风速","年强阵风事件频次","次/y"],["风速","风速–降雨联合时长","h/y"],["风速","风速–沙尘联合时长","h/y"],["降雨","年降雨量","mm/y","rainYear","ERA5"],["降雨","强降雨最大日值","mm/d"],["降雨","P99小时降雨","mm/h"],["降雨","风驱雨联合指数P99","mm·m/(h·s)"],["降雨","最长连续降雨时长","h"],["盐雾","盐沉积","mg/(m²·d)"],["盐雾","盐气溶胶P95","μg/m³"],["盐雾","湿盐膜/TOW","%"],["盐雾","海盐腐蚀风险","分(0–100)"],["盐雾","环境腐蚀等级","类别（C2/C3/C4/C5/CX）"],["沙尘","PM10 P95","μg/m³"],["沙尘","PM2.5 P95","μg/m³"],["沙尘","矿物沙尘浓度P95（Dust）","μg/m³"],["沙尘","年均沙尘暴频次","次/y"],["沙尘","年沙尘暴持续时间","h/y"],["冰雪","最大积雪深度","cm"],["冰雪","降雪最大日值","cm/d"],["冰雪","年降雪小时数","h/y","snowHours","ERA5"],["冰雪","年冻融循环次数","次/y"],["冰雪","年积雪覆盖天数","d/y"],["海拔","海拔","m","alt","DEM"],["海拔","年平均大气压力","kPa"],["海拔","最低大气压力","kPa"],["海拔","年平均空气密度","kg/m³"],["海拔","最低空气密度","kg/m³"],["有害气体","SO₂浓度","μg/m³","so2","CAMS"],["有害气体","H₂S浓度","μg/m³"],["有害气体","Cl₂浓度","μg/m³"],["有害气体","NO₂浓度","μg/m³"],["有害气体","NH₃浓度","μg/m³"],["其它环境","周围植被类型","类别（可附占比%）"],["其它环境","太阳辐照","W/m²","rad95","ERA5"],["其它环境","台风","次/y"],["其它环境","雷电","次/(km²·y)"],["其它环境","生物","无量纲"]];
const STORAGE='ea-health-v3-verified';
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const q=(a,p)=>{const z=(a||[]).filter(valid).sort((x,y)=>x-y);if(!z.length)return null;const t=(z.length-1)*p,k=Math.floor(t);return z[k]+(z[Math.min(k+1,z.length-1)]-z[k])*(t-k)};
const mean=a=>{const z=(a||[]).filter(valid);return z.length?z.reduce((s,x)=>s+x,0)/z.length:null};
const max=a=>{const z=(a||[]).filter(valid);return z.length?Math.max(...z):null};
const min=a=>{const z=(a||[]).filter(valid);return z.length?Math.min(...z):null};
const count=(a,p)=>a.reduce((n,v,i)=>n+(p(v,i)?1:0),0);
const ann=(n,validHours)=>validHours?n/validHours*8760:null;
const days=(a,fn)=>{let out=[];for(let i=0;i<a.length;i+=24){const z=a.slice(i,i+24);if(z.filter(valid).length>=18)out.push(fn(z.filter(valid)))}return out};
const events=(a,hit)=>{let on=false,n=0;for(let i=0;i<a.length;i++){const ok=hit(a[i],i);if(ok&&!on)n++;on=ok}return n};
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records={},lastContext='';
const loc=()=>[document.getElementById('lat')?.value,document.getElementById('lon')?.value,document.getElementById('periodYears')?.value].join('|');
const add=(i,v,source,rule,quality='计算',period='项目统计期')=>{
  records[i]={value:valid(v)?v:(typeof v==='string'?v:null),source,rule,quality,period};
};
/* ERA5-Land supplementary series are optional; failure must not block primary ERA5. */
const oldWeather=loadWeather;
loadWeather=async function(lat,lon,years){
 const base=await oldWeather(lat,lon,years);
 try{
  const u='https://archive-api.open-meteo.com/v1/archive?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&start_date='+base.start+'&end_date='+base.end+'&hourly=snow_depth,wind_gusts_10m&wind_speed_unit=ms&timezone=UTC&models=era5_land';
  const response=await fetch(u);if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(data.error)throw Error(data.reason||'ERA5-Land error');
  const depth=data.hourly?.snow_depth||[],gust=data.hourly?.wind_gusts_10m||[];
  if(depth.length===base.h.temperature_2m.length)base.h.snow_depth=depth;
  if(gust.length===base.h.temperature_2m.length)base.h.wind_gusts_10m=gust;
  base.secondaryStatus='ERA5-Land补充成功';
 }catch(e){base.secondaryStatus='ERA5-Land补充失败：'+e.message;console.warn(base.secondaryStatus)}
 return base;
};
const oldDerive=derive;
derive=function(h,a,elev){
 oldDerive(h,a,elev);
 records={};lastContext=loc();
 const T=h.temperature_2m||[],RH=h.relative_humidity_2m||[],P=h.precipitation||[],RAIN=h.rain||[],W=h.wind_speed_10m||[],G=h.wind_gusts_10m||[],SF=h.snowfall||[],SD=h.snow_depth||[],WC=h.weather_code||[],BP=h.surface_pressure||[],RAD=h.shortwave_radiation||[],D=h.dew_point_2m||[];
 const n=T.length,period='ERA5选定统计期',aPeriod='CAMS最近90天';
 let diff=[];for(let i=1;i<n;i++)if(valid(T[i])&&valid(T[i-1]))diff.push(Math.abs(T[i]-T[i-1]));
 add(1,q(days(T,z=>max(z)),.99),'ERA5','逐日最高气温P99','再分析',period);
 add(2,min(T),'ERA5','逐日最低气温最小值','再分析',period);
 add(3,mean(T),'ERA5','有效小时平均值','再分析',period);
 add(4,q(days(T,z=>max(z)-min(z)),.95),'ERA5','逐日最高-最低温差P95','再分析',period);
 add(5,q(diff,.95),'ERA5','相邻小时绝对温差P95','再分析',period);
 add(6,mean(RH),'ERA5','相对湿度小时均值','再分析',period);
 add(7,ann(count(RH,x=>valid(x)&&x>80),RH.filter(valid).length),'ERA5','RH>80%小时数年化','再分析',period);
 for(const i of [8,9,10])add(i,null,'需设备表面温度','露点与设备壁温联合判定，禁止用近饱和率冒充凝露','专项缺口');
 add(11,mean(W),'ERA5','10m风速小时均值','再分析',period);
 add(12,q(W,.99),'ERA5','10m风速P99','再分析',period);
 add(13,ann(events(G,x=>valid(x)&&x>=25),G.filter(valid).length),'ERA5','阵风≥25m/s连续小时合并事件；筛查阈值可调整','代理',period);
 const joint=(pred)=>{let total=0,yes=0;for(let i=0;i<n;i++)if(valid(W[i])&&valid(P[i])){total++;if(pred(i))yes++}return ann(yes,total)};
 add(14,joint(i=>W[i]>=12&&P[i]>=0.1),'ERA5','同期风速≥12m/s且小时降水≥0.1mm；工程筛查口径','代理',period);
 add(15,null,'需同期风沙历史数据','CAMS近90天不与ERA5多年逐时强制拼接','专项缺口');
 add(16,ann(RAIN.filter(valid).reduce((s,x)=>s+x,0),RAIN.filter(valid).length),'ERA5','统计期逐小时降雨量折合年值','再分析',period);
 add(17,max(days(P,z=>z.reduce((s,x)=>s+x,0))),'ERA5','逐日降水量最大值','再分析',period);
 add(18,q(P,.99),'ERA5','全小时样本（含无雨小时）降雨量P99','再分析',period);
 const wr=[];for(let i=0;i<n;i++)if(valid(W[i])&&valid(P[i]))wr.push(W[i]*P[i]);
 add(19,q(wr,.99),'ERA5','同期小时风速×降水量P99','代理',period);
 const fr=WC.some(x=>x===66||x===67),hasCodes=WC.some(valid);
 add(20,RAIN.filter(valid).length?(()=>{let longest=0,run=0;for(const v of RAIN){run=valid(v)&&v>0?run+1:0;longest=Math.max(longest,run)}return longest})():null,'ERA5','统计期最长连续降雨小时数，非年化','再分析',period);
 add(21,null,'需盐沉积采样','单位面积日盐沉积通量不能由海盐浓度直接代替','专项缺口');
 add(22,q(a.sea_salt_aerosol,.95),'CAMS','90天海盐气溶胶小时浓度P95','再分析',aPeriod);
 add(23,RH.filter(valid).length?100*count(RH,x=>valid(x)&&x>80)/RH.filter(valid).length:null,'ERA5','RH>80%比例（TOW代理，非ISO正式TOW）','代理',period);
 add(24,null,'需验证的腐蚀风险模型','缺乏盐沉积、SO₂沉积及实际湿润时间','专项缺口');
 add(25,null,'ISO 9223专项评定','不得凭海盐气溶胶直接给出C等级','专项缺口');
 add(26,q(a.pm10,.95),'CAMS','90天PM10小时P95','再分析',aPeriod);
 add(27,q(a.pm2_5,.95),'CAMS','90天PM2.5小时P95','再分析',aPeriod);
 add(28,q(a.dust,.95),'CAMS','90天矿物沙尘小时P95','再分析',aPeriod);
 add(29,null,'需沙尘暴事件数据库','应依据沙尘天气与能见度，而非浓度单独判断','专项缺口');
 add(30,null,'需沙尘暴事件数据库','沙尘暴持续时间需事件判据','专项缺口');
 add(31,valid(max(SD))?max(SD)*100:null,'ERA5','积雪深度m转cm；网格模式值','再分析',period);
 add(32,max(days(SF,z=>z.reduce((s,x)=>s+x,0))),'ERA5','逐日降雪深度最大值；Open-Meteo snowfall单位cm','再分析',period);
 add(33,ann(count(SF,x=>valid(x)&&x>0),SF.filter(valid).length),'ERA5','有降雪小时数年化','再分析',period);
 let crossings=0;for(let i=1;i<n;i++)if(valid(T[i])&&valid(T[i-1])&&T[i-1]<0&&T[i]>=0)crossings++;
 add(34,ann(crossings,T.filter(valid).length),'ERA5','气温过零上穿年化次数，材料实际冻融仅供参考','代理',period);
 add(35,SD.filter(valid).length?ann(count(days(SD,z=>max(z)),v=>v>0.01)*24,SD.filter(valid).length)/24:null,'ERA5-Land','雪深>1cm的日数折合每年；需要有雪深资料','代理',period);
 add(36,valid(elev)?elev:null,'Open-Meteo Elevation','项目坐标高程','地理数据','当前坐标');
 add(37,valid(mean(BP))?mean(BP)/10:null,'ERA5','小时地面气压均值 hPa→kPa','再分析',period);
 add(38,valid(min(BP))?min(BP)/10:null,'ERA5','地面气压小时最低值 hPa→kPa','再分析',period);
 let den=[];for(let i=0;i<n;i++)if(valid(BP[i])&&valid(T[i]))den.push(BP[i]*100/(287.05*(T[i]+273.15)));
 add(39,mean(den),'ERA5','理想干空气近似密度，未修正水汽','模型估算',period);
 add(40,min(den),'ERA5','理想干空气最低密度，未修正水汽','模型估算',period);
 add(41,mean(a.sulphur_dioxide),'CAMS','90天SO₂小时均值','再分析',aPeriod);
 add(42,null,'需H₂S检测','无统一全球可信历史接口','专项缺口');
 add(43,null,'需Cl₂检测','无统一全球可信历史接口','专项缺口');
 add(44,mean(a.nitrogen_dioxide),'CAMS','90天NO₂小时均值','再分析',aPeriod);
 add(45,null,'需NH₃检测','无统一全球可信历史接口','专项缺口');
 add(46,null,'需土地覆盖数据','植被类型/周边占比需GIS土地覆盖接口','专项缺口');
 add(47,q(RAD,.95),'ERA5','P95短波辐射 W/m²，非年总辐照量','再分析',period);
 add(48,null,'需台风路径数据库','应按影响半径、风速阈值和统计期统计','专项缺口');
 add(49,null,'需雷电密度数据','雷击密度需专业闪电定位资料','专项缺口');
 add(50,null,'需生物专项调查','需定义昆虫鸟类、藻菌或生物附着场景','专项缺口');
 // Legacy consumers remain on their existing keyed variables; only correct matching fields with equivalent semantics.
 // Do not mutate legacy scenario engine inputs (03-10 remain on their original definitions).
};
const mainLabels={'温度':'t99','湿度':'rhAvg','风速':'wind95','降雨':'rainYear','盐雾':'salt','沙尘':'pm10','冰雪':'snowHours','海拔':'alt','有害气体':'so2','其它环境':'rad95'};
const unitValue=(v,unit)=>v==null?'—':typeof v==='string'?v:((Math.abs(v)<1&&v!==0?v.toFixed(3):v.toFixed(1)).replace(/\.0$/,''))+' '+unit;
function stored(){try{const d=JSON.parse(localStorage.getItem(STORAGE)||'{}');return d.context===loc()?d.fields||{}:{}}catch(_){return {}}}
function merged(){const overrides=stored(),out={};for(let i=1;i<=50;i++)out[i]=overrides[i]?{...overrides[i],quality:'人工验证'}:(records[i]||{value:null,source:'待接入',rule:'尚无可信来源',quality:'专项缺口'});return out}
function draw(){
const root=document.getElementById('envGrid');if(!root)return;root.className='env-health-v3';
const vals=merged(),groups=[];for(let i=0;i<50;i+=5)groups.push(FIELDS.slice(i,i+5).map((d,j)=>({id:i+j+1,group:d[0],name:d[1],unit:d[2],record:vals[i+j+1]})));
root.innerHTML=groups.map(g=>{
 const p=g[0],active=g.filter(x=>x.record.value!==null).length;
 const cKey=mainLabels[p.group],risk=p.record.value!==null&&typeof p.record.value==='number'&&Number.isFinite(env[cKey])?riskLevel(cKey):null;
 const status=risk===3?'高风险':risk===2?'中风险':risk===1?'低风险':'待评价';
 const row=x=>'<div class="ev3-item" title="'+escape([x.record.source,x.record.period,x.record.rule].filter(Boolean).join(' | '))+'"><span>'+escape(x.name)+'</span><b>'+escape(unitValue(x.record.value,x.unit))+'</b></div>';
 return '<article class="ev3-card"><div class="ev3-header"><b>'+escape(p.group)+'</b><span class="ev3-risk">'+status+'</span></div><div class="ev3-number">'+escape(unitValue(p.record.value,p.unit))+'</div><div class="ev3-caption">'+escape(p.name)+'</div><div class="ev3-details">'+g.slice(1).map(row).join('')+'</div><div class="ev3-foot">'+active+'/5 有数据 · '+escape(p.record.quality)+' · '+escape(p.record.source)+'</div></article>'
}).join('');
const count=Object.values(vals).filter(x=>x.value!==null).length;
const summary=document.getElementById('ev3-summary');if(summary)summary.textContent='50项环境数据 · 可用'+count+'项 · 其余'+(50-count)+'项需专项来源（数值不可伪造）';
}
renderEnv=draw;
function tools(){
if(document.getElementById('ev3-tools'))return;
const box=document.createElement('div');box.id='ev3-tools';box.className='ev3-tools';
box.innerHTML='<strong id="ev3-summary">50项环境数据</strong><button id="ev3-export" type="button">导出50项模板</button><button id="ev3-import" type="button">导入核实数据</button><input id="ev3-file" type="file" accept=".csv" hidden><small>逐项悬停查看来源、统计期与算法；人工数据按坐标和年限隔离。</small>';
const grid=document.getElementById('envGrid');grid?.parentElement?.insertBefore(box,grid);
document.getElementById('ev3-export').onclick=()=>{
 const rows=[['序号','一级分类','二级参数','单位','数值','数据来源','观测时期','备注'],...FIELDS.map((f,i)=>[i+1,f[0],f[1],f[2],'','','',records[i+1]?.rule||''])];
 const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='02项目环境体检50项核实数据.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.getElementById('ev3-import').onclick=()=>document.getElementById('ev3-file').click();
document.getElementById('ev3-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
 const src=(await file.text()).replace(/^\ufeff/,'');const lines=[];let row=[],cell='',quote=false;
 for(let i=0;i<src.length;i++){const ch=src[i];if(ch==='"'){if(quote&&src[i+1]==='"'){cell+='"';i++}else quote=!quote}else if(ch===','&&!quote){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))lines.push(row);row=[];cell=''}else cell+=ch}row.push(cell);if(row.some(x=>x.trim()))lines.push(row);
 if(lines[0]?.[0]!=='序号'||lines[0]?.[4]!=='数值')throw Error('列结构不符');
 const vals={};for(const r of lines.slice(1)){const id=Number(r[0]),f=FIELDS[id-1],raw=(r[4]||'').trim();if(!raw)continue;
 if(!f||r[2]!==f[1]||r[3]!==f[2]||!r[5]?.trim()||!r[6]?.trim())throw Error('第'+id+'项参数、单位或来源不正确');
 const category=[25,46,50].includes(id);const num=Number(raw);if(!category&&!Number.isFinite(num))throw Error('第'+id+'项不是数值');
 vals[id]={value:category?raw:num,source:r[5],period:r[6],rule:r[7]||'人工核实',quality:'人工验证'};
 }
 localStorage.setItem(STORAGE,JSON.stringify({context:loc(),fields:vals}));draw();alert('已导入'+Object.keys(vals).length+'项核实数据');
 }catch(err){alert('导入失败：'+err.message)}finally{e.target.value=''}
};
}
const style=document.createElement('style');style.textContent='#envGrid.env-health-v3{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;border:1px solid #dfe7f1;background:#fff}#envGrid .ev3-card{padding:9px 10px;min-width:0;border-right:1px solid #e2e8f1;border-bottom:1px solid #e2e8f1;background:#fff}#envGrid .ev3-header{display:flex;justify-content:space-between;gap:5px;color:#123a64;font-size:13px}#envGrid .ev3-risk{font-size:10px;color:#647b95}#envGrid .ev3-number{font-size:18px;color:#104676;font-weight:750;overflow-wrap:anywhere;margin-top:4px}#envGrid .ev3-caption{font-size:11px;color:#7890ad;margin-top:2px;min-height:15px}#envGrid .ev3-details{border-top:1px solid #e4ebf3;padding-top:6px;display:grid;grid-template-columns:1fr;gap:5px}#envGrid .ev3-item{display:flex;justify-content:space-between;gap:6px;font-size:10px;align-items:baseline;color:#667d95}#envGrid .ev3-item b{color:#173a5f;text-align:right;overflow-wrap:anywhere}#envGrid .ev3-foot{font-size:9px;color:#8797aa;margin-top:6px}#ev3-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 0;font-size:11px;color:#506784}#ev3-tools button{background:#eef4ff;border:1px solid #cddff8;border-radius:5px;padding:6px 9px;color:#104676;cursor:pointer}@media(max-width:900px){#envGrid.env-health-v3{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:680px){#envGrid.env-health-v3{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:460px){#envGrid.env-health-v3{grid-template-columns:1fr}}';
document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{tools();draw()},{once:true});else{tools();draw()}
})();