/* Module 02 data reconciliation / externally supplied verified observations */
(function(){
'use strict';
const storageKey='env-v27-observations-v1';
const missing=new Set([8,9,10,13,15,20,21,23,24,25,29,30,31,32,35,42,43,45,46,48,49,50]);
const notes={
8:'需要逐小时露点和目标表面温度；不能由相对湿度直接给出设备凝露概率',
9:'需要目标表面温度与逐时露点的联合序列',
10:'需要连续凝露判定及运行时长',
13:'需明确阵风阈值、时间去重规则',
15:'需风速与矿物沙尘浓度同期逐小时记录',
20:'需冻雨观测或可靠再分析冻雨类型数据',
21:'盐沉积量需现场采样、专项沉积模型或验证过的公开产品',
23:'湿润时间需按指定温湿度判据与时间尺度统计',
24:'腐蚀风险需有经验证的腐蚀模型与相应输入',
25:'ISO 9223环境腐蚀分类需湿润时间及污染沉积资料',
29:'需多年沙尘暴事件判定数据库',
30:'需多年沙尘暴持续时间记录',
31:'需雪深逐日资料',
32:'需核实降雪转换单位或独立逐日降雪资料',
35:'需冻雨事件数据库',
42:'需项目H₂S观测',43:'需项目Cl₂观测',45:'需项目NH₃观测',
46:'需周边植被类型调查/土地覆盖数据',
48:'需台风路径与影响范围记录',
49:'需当地雷电密度监测或权威雷电网格数据',
50:'需明确生物风险评价对象和判定指标'
};
function context(){return [document.getElementById('lat')?.value||'',document.getElementById('lon')?.value||'',document.getElementById('periodYears')?.value||''].join('|')}
function get(){try{let v=JSON.parse(localStorage.getItem(storageKey)||'{}');return v.context===context()?v.values||{}:{}}catch(_){return {}}}
function labels(){return _envDefinitions.map((d,i)=>({id:i+1,group:d[0],name:d[1],unit:d[2]}))}
function clean(v){return String(v??'').replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]))}
function drawBanner(){
 const grid=document.getElementById('envGrid');if(!grid)return;
 let toolbar=document.getElementById('health-data-tools');
 if(toolbar)return;
 toolbar=document.createElement('div');toolbar.id='health-data-tools';
 toolbar.style.cssText='display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:10px 0;font-size:11px;color:#536780';
 toolbar.innerHTML='<strong>50项数据接入</strong><span id="health-data-count"></span><button type="button" id="health-csv-export">导出数据模板</button><button type="button" id="health-csv-import">导入已核实数据</button><input id="health-csv-file" type="file" accept=".csv,text/csv" style="display:none"><span style="color:#9b610d">项目坐标与统计周期变化后需重新导入专项观测</span>';
 grid.parentNode.insertBefore(toolbar,grid);
 const getButton=id=>document.getElementById(id);
 getButton('health-csv-export').onclick=()=>{
  const header=['序号','一级分类','二级参数','单位','数值','数据来源','观测时期','备注'];
  const rows=labels().map(x=>[x.id,x.group,x.name,x.unit,'','','',notes[x.id]||'']);
  const csv=[header,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  let url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='项目环境体检50项数据模板.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 getButton('health-csv-import').onclick=()=>getButton('health-csv-file').click();
 getButton('health-csv-file').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
   const raw=(await file.text()).replace(/^\ufeff/,'');
   function parseCSV(src){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<src.length;i++){let c=src[i];if(c==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows}
   const rows=parseCSV(raw);
   if(!rows.length||rows[0][0]!=='序号'||rows[0][4]!=='数值')throw Error('CSV列与导出模板不一致');
   const next={},def=labels();let rejected=0;
   for(let i=1;i<rows.length;i++){const row=rows[i],id=Number(row[0]),spec=def[id-1],val=(row[4]||'').trim();if(!val)continue;
    if(!spec||spec.name!==(row[2]||'').trim()||spec.unit!==(row[3]||'').trim()){rejected++;continue}
    let isCategory=id===20||id===25||id===46||id===50;
    if(!isCategory&&!Number.isFinite(Number(val))){rejected++;continue}
    if(!(row[5]||'').trim()||!(row[6]||'').trim()){rejected++;continue}
    next[id]={value:isCategory?val:Number(val),source:row[5],period:row[6],note:row[7]||''};
   }
   if(rejected)throw Error('存在'+rejected+'条单位/名称/数值错误，未导入');
   localStorage.setItem(storageKey,JSON.stringify({context:context(),values:next}));
   renderEnv();alert('已导入'+Object.keys(next).length+'项经人工提供的数据；仅保存当前浏览器和该坐标/周期。');
  }catch(e){alert('数据导入失败：'+e.message)}
  finally{event.target.value=''}
 };
}
const previous=renderEnv;
renderEnv=function(){
 previous();
 drawBanner();
 const values=get(),cards=[...document.querySelectorAll('#envGrid .health-card')];
 let ready=0,model=0,external=0,missingN=0;
 cards.forEach((card,groupIndex)=>{
  const groupName=Object.keys(_envDefinitions.reduce((a,x)=>(a[x[0]]=1,a),{}))[groupIndex];
  const defs=_envDefinitions.map((d,i)=>({d,id:i+1})).filter(x=>x.d[0]===groupName);
  const rows=[...card.querySelectorAll('.health-rows>div')];
  let firstKnown=null,numberKnown=0;
  defs.forEach((x,j)=>{
   const v=values[x.id];const row=rows[j];if(!row)return;
   const detail=envHealthExtra[x.id];
   if(v){
    const val=String(v.value)+' '+x.d[2];row.querySelector('b').textContent=val;
    row.title='专项数据 · '+v.source+' · '+v.period+(v.note?' · '+v.note:'');
    row.dataset.quality='observed';row.style.background='#f2f7fc';external++;
    if(!firstKnown)firstKnown={value:val,name:x.d[1]};
    numberKnown++;return;
   }
   if(!Number.isFinite(detail)&&(missing.has(x.id)||!x.d[3])){
    row.querySelector('b').textContent='待接入';
    row.title=notes[x.id]||'缺少经核验的数据源和统计口径';
    missingN++;return;
   }
   if(Number.isFinite(detail)){row.querySelector('b').textContent=(Math.round(detail*100)/100)+' '+x.d[2];row.title=[window.healthMetricProvenance?.[x.id]?.source||'ERA5/CAMS计算',window.healthMetricProvenance?.[x.id]?.note||'气象数据推导'].join(' · ');numberKnown++;model++;if(!firstKnown)firstKnown={value:row.querySelector('b').textContent,name:x.d[1]};}
   else if(row.querySelector('b').textContent!=='暂无数据'&&row.querySelector('b').textContent!=='待接入'){
    numberKnown++;model++;
    if(!firstKnown)firstKnown={value:row.querySelector('b').textContent,name:x.d[1]};
   }else missingN++;
  });
  const big=card.querySelector('.health-main'),sub=card.querySelector('.health-sub');
  // The first parameter is always the primary; the other four are secondary.
  const first=defs[0],firstImported=values[first.id],firstRow=rows[0];
  big.textContent=firstImported?firstImported.value+' '+first.d[2]:(firstRow?.querySelector('b')?.textContent||'待接入');
  sub.textContent=first.d[1];
  if(firstRow)firstRow.remove();
  const foot=card.querySelector('.health-foot');foot.textContent=numberKnown+'/5 项可用 · '+(numberKnown===0?'尚无可信数据':'含公开资料计算/专项录入');
  if(numberKnown)ready+=numberKnown;
 });
 const indicator=document.getElementById('health-data-count');
 if(indicator)indicator.textContent='可用 '+ready+'/50 项（公开数据 '+model+' 项、专项录入 '+external+' 项），待接入 '+missingN+' 项';
};
})();

/* Desktop: two rows of five cards. Responsive at narrower widths. */
(function(){const style=document.createElement('style');style.textContent='#envGrid.health-card-grid{grid-template-columns:repeat(5,minmax(0,1fr))}#envGrid .health-rows{grid-template-columns:1fr;gap:8px}#envGrid .health-card{padding:13px 12px}#envGrid .health-main{overflow-wrap:anywhere;font-size:19px}@media(max-width:900px){#envGrid.health-card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:680px){#envGrid.health-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:570px){#envGrid.health-card-grid{grid-template-columns:1fr}}';document.head.appendChild(style)})();
