import {initReferenceComparison} from './reference-comparison.js';
import {computeModel,DEFAULTS,validateParameters} from './model-v328.js';
import {RunCoordinator,DataCache} from './run-controller.js';
import {fetchDirectHealth} from './sources-v328.js';
import {number} from './data-quality.js';
import {CALIBRATION_META,buildCalibration,validationMetrics} from './calibration-v328.js';
import {renderQuality,renderServices,openTrace as showTrace,renderCalibration,escapeHtml as esc,format} from './review-ui.js';
import {initPlaceSearch} from './place-search.js?v=3.2.6';
const BENCHMARK_POINTS=[
['巴西1',-23.8,-46.0,98.7],['巴西2',-22.9,-43.8,73.1],['巴西3',-23.0,-43.2,127.1],['沙特1',26.1,50.0,40.2],['沙特2',27.2,49.3,39.0],['沙特3',28.9,47.9,33.7],['沙特4',16.7,42.1,127.1],['沙特5',21.1,39.2,99.3],['沙特6',24.0,38.1,124.3],['沙特7',29.4,34.9,72.9],['沙特8',21.3,39.2,78.5],['印度1',12.3,79.5,51.3],['印度2',10.7,79.8,28.9],['印度3',12.4,75.0,108.4],['印度4',21.1,73.2,27.3],['印度5',14.5,80.2,111.5],['越南1',10.5,107.2,27.5],['越南2',10.9,106.6,46.4],['越南3',12.2,109.2,41.0],['越南4',16.0,108.2,63.7],['越南5',17.4,106.6,72.4],['越南6',19.7,105.6,39.5],['越南7',20.8,106.1,46.6],['越南8',20.7,106.7,47.3],['泰国1',13.6,100.6,40.1],['泰国2',7.8,98.3,30.9]
].map((p,i)=>({id:i+1,name:p[0],latitude:p[1],longitude:p[2],referenceCorrosion:p[3],material:'carbon_steel',height:2}));
const state={result:null,results:[],health:null,map:null,marker:null,charts:{},admin:false,benchmarkStop:false,benchmarkRows:[],runStartedAt:0};
const modelDefaults={...DEFAULTS,minCoverage:.95};
let modelParameters={...modelDefaults,...safeJson(localStorage.getItem('marineModelParams'))};
let overrides={...safeJson(localStorage.getItem('marineOverrides'))};
let audit=safeJson(localStorage.getItem('marineAudit'),[]);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function safeJson(s,def={}){try{return s?JSON.parse(s):def}catch{return def}}
function fmt(v,d=1){return format(v,d)}
function mean(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),3000)}
function showLoading(on,title='正在获取数据',text=''){
  const el=$('#loading');el.classList.toggle('hidden',!on);$('#loadingTitle').textContent=title;if(text)$('#loadingText').textContent=text;
  if(on){$('#progressBar').style.width='0%';$('#loadingHours').textContent='等待数据';$('#loadingElapsed').textContent='0 s';for(let i=0;i<4;i++)setLoadStage(i,i===0?'active':'pending')}
}
function setLoadStage(index,status,detail=''){const row=document.querySelector(`[data-load-stage="${index}"]`);if(!row)return;row.dataset.status=status;const labels={pending:'等待',active:'进行中',done:'完成',warn:'Fallback',error:'失败'};row.querySelector('.load-stage-status').textContent=labels[status]||status;if(detail)row.querySelector('.load-stage-detail').textContent=detail}
function hoursInYear(y){return ((y%4===0&&y%100!==0)||y%400===0)?8784:8760}
function expectedHours(){if($('#mode').value!=='historical')return null;return yearsForRun().reduce((sum,y)=>sum+hoursInYear(y),0)}
function updateLoadMeta(done=0,total=expectedHours()){const h=$('#loadingHours');h.dataset.done=String(done||0);h.dataset.total=total?String(total):'';h.textContent=total?`${Number(done||0).toLocaleString()} / ${Number(total).toLocaleString()} h`:(done?`${Number(done).toLocaleString()} h`:'Current窗口');$('#loadingElapsed').textContent=`${Math.max(0,Math.round((Date.now()-state.runStartedAt)/1000))} s`}
function startElapsedTicker(){return setInterval(()=>{$('#loadingElapsed').textContent=Math.max(0,Math.round((Date.now()-state.runStartedAt)/1000))+' s'},1000)}
function riskClass(level){return /HIGH|C5|CX|S3|Very High/.test(String(level))?'risk-high':/MED|C4|S2|S1|High/.test(String(level))?'risk-med':'risk-low'}
function setPage(page){$$('.page').forEach(x=>x.classList.remove('active'));const t=$(`#page-${page}`)||$('#page-overview');t.classList.add('active');$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));history.replaceState({},'',location.pathname+'?v=3.2.8'+(page==='overview'?'':'&page='+page));if(page==='validation'&&!state.benchmarkRows.length)loadBenchmark();setTimeout(()=>{resizeCharts();if(t.id==='page-overview')state.map?.invalidateSize()},50)}
function resizeCharts(){Object.values(state.charts).forEach(c=>c?.resize())}
function doseResponse(material,pd,sd,rh,t){pd=Math.max(pd||0,.001);sd=Math.max(sd||0,.001);if(material==='zinc'){const f=t<=10?.038*(t-10):-.071*(t-10);return .0129*pd**.44*Math.exp(.046*rh+f)+.0175*sd**.57*Math.exp(.008*rh+.085*t)}if(material==='copper'){const f=t<=10?.126*(t-10):-.080*(t-10);return .0053*pd**.26*Math.exp(.059*rh+f)+.01025*sd**.27*Math.exp(.036*rh+.049*t)}if(material==='aluminium'){const f=t<=10?.009*(t-10):-.043*(t-10);return .0042*pd**.73*Math.exp(.025*rh+f)+.0018*sd**.60*Math.exp(.020*rh+.094*t)}const f=t<=10?.150*(t-10):-.054*(t-10);return 1.77*pd**.52*Math.exp(.020*rh+f)+.102*sd**.62*Math.exp(.033*rh+.040*t)}
function corrosionClass(material,r){if(!Number.isFinite(r))return'N/A';if(material==='zinc'){if(r<=.1)return'C1';if(r<=.7)return'C2';if(r<=2.1)return'C3';if(r<=4.2)return'C4';if(r<=8.4)return'C5';return'CX'}if(material==='copper'){if(r<=.1)return'C1';if(r<=.6)return'C2';if(r<=1.3)return'C3';if(r<=2.8)return'C4';if(r<=5.6)return'C5';return'CX'}if(material==='aluminium'){if(r<=.6)return'C2';if(r<=2)return'C3';if(r<=5)return'C4';if(r<=10)return'C5';return'CX'}if(r<=1.3)return'C1';if(r<=25)return'C2';if(r<=50)return'C3';if(r<=80)return'C4';if(r<=200)return'C5';return'CX'}
function initYear(){const y=new Date().getUTCFullYear()-1;for(let i=0;i<12;i++){const o=document.createElement('option');o.value=y-i;o.textContent=`${y-i}`;$('#year').append(o)}}
function wrapLongitude(lon){return ((lon+180)%360+360)%360-180}
function mapCoordinateText(lat,lon){return `纬度 ${lat.toFixed(4)}° / 经度 ${wrapLongitude(lon).toFixed(4)}°`}
function updateMapCoordinates(){
  const selected=state.marker.getLatLng(),center=state.map.getCenter();
  $('#mapSelectedCoords').textContent=mapCoordinateText(selected.lat,selected.lng);
  $('#mapCenterCoords').textContent=mapCoordinateText(center.lat,center.lng);
}
function locationChanged(lat,lon,zoom=state.map.getZoom(),recenter=true){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
  $('#latitude').value=lat.toFixed(4);$('#longitude').value=lon.toFixed(4);
  const coords=[Number($('#latitude').value),Number($('#longitude').value)];
  state.marker.setLatLng(coords);state.map.invalidateSize();if(recenter)state.map.setView(coords,zoom);
  updateMapCoordinates();$('#mapPickStatus').textContent='选点已更新，经纬度已同步。确认位置后点击计算。';
  if(state.result){const p=state.result.project;if(Math.abs(p.latitude-coords[0])>.00005||Math.abs(p.longitude-coords[1])>.00005){$('#globalNotice').className='notice info';$('#globalNotice').textContent='项目位置已更新。下方结果仍属于上次计算的位置，请点击“计算”刷新环境评估。'}}
}
function initMap(){
  state.map=L.map('map',{zoomControl:true}).setView([18.2528,109.5119],8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(state.map);
  state.marker=L.marker([18.2528,109.5119],{draggable:true,autoPan:true,title:'已选点，拖动可调整位置',alt:'已选点标记'}).addTo(state.map);
  const placeSearch=initPlaceSearch({onSelect:place=>{locationChanged(place.latitude,place.longitude,10);toast('已填写经纬度并更新地图，请确认位置后点击计算')}});
  function selectMapPoint(point){
    placeSearch.coordinatesChanged();locationChanged(point.lat,wrapLongitude(point.lng),state.map.getZoom(),false);
    toast('已选取地图位置，经纬度已同步');
  }
  state.map.on('click',e=>selectMapPoint(e.latlng));
  state.marker.on('dragend',()=>selectMapPoint(state.marker.getLatLng()));
  state.map.on('moveend',updateMapCoordinates);
  $('#mapUseCenter').addEventListener('click',()=>selectMapPoint(state.map.getCenter()));
  $('#mapReturnSelected').addEventListener('click',()=>{state.map.setView(state.marker.getLatLng(),state.map.getZoom());updateMapCoordinates()});
  $('#mapPickBtn').addEventListener('click',()=>{
    setPage('overview');
    requestAnimationFrame(()=>{
      state.map.invalidateSize();updateMapCoordinates();
      $('#mapPickerPanel').scrollIntoView({block:'start'});$('#map').focus({preventScroll:true});
    });
  });
  $('#map').addEventListener('keydown',e=>{
    if(e.target===$('#map')&&e.key==='Enter'&&!e.isComposing){e.preventDefault();selectMapPoint(state.map.getCenter())}
  });
  for(const id of ['latitude','longitude'])$('#'+id).addEventListener('change',()=>{
    placeSearch.coordinatesChanged();
    const lat=$('#latitude').value.trim(),lon=$('#longitude').value.trim();
    if(lat&&lon)locationChanged(Number(lat),Number(lon));
  });
  updateMapCoordinates();
}
function modeChanged(){const hist=$('#mode').value==='historical';$('#periodCell').classList.toggle('disabled',!hist);$('#yearCell').classList.toggle('disabled',!hist);$('#period').disabled=!hist;$('#year').disabled=!hist;$('#runBtn').textContent=hist?'自动获取真实数据并计算':'获取Current数据并评估'}
async function health(){state.health=await fetchDirectHealth();renderSources()}
function tagFor(p){const s=String(p?.type||'EST').toUpperCase();if(s.includes('OVERRIDE'))return'override';if(s.includes('RAW'))return'raw';if(s.includes('CALC'))return'calc';return'est'}
function statusLabel(s){return s==='configured'||s==='gateway'||s==='available'?'已连接':s?.includes('fallback')?'Fallback':'未配置'}
function renderSources(){renderServices(state.health,state.result)}
function yearsForRun(){if($('#mode').value!=='historical')return[];const end=Number($('#year').value),n=Number($('#period').value);return Array.from({length:n},(_,i)=>end-n+1+i)}

const sharedCache=new DataCache();
const resolveGis=async(...args)=>(await import('./gis-browser-v328.js')).resolveGis(...args);
const coordinator=new RunCoordinator({resolveGis,cache:sharedCache});
const benchmarkCoordinator=new RunCoordinator({resolveGis,cache:sharedCache});
const referenceCoordinator=new RunCoordinator({resolveGis,cache:sharedCache});
let referenceUI=null;
let calibrationModel=safeJson(localStorage.getItem('marineCalibration328'),null),lastSnapshot=null,runUiId=0;
function snapshot(custom={}){
 const cfg={...modelParameters,latitude:Number($('#latitude').value),longitude:Number($('#longitude').value),height:Number($('#height').value),mode:$('#mode').value,exposureZone:$('#exposureZone').value,material:$('#material').value,designLife:Number($('#designLife').value),projectName:$('#projectName').value,requestedYears:yearsForRun(),...custom};
 validateParameters(cfg,overrides);
 if(!Number.isFinite(cfg.latitude)||!Number.isFinite(cfg.longitude)||Math.abs(cfg.latitude)>90||Math.abs(cfg.longitude)>180)throw new Error('请输入有效经纬度：纬度-90～90，经度-180～180');
 return {capturedAt:new Date().toISOString(),cfg:structuredClone(cfg),overrides:structuredClone(overrides),audit:structuredClone(audit),calibrationModel:structuredClone(calibrationModel)};
}
function setBusy(on){$('#runBtn').disabled=on;$('#retryRun').disabled=on;$('#refreshRun').disabled=on;$('#cancelRun').disabled=!on;$('#runBtn').setAttribute('aria-busy',String(on))}
function runProgress(event){
 if(event.year!==undefined){const id=String(event.year??'current');let row=$('#yearStatus').querySelector('[data-year="'+id+'"]');if(!row){row=document.createElement('li');row.dataset.year=id;$('#yearStatus').append(row)}row.textContent=(event.year||'Current')+'：'+event.detail;row.dataset.status=event.stage}
 $('#loadingText').textContent=event.detail;$('#taskMessage').textContent=event.detail;
 if(event.stage==='gis')setLoadStage(0,'active',event.detail);
 if(['direct','weather','ocean'].includes(event.stage))setLoadStage(1,'active',event.detail);
 if(['done','cache'].includes(event.stage)){setLoadStage(0,'done');setLoadStage(1,'done');}
 if(event.completed!==undefined){$('#progressBar').style.width=(100*event.completed/event.total)+'%';$('#loadingHours').textContent=event.completed+' / '+event.total+' 个年度数据包';}
 if(event.stage==='compute'){setLoadStage(2,'done','完整UTC时序已对齐');setLoadStage(3,'active','计算跨年连续状态及统计');$('#loadingTitle').textContent='数据已返回，正在计算'}
 if(event.stage==='complete'){setLoadStage(3,'done');$('#progressBar').style.width=(100*event.completed/event.total)+'%'}
}
async function runWithSnapshot(input,{fresh=false}={}){
 const uiId=++runUiId;coordinator.cancel();benchmarkCoordinator.cancel();referenceUI?.cancel();state.benchmarkStop=true;lastSnapshot=structuredClone(input);state.runStartedAt=Date.now();localStorage.setItem('marineRunCheckpoint328',JSON.stringify(input));
 $('#taskPanel').classList.remove('hidden');$('#taskSnapshot').textContent=input.cfg.projectName+'；'+input.cfg.latitude+', '+input.cfg.longitude+'；'+(input.cfg.requestedYears.join(' / ')||'Current')+'；参数已固定';
 $('#yearStatus').textContent='';setBusy(true);showLoading(true,'正在获取环境数据','可随时取消，已完成年度会保留在缓存中');const ticker=startElapsedTicker();
 try{
  const result=await coordinator.run(input,runProgress,{fresh});if(uiId!==runUiId)return;
  state.result=result;state.results=result.annual.map(a=>({project:{year:a.year},summary:a.summary}));state.marker.setLatLng([input.cfg.latitude,input.cfg.longitude]);state.map.setView([input.cfg.latitude,input.cfg.longitude],state.map.getZoom());updateMapCoordinates();renderAll();
  const failures=result.run.failures;$('#taskMessage').textContent=failures.length?'已完成 '+result.run.completedYears.join(' / ')+'；失败 '+failures.map(x=>x.year).join(' / ')+'。当前为部分结果，可重试失败年度。':'所选周期已完成。'+(result.run.cacheWarning||'相同环境与参数可复用缓存。');
  if(failures.length){$('#globalNotice').textContent='部分年度未完成，不提供完整周期年度腐蚀结论。'+failures.map(x=>x.year+'：'+x.message).join('；')}
  toast(failures.length?'部分结果已保留，请查看失败年度':'完成：'+fmt(result.summary.hours,0)+'个有效小时');
 }catch(error){if(uiId!==runUiId)return;const cancelled=error.name==='AbortError';$('#taskMessage').textContent=cancelled?'本次计算已取消，已完成的数据包已缓存。可继续或重试。':error.message;$('#globalNotice').textContent=(cancelled?'计算已取消。':'本次计算失败：'+error.message+'。')+(state.result?'下方仍显示上次结果。':'');toast(cancelled?'已取消计算':error.message)}
 finally{clearInterval(ticker);if(uiId===runUiId){setBusy(false);showLoading(false)}}
}
async function run(){try{if(!$('#latitude').value.trim()||!$('#longitude').value.trim())throw new Error('请填写经纬度');await runWithSnapshot(snapshot())}catch(e){toast(e.message)}}
async function callAnalyze(year=null,custom={},onProgress=()=>{}){
 const input=snapshot({...custom,requestedYears:year?[year]:[],mode:year?'historical':'current'});
 return benchmarkCoordinator.run(input,onProgress);
}

function metric(name,sub,val,unit,level,tag='CALC',trace='corrosion'){return `<div class="metric-row" data-trace="${trace}"><div class="metric-name"><strong>${name}</strong><small>${sub}</small></div><div class="metric-val">${val}</div><div class="metric-unit">${unit}</div><div class="risk-badge ${riskClass(level)}">${level}</div><span class="tag ${tag.toLowerCase()==='raw'?'raw':tag.toLowerCase()==='est'?'est':tag.toLowerCase()==='override'?'override':'calc'}">${tag}</span></div>`}
function cards(items){return items.map(x=>`<div class="stat-card"><span>${x[0]}</span><b>${x[1]}</b><em>${x[2]||''}</em>${x[3]?`<div class="${riskClass(x[3])}">${x[3]}</div>`:''}</div>`).join('')}
function renderAll(){
 const result=state.result,s=result.summary,hist=s.mode==='historical',zone=s.exposureZone,cal=!!s.experienceCalibration.applied;
 $('#isoClass').textContent=hist&&zone==='atmospheric'?(cal?s.engineeringCorrosionClass:s.corrosionClass):'—';
 $('#isoLabel').textContent=!hist?'CURRENT WINDOW':zone==='atmospheric'?'CORROSION ESTIMATE':'ZONE SCREENING';
 $('#clClass').textContent=s.chlorideClass;$('#confidence').textContent='输入 '+result.qualityAssessment.inputGrade+' / '+(cal?'局地校准':'验证待完成');$('#sceneText').textContent=zone==='atmospheric'?(s.marineRatio>45?'海洋大气暴露':s.marineRatio>20?'沿海混合暴露':'低海洋来流环境'):'海洋区带筛查';
 $('#riskRing').style.borderColor=/C5|CX/.test(s.corrosionClass)?'#efb1b1':'#bbdccd';
 $('#riskReasons').innerHTML=result.qualityAssessment.reasons.map(x=>'<div>'+esc(x)+'</div>').join('');
 $('#geoInline').innerHTML=cards([['距海',fmt(s.distanceToCoastKm),'km'],['海岸方位',fmt(s.coastBearing,0),'°'],['海拔',fmt(s.elevation,0),'m'],['Fetch P95',fmt(s.effectiveFetchP95),'km']]);
 $('#metricRows').innerHTML=[
 metric('空气海盐浓度',s.proxySaltHours?'含海盐代理与局地粗颗粒EST':'CAMS背景 + 局地粗颗粒EST',fmt(s.airSaltMean),'μg/m³','EST','EST','airSalt'),
 metric('Cl⁻沉降率','有效时段平均；标准测法等效性待验证',fmt(s.clDepMean),'mg/(m²·d)',s.chlorideClass,'CALC','clDep'),
 metric('表面Cl⁻库存','周期最大；断档后库存未知',fmt(s.surfaceClMax),'mg/m²',s.stateContinuity.continuous?'CALC':'GAP','CALC','surfaceCl'),
 metric('ISO气象湿润时长','本次周期累计',fmt(s.towHours,0),'h','CALC','CALC','tow'),
 metric('凝露时长','本次周期；表面温度为估算值',fmt(s.condHours,0),'h','EST','EST','cond'),
 metric('设备高度','高度参数已固定于本次快照',fmt(s.height,0),'m','INPUT','CALC','gis'),
 metric('动态Fetch P95','完整有效时序统计',fmt(s.effectiveFetchP95),'km','CALC','CALC','gis'),
 metric(hist?'首年腐蚀估算':'年度腐蚀率',s.corrosionBasis,fmt(s.firstYearCorrosion),s.material==='aluminium'?'g/(m²·a)':'μm/a',s.corrosionClass,'CALC','corrosion'),
 ...(cal?[metric('局地工程校准值','原始ISO公式结果另列',fmt(s.engineeringFirstYearCorrosion),'μm/a',s.engineeringCorrosionClass,'CALIBRATED','corrosion')]:[]),
 metric('平均波高','数据与估算比例见质量表',fmt(s.meanWaveHeight),'m','DATA','CALC','wave'),
 metric('平均盐度','35 PSU填充值始终标记EST',fmt(s.meanSalinity),'PSU','DATA',result.quality.find(q=>q.key==='salinity')?.estimated?'EST':'CALC','salinity'),
 metric('SO₂沉降','CAMS换算或明确标记的工程估算',fmt(s.meanSo2Dep),'mg/(m²·d)','DATA',result.quality.find(q=>q.key==='so2Dep')?.estimated?'EST':'CALC','so2')
 ].join('');
 $$('.metric-row').forEach(x=>x.onclick=()=>openTrace(x.dataset.trace));renderStats();renderCharts();renderModel();renderZones();renderDesign();renderSummary();renderSources();renderQuality(result);renderCalibration(calibrationModel,chart);
 $('#globalNotice').className='notice info';$('#globalNotice').textContent=s.periodLabel+'；'+s.corrosionBasis+'。输入质量 '+result.qualityAssessment.inputGrade+'；'+result.qualityAssessment.modelEvidence+'。';
 $('#projectNameTop').textContent=result.project.name;
}
function renderStats(){
 const s=state.result.summary,unit=s.material==='aluminium'?'g/(m²·a)':'μm/a';
 const put=(id,items)=>{document.getElementById(id).innerHTML=cards(items)};
 put('dataStats',[['关键气象有效',fmt(s.hours,0),'h'],['数据覆盖率',fmt(s.coveragePercent),'%'],['周期平均气温',fmt(s.meanTemp),'°C'],['周期平均湿度',fmt(s.meanRh),'%']]);
 put('geoStats',[['距海',fmt(s.distanceToCoastKm),'km'],['海岸方位',fmt(s.coastBearing),'°'],['海拔',fmt(s.elevation),'m'],['Fetch P95',fmt(s.effectiveFetchP95),'km']]);
 put('oceanStats',[['周期平均波高',fmt(s.meanWaveHeight),'m'],['周期平均盐度',fmt(s.meanSalinity),'PSU'],['CAMS有效输入',fmt(s.camsHours,0),'h'],['海盐代理参与',fmt(s.proxySaltHours,0),'h']]);
 put('saltMetrics',[['周期Cl累计',fmt(s.cumulativeCl,2),'g/m²'],['完整年度平均Cl累计',fmt(s.annualCl,2),'g/(m²·a)'],['表面库存最大',fmt(s.surfaceClMax),'mg/m²'],['Cl沉降P95',fmt(s.clDepP95),'mg/(m²·d)'],['Cl沉降P99',fmt(s.clDepP99),'mg/(m²·d)']]);
 put('wetMetrics',[['周期湿润',fmt(s.wetHours,0),'h'],['周期凝露',fmt(s.condHours,0),'h'],['最长连续湿润',fmt(s.longestWet,0),'h'],['周期气象湿润',fmt(s.towHours,0),'h'],['年均气象湿润',fmt(s.annualTowHours,0),'h/a']]);
 put('riskMetrics',[['逐年腐蚀估算均值',fmt(s.firstYearCorrosion),unit],['气候均值代入公式',fmt(s.climateMeanCorrosion),unit],['原始公式等级',s.corrosionClass],['工程校准',s.experienceCalibration.applied?'已应用':'未应用']]);
 $('#riskExplain').textContent=s.corrosionBasis+'。'+state.result.qualityAssessment.modelEvidence+'；累计量仅含有效时段。';
}
function chart(id,opt){if(!document.getElementById(id))return;if(state.charts[id])state.charts[id].dispose();const c=echarts.init(document.getElementById(id));c.setOption(opt);state.charts[id]=c}
function renderCharts(){const t=state.result.timeline||[];if(!t.length)return;const axis=t.map(x=>x.time.slice(0,13)),toolbox={feature:{dataZoom:{},restore:{},saveAsImage:{}}};chart('timelineChart',{tooltip:{trigger:'axis'},legend:{data:['Air Salt','Cl Deposition','Surface Cl']},grid:{left:55,right:50,top:40,bottom:55},toolbox,xAxis:{type:'category',data:axis,axisLabel:{show:false}},yAxis:[{type:'value',name:'Air/Cl'},{type:'value',name:'Surface Cl'}],dataZoom:[{type:'inside'},{type:'slider'}],series:[{name:'Air Salt',type:'line',showSymbol:false,data:t.map(x=>x.airSalt)},{name:'Cl Deposition',type:'line',showSymbol:false,data:t.map(x=>x.clDep)},{name:'Surface Cl',type:'line',yAxisIndex:1,showSymbol:false,data:t.map(x=>x.surfaceCl)}]});chart('weatherChart',{tooltip:{trigger:'axis'},legend:{data:['T','RH','Wind','Hs']},grid:{left:55,right:55,top:40,bottom:55},toolbox,xAxis:{type:'category',data:axis,axisLabel:{show:false}},yAxis:[{type:'value'},{type:'value',max:100}],dataZoom:[{type:'inside'},{type:'slider'}],series:[{name:'T',type:'line',showSymbol:false,data:t.map(x=>x.t)},{name:'Wind',type:'line',showSymbol:false,data:t.map(x=>x.wind)},{name:'Hs',type:'line',showSymbol:false,data:t.map(x=>x.hs)},{name:'RH',type:'line',yAxisIndex:1,showSymbol:false,data:t.map(x=>x.rh)}]});chart('saltChart',{tooltip:{trigger:'axis'},legend:{data:['CAMS/Proxy <20','Spray >20','Cl Dep','Surface Cl']},grid:{left:60,right:60,top:45,bottom:55},toolbox,xAxis:{type:'category',data:axis,axisLabel:{show:false}},yAxis:[{type:'value'},{type:'value'}],dataZoom:[{type:'inside'},{type:'slider'}],series:[{name:'CAMS/Proxy <20',type:'line',showSymbol:false,data:t.map(x=>[x.ss1,x.ss2,x.ss3].every(Number.isFinite)?x.ss1+x.ss2+x.ss3:null)},{name:'Spray >20',type:'line',showSymbol:false,data:t.map(x=>x.spray20)},{name:'Cl Dep',type:'line',showSymbol:false,data:t.map(x=>x.clDep)},{name:'Surface Cl',type:'line',yAxisIndex:1,showSymbol:false,data:t.map(x=>x.surfaceCl)}]});chart('wetChart',{tooltip:{trigger:'axis'},legend:{data:['Air T','Surface T','RH','Wet']},grid:{left:60,right:60,top:45,bottom:55},toolbox,xAxis:{type:'category',data:axis,axisLabel:{show:false}},yAxis:[{type:'value'},{type:'value',max:100}],dataZoom:[{type:'inside'},{type:'slider'}],series:[{name:'Air T',type:'line',showSymbol:false,data:t.map(x=>x.t)},{name:'Surface T',type:'line',showSymbol:false,data:t.map(x=>x.ts)},{name:'RH',type:'line',yAxisIndex:1,showSymbol:false,data:t.map(x=>x.rh)},{name:'Wet',type:'line',yAxisIndex:1,showSymbol:false,data:t.map(x=>typeof x.wet==='boolean'?Number(x.wet)*100:null)}]})}
function renderModel(){const f=state.result.formulas||[];$('#formulaList').innerHTML=f.map(x=>`<div class="formula-card"><h3>${x.name} <span class="tag calc">${x.type}</span></h3><code>${x.expr}</code></div>`).join('')}
function renderZones(){const z=state.result.summary.exposureZone;const rows=[['Atmospheric','ERA5 + CAMS + CMEMS + GIS','ISO 9223','C1–CX'],['Splash','波浪/盐度/海水直接冲击','Marine screening','不输出C1–CX'],['Tidal','潮汐干湿交替/盐度/温度','Marine screening','不输出C1–CX'],['Submerged','盐度/海温/流动/海水环境','Marine screening','不输出C1–CX']];$('#zoneFlow').innerHTML=rows.map(r=>`<div class="design-stage ${z.toLowerCase()===r[0].toLowerCase()?'selected-zone':''}"><h3>${r[0]}</h3><ul><li>${r[1]}</li><li>${r[2]}</li><li>${r[3]}</li></ul></div>`).join('')}
function renderDesign(){const s=state.result.summary,z=s.exposureZone,mat=state.result.project.material,life=s.designLife;let stages;if(z==='atmospheric'){stages=[['环境',[`ISO ${s.isoCorrosionClass||s.corrosionClass}`,`Cl ${s.chlorideClass}`,`Air Salt ${fmt(s.airSaltMean)} μg/m³`]],['设计输入',[`材料 ${mat}`,`寿命 ${life} 年`,`高度 ${s.height} m`,`Surface Cl Max ${fmt(s.surfaceClMax,0)} mg/m²`]],['设计要求',['按ISO环境等级选择涂层/材料','盐雾过滤/密封/排水联合设计','避免将耐久性等同质保期']],['验证',['ISO 9225沉降实测','腐蚀挂片/ACM','独立同期挂片验证 + 现场校准']]]}else{stages=[['暴露区带',[z,`Salinity ${fmt(s.meanSalinity)} PSU`,`Hs ${fmt(s.meanWaveHeight)} m`]],['材料与寿命',[mat,`${life} 年`]],['设计原则',['不使用Atmospheric C1–CX','按海洋区带选择涂层/阴极保护/腐蚀裕量','必须结合项目海水化学与维护条件']],['验证',['浪溅/潮差/浸没现场试验','海水腐蚀挂片','阴极保护设计校核']]]}$('#designFlow').innerHTML=stages.map(x=>`<div class="design-stage"><h3>${x[0]}</h3><ul>${x[1].map(v=>`<li>${v}</li>`).join('')}</ul></div>`).join('')}
function renderSummary(){const r=state.result,s=r.summary;$('#engineeringSummary').innerHTML=[['统计周期',s.periodLabel],['数据质量','输入 '+r.qualityAssessment.inputGrade+'；关键气象覆盖 '+fmt(s.coveragePercent)+'%'],['腐蚀估算',s.corrosionBasis+'；结果 '+fmt(s.firstYearCorrosion)+'；等级 '+s.corrosionClass],['校核证据',r.qualityAssessment.modelEvidence],['实测数据审计','641行去重为121条、110个坐标；缺少准确测量日期、单位、材料与测量方法，不能声明同期实测验证完成。'],['状态连续性',s.stateContinuity.continuous?'本次连续时间轴跨年不清零；起点库存假设为0。':'发现缺测或断档，后续库存未知；相关指标为有限覆盖结果。']].map(([a,b])=>'<div class="summary-item"><strong>'+esc(a)+'</strong><span>'+esc(b)+'</span></div>').join('')}
async function openTrace(metric){showTrace(state.result,metric)}
function adminFields(){const pfields=[['海盐κ','kappa','—'],['Cl质量占比','chlorideFraction','—'],['雨洗效率','washEfficiency','—'],['通用捕盐系数','captureFactor','—'],['SO₂沉降速度','so2DepVelocity','m/s'],['>20μm Spray系数','localSprayCoeff','—'],['Spray衰减长度','localSprayScaleKm','km'],['Proxy盐雾系数','proxySaltCoeff','—']];const ofields=[['波高 Hs','waveHeight','m'],['海水盐度','salinity','PSU'],['CAMS SS1','camsSs1','kg/kg'],['CAMS SS2','camsSs2','kg/kg'],['CAMS SS3','camsSs3','kg/kg'],['CAMS SO₂','camsSo2','kg/kg'],['SO₂沉降','so2Dep','mg/(m²·d)']];$('#parameterTable').innerHTML=`<table class="table"><thead><tr><th>参数</th><th>代码</th><th>当前值</th><th>单位</th></tr></thead><tbody>${pfields.map(f=>`<tr><td>${f[0]}</td><td>${f[1]}</td><td><input data-model-param="${f[1]}" value="${modelParameters[f[1]]??''}" type="number" step="any"></td><td>${f[2]}</td></tr>`).join('')}</tbody></table>`;$('#overrideTable').innerHTML=`<table class="table"><thead><tr><th>RAW变量</th><th>代码</th><th>Override</th><th>单位</th><th>规则</th></tr></thead><tbody>${ofields.map(f=>`<tr><td>${f[0]}</td><td>${f[1]}</td><td><input data-override="${f[1]}" value="${overrides[f[1]]??''}" type="number" step="any" placeholder="留空=使用RAW"></td><td>${f[2]}</td><td><span class="tag override">RAW保留</span></td></tr>`).join('')}</tbody></table>`;renderAudit()}
async function adminLogin(){const pwd=$('#adminPwd').value.trim();if(!pwd){$('#adminMsg').textContent='请输入本机管理员口令';return}const stored=localStorage.getItem('marineAdminPin');if(stored&&pwd!==stored){$('#adminMsg').textContent='口令不匹配';return}if(!stored)localStorage.setItem('marineAdminPin',pwd);state.admin=true;$('#adminPanel').classList.remove('hidden');$('#adminMsg').textContent='浏览器本机管理员已验证';adminFields()}
function saveAdmin(){
 const before={model:structuredClone(modelParameters),overrides:structuredClone(overrides)},nextModel={...modelParameters},next={};
 $$('[data-model-param]').forEach(i=>{const v=number(i.value);if(v===null)throw new Error('参数必须为有效数字：'+i.dataset.modelParam);nextModel[i.dataset.modelParam]=v});
 $$('[data-override]').forEach(i=>{if(i.value.trim()!==''){const v=number(i.value);if(v===null)throw new Error('覆盖值必须为有效数字');next[i.dataset.override]=v}});
 validateParameters({...nextModel,height:Number($('#height').value)},next);modelParameters=nextModel;overrides=next;
 localStorage.setItem('marineModelParams',JSON.stringify(modelParameters));localStorage.setItem('marineOverrides',JSON.stringify(overrides));
 audit.unshift({time:new Date().toISOString(),type:'ADMIN_OVERRIDE',before,after:{model:structuredClone(modelParameters),overrides:structuredClone(overrides)},reason:'本机管理员保存'});audit=audit.slice(0,100);localStorage.setItem('marineAudit',JSON.stringify(audit));renderAudit();toast('参数已保存；重新计算后生效，原始数据保留');
}
function resetAdmin(){const before={model:modelParameters,overrides};modelParameters={...modelDefaults};overrides={};localStorage.removeItem('marineModelParams');localStorage.removeItem('marineOverrides');audit.unshift({time:new Date().toISOString(),type:'RESET',before,after:{model:modelParameters,overrides}});localStorage.setItem('marineAudit',JSON.stringify(audit));adminFields();toast('已恢复默认')}
function renderAudit(){if(!$('#auditTable'))return;$('#auditTable').innerHTML=audit.length?`<table class="table"><thead><tr><th>时间</th><th>动作</th><th>Override</th></tr></thead><tbody>${audit.slice(0,20).map(a=>`<tr><td>${a.time}</td><td>${a.type}</td><td><code>${JSON.stringify(a.after?.overrides||{})}</code></td></tr>`).join('')}</tbody></table>`:'暂无审计记录'}
async function loadBenchmark(){state.benchmarkRows=BENCHMARK_POINTS.map(p=>({...p,status:'待计算'}));renderBenchmarkRows()}
function renderBenchmarkRows(){if(!$('#benchmarkBody'))return;$('#benchmarkBody').innerHTML=state.benchmarkRows.map((p,i)=>`<tr><td>${p.name}</td><td>${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)}</td><td>${fmt(p.referenceCorrosion)}</td><td>${fmt(p.calc)}</td><td>${fmt(p.diff)}</td><td>${Number.isFinite(p.err)?fmt(p.err)+'%':'—'}</td><td>${corrosionClass('carbon_steel',p.referenceCorrosion)}</td><td>${p.calcClass||'—'}</td><td class="${p.status==='完成'?(p.err<=30?'status-ok':'status-warn'):''}">${p.status}</td></tr>`).join('')}
function benchmarkStats(){const a=state.benchmarkRows.filter(x=>Number.isFinite(x.calc));if(!a.length)return;const mae=mean(a.map(x=>Math.abs(x.diff))),mape=mean(a.map(x=>x.err)),rmse=Math.sqrt(mean(a.map(x=>x.diff*x.diff))),ym=mean(a.map(x=>x.referenceCorrosion)),ssr=a.reduce((s,x)=>s+(x.referenceCorrosion-x.calc)**2,0),sst=a.reduce((s,x)=>s+(x.referenceCorrosion-ym)**2,0),r2=sst>0&&a.length>1?1-ssr/sst:null,acc=100*a.filter(x=>corrosionClass('carbon_steel',x.referenceCorrosion)===x.calcClass).length/a.length;$('#benchmarkKpis').innerHTML=cards([['有效点',a.length,'/26'],['MAE',fmt(mae),'μm/a'],['MAPE',fmt(mape),'%'],['RMSE',fmt(rmse),'μm/a'],['R²',fmt(r2,3),''],['等级命中',fmt(acc),'%']])}
async function runBenchmark(){
 state.benchmarkStop=false;state.benchmarkRows=BENCHMARK_POINTS.map(p=>({...p,status:'待计算'}));renderBenchmarkRows();$('#benchmarkKpis').textContent='参考比对进行中，日期与单位元数据未确认，不作为同期验证结果。';const year=Number($('#year').value)||2025;
 let base;try{base=snapshot({mode:'historical',height:2,exposureZone:'atmospheric',material:'carbon_steel',designLife:25,requestedYears:[year],validationMode:true})}catch(e){toast(e.message);return}
 $('#benchmarkBtn').disabled=true;
 try{for(let i=0;i<state.benchmarkRows.length;i++){if(state.benchmarkStop)break;const p=state.benchmarkRows[i];p.status='计算中';renderBenchmarkRows();
  try{const input=structuredClone(base);input.cfg.latitude=p.latitude;input.cfg.longitude=p.longitude;const d=await benchmarkCoordinator.run(input);p.calc=d.summary.firstYearCorrosion;p.calcClass=d.summary.corrosionClass;p.diff=Number.isFinite(p.calc)?p.calc-p.referenceCorrosion:null;p.err=Number.isFinite(p.diff)?Math.abs(p.diff)/p.referenceCorrosion*100:null;p.status=Number.isFinite(p.calc)?'完成':'有效覆盖不足'}catch(e){p.status=e.name==='AbortError'?'已取消':'失败：'+e.message}
  renderBenchmarkRows();benchmarkStats();$('#benchmarkBar').style.width=(100*(i+1)/26)+'%';
 }}finally{$('#benchmarkBtn').disabled=false;toast(state.benchmarkStop?'参考比对已停止':'26点参考比对结束（非同期独立验证）')}
}
function exportJson(){
 if(!state.result)return toast('请先计算');const payload={schemaVersion:'3.2.8',modelVersion:'3.2.8',exportedAt:new Date().toISOString(),result:state.result,calibrationAudit:CALIBRATION_META,calibrationModel:state.result.calibrationModel};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='marine-corrosion-v3.2.8-'+(state.result.project.year||'period')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function bind(){
 $$('[data-page]').forEach(b=>b.onclick=()=>{setPage(b.dataset.page);$('#mobileMenu').classList.add('hidden');$('#mobileMenuBtn').setAttribute('aria-expanded','false')});
 $('#mobileMenuBtn').onclick=()=>{const open=$('#mobileMenu').classList.toggle('hidden')===false;$('#mobileMenuBtn').setAttribute('aria-expanded',String(open))};
 $('#adminTop').onclick=()=>setPage('admin');$('#runBtn').onclick=run;$('#mode').onchange=modeChanged;$('#drawerClose').onclick=()=>$('#drawer').classList.remove('open');$('#projectName').oninput=e=>$('#projectNameTop').textContent=e.target.value;$('#adminLogin').onclick=adminLogin;$('#saveParams').onclick=()=>{try{saveAdmin()}catch(e){toast(e.message)}};$('#resetParams').onclick=resetAdmin;
 $('#printBtn').onclick=()=>window.print();$('#jsonBtn').onclick=exportJson;$('#benchmarkBtn').onclick=runBenchmark;$('#benchmarkStop').onclick=()=>{state.benchmarkStop=true;benchmarkCoordinator.cancel()};
 $('#cancelRun').onclick=()=>coordinator.cancel();$('#retryRun').onclick=()=>{const saved=lastSnapshot||safeJson(localStorage.getItem('marineRunCheckpoint328'),null);if(saved)runWithSnapshot(saved);else toast('没有可恢复的任务')};$('#refreshRun').onclick=()=>{try{runWithSnapshot(snapshot(),{fresh:true})}catch(e){toast(e.message)}};
 $('#recheckDirect').onclick=async()=>{coordinator.blockedDirect=null;await health()};
 $('#calibrationImport').onchange=async event=>{const f=event.target.files[0];if(!f)return;if(!state.admin){toast('请先完成本机管理员验证');event.target.value='';return}try{if(f.size>10000000)throw new Error('校核文件不能超过10MB');const data=JSON.parse(await f.text()),records=Array.isArray(data)?data:data.records;if(!Array.isArray(records)||records.length>10000)throw new Error('请提供不超过10000条记录的JSON');const model=buildCalibration(records);if(model.status!=='fitted'){renderCalibration(model,chart);throw new Error(model.reason)}calibrationModel=model;localStorage.setItem('marineCalibration328',JSON.stringify(model));renderCalibration(model,chart);toast('已完成站点分组拟合与留出统计；重新计算后在适用地点生效')}catch(e){toast(e.message)}finally{event.target.value=''}};
 $('#clearCalibration').onclick=()=>{if(!state.admin)return toast('请先完成本机管理员验证');calibrationModel=null;localStorage.removeItem('marineCalibration328');renderCalibration(null,chart);toast('已停用局地校准，重新计算后生效')};
 window.addEventListener('resize',()=>{resizeCharts();state.map?.invalidateSize()});renderCalibration(calibrationModel,chart);referenceUI=initReferenceComparison({snapshot,coordinator:referenceCoordinator,chart,toast});
}
initYear();initMap();bind();modeChanged();health();setPage(new URLSearchParams(location.search).get('page')||'overview');
