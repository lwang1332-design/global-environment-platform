(()=>{
'use strict';
const TYPE_LABELS={normal:'常规环境',humidity:'高湿/凝露',rain:'降雨/风驱雨',dust:'沙尘/粉尘',heat:'高温/热管理',mist:'大雾/海雾/携液',salt:'盐雾/盐分',altitude:'高海拔/低气压',cold:'低温',snow:'暴雪/结冰',marine:'海洋综合环境',industry:'工矿腐蚀/污染'};
let excelBook=null,excelFileName='',excelCandidate=null,excelValidation=null,excelApplied=false;

function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]))}
function txt(v){return String(v??'').trim()}
function enabled(v){const s=txt(v).toLowerCase();return !['否','false','0','停用','禁用','no'].includes(s)}
function splitMulti(v){return String(v??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function splitCodes(v){return String(v??'').split(/[,，、;；\s]+/).map(x=>x.trim()).filter(Boolean)}
function num(v,fallback=999){const n=Number(v);return Number.isFinite(n)?n:fallback}
function get(o,...keys){for(const k of keys){if(Object.prototype.hasOwnProperty.call(o,k)&&txt(o[k])!=='')return o[k]}return''}
function typeCn(code){return TYPE_LABELS[code]||code||'—'}
function scenarioNames(){return Object.keys(workingScenarios||{})}


const MODULE_NAMES=['总体架构与热管理','环境隔离与防护','湿度与凝露控制','低温防护与防冰','腐蚀与材料防护','特殊环境专项防护','智能监测与环境控制'];
const PLAN_LEVELS={Standard:'标准方案',Pro:'强化方案',Plus:'极致方案'};
function classifyPlan(v){
 const t=String(v||''),explicit=t.match(/^\s*\[(0[1-7])\]/);
 if(explicit)return Number(explicit[1])-1;
 if(/监测|预警|传感|智能|联动|控制策略|远程|预测|在线监控|状态诊断|数据采集|压差监控/.test(t))return 6;
 if(/盐雾|腐蚀|防腐|涂层|耐蚀|不锈钢|镀锌|异种金属|材料防护|C5|CX|防锈/.test(t))return 4;
 if(/沙尘|沙蚀|防沙|高海拔|低气压|紫外|UV|台风|雷电|防雷|防霉|霉菌|生物|暴雪|风吹雪|特殊环境/.test(t))return 5;
 if(/凝露|露点|湿度|除湿|防潮|湿膜|干燥|加湿/.test(t))return 2;
 if(/低温|保温|防冰|结冰|伴热|防冻|融冰|预热|加热|冷启动|低温润滑|防寒/.test(t))return 3;
 if(/防雨|防水|风驱雨|防尘|密封|过滤|滤芯|百叶|排水|进风口防护|迷宫|IPX|IP[0-9]/.test(t))return 1;
 return 0;
}
function normalizeMeasure(v){return String(v||'').replace(/^\s*\[0[1-7]\]\s*/,'')}
function moduleDetailRows(scenarios){
 const rows=[];
 for(const [scene,d] of Object.entries(scenarios||{}))for(const [level,cn] of Object.entries(PLAN_LEVELS)){
  const buckets=MODULE_NAMES.map(()=>[]);
  (d.plans?.[level]||[]).forEach(value=>buckets[classifyPlan(value)].push(normalizeMeasure(value)));
  for(let m=0;m<7;m++){
   const code=String(m+1).padStart(2,'0');
   if(!buckets[m].length)rows.push([scene,cn,code,MODULE_NAMES[m],'']);
   else for(const value of buckets[m])rows.push([scene,cn,code,MODULE_NAMES[m],value]);
  }
 }
 return rows;
}
function parseDetailSheet(book,scenes,baseline){
 if(!book.Sheets['06_七模块明细'])return null;
 const old=excelBook;excelBook=book;let rows;
 try{rows=rowsFromSheet('06_七模块明细',['技术措施']);}finally{excelBook=old;}
 const errors=[],slots=new Set(),records=new Map(),allowed=new Set(scenes);
 const nameToLevel=Object.fromEntries(Object.entries(PLAN_LEVELS).map(([k,v])=>[v,k]));
 for(const r of rows){
  const scene=txt(r['场景']),level=nameToLevel[txt(r['方案名称'])],code=txt(r['模块编号']).padStart(2,'0'),m=Number(code)-1;
  if(!allowed.has(scene)||!level||m<0||m>6||code!==String(m+1).padStart(2,'0')){
   errors.push('06明细 第'+r.__row+'行：场景、方案名称或模块编号无效');continue;
  }
  if(txt(r['技术模块'])!==MODULE_NAMES[m]){errors.push('06明细 第'+r.__row+'行：模块名称与编号不一致');continue;}
  slots.add(scene+'|'+level+'|'+code);
  const value=String(r['技术措施']||'').trim();if(!value)continue;
  const key=scene+'|'+level,arr=records.get(key)||[];arr.push({module:m,text:value});records.set(key,arr);
 }
 for(const scene of scenes)for(const level of Object.keys(PLAN_LEVELS))for(let m=1;m<=7;m++){
  const key=scene+'|'+level+'|'+String(m).padStart(2,'0');if(!slots.has(key))errors.push('06明细缺少模块：'+key);
 }
 const plans=new Map();
 for(const scene of scenes)for(const level of Object.keys(PLAN_LEVELS)){
  const key=scene+'|'+level,arr=records.get(key)||[];
  const original=baseline?.[scene]?.plans?.[level]||[];
  const queues=MODULE_NAMES.map(()=>[]);
  original.forEach((raw,i)=>queues[classifyPlan(raw)].push({raw:String(raw),index:i}));
  const used=new Set(),output=[];
  for(const rec of arr){
   const queue=queues[rec.module]||[];
   const match=queue.find(x=>!used.has(x.index)&&normalizeMeasure(x.raw)===rec.text);
   if(match){used.add(match.index);output.push({index:match.index,text:match.raw});}
   else output.push({index:original.length+output.length,text:'['+String(rec.module+1).padStart(2,'0')+'] '+rec.text});
  }
  output.sort((a,b)=>a.index-b.index);
  plans.set(key,output.map(x=>x.text));
 }
 return{errors,plans,slots:slots.size};
}

function ensureXlsx(){if(typeof XLSX==='undefined')throw new Error('Excel 解析组件未加载，请刷新页面后重试；如公司网络拦截公共 CDN，请联系管理员将 SheetJS 改为本地依赖。')}

function installStyle(){
 const st=document.createElement('style');
 st.textContent=`
 .excel-flow{border-left:4px solid var(--blue)}.excel-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.excel-step{padding:9px;border:1px solid var(--line);border-radius:9px;background:#f8faff}.excel-step b{display:block;color:var(--nav);font-size:11px}.excel-step small{color:var(--muted);font-size:9px}.excel-status{margin-top:10px}.excel-status ul{margin:6px 0 0;padding-left:18px}.excel-status .warn{color:#9a5b08}.excel-status .bad{color:var(--red)}.excel-status .good{color:var(--green)}.excel-preview{margin-top:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden}.excel-preview-head{display:flex;gap:8px;flex-wrap:wrap;padding:9px;background:#f6f8fb;border-bottom:1px solid var(--line)}.diff-pill{padding:4px 7px;border-radius:99px;background:#eef5ff;color:#164a99;font-size:9px;font-weight:700}.diff-table{width:100%;border-collapse:collapse;font-size:10px}.diff-table th,.diff-table td{padding:7px;border-bottom:1px solid #edf0f4;text-align:left;vertical-align:top}.diff-table th{background:#fbfcfd;position:sticky;top:0}.diff-scroll{max-height:330px;overflow:auto}.chg-add{color:var(--green);font-weight:700}.chg-del{color:var(--red);font-weight:700}.chg-mod{color:#9a5b08;font-weight:700}.btn[disabled]{opacity:.45;cursor:not-allowed}@media(max-width:760px){.excel-steps{grid-template-columns:1fr 1fr}.diff-table{min-width:760px}}
 `;
 document.head.appendChild(st);
}

function installUi(){
 const publishCard=[...document.querySelectorAll('.card')].find(c=>c.querySelector('h2')?.textContent.includes('云端发布与版本管理'));
 if(!publishCard||document.getElementById('excelImportCard'))return;
 const card=document.createElement('div');card.className='card excel-flow';card.id='excelImportCard';
 card.innerHTML=`<h2>Excel 技术货架导入</h2>
 <div class="note">支持单独导入06_七模块明细（可附带方案附加信息），也支持原04—07全量模板；未涉及的场景与规则保持不变。Excel 仅在当前浏览器本地解析；通过校验并确认发布后，才写入 Supabase 云端参数库。</div>
 <div class="excel-steps">
   <div class="excel-step"><b>① 导入 Excel</b><small>选择 .xlsx / .xls 文件</small></div>
   <div class="excel-step"><b>② 数据校验</b><small>字段、场景、类型、04→05映射</small></div>
   <div class="excel-step"><b>③ 预览变化</b><small>与当前云端正式版逐项比较</small></div>
   <div class="excel-step"><b>④ 发布云端</b><small>先应用到编辑区，再确认发布</small></div>
 </div>
 <div class="toolbar">
   <button class="btn secondary" id="excelExportBtn">导出当前货架 Excel</button>
   <label class="btn secondary" style="cursor:pointer">① 选择 Excel<input id="excelFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" style="display:none"></label>
   <button class="btn primary" id="excelValidateBtn" disabled>② 数据校验</button>
   <button class="btn secondary" id="excelPreviewBtn" disabled>③ 预览变化</button>
   <button class="btn secondary" id="excelApplyBtn" disabled>应用到编辑区</button>
   <button class="btn primary" id="excelPublishBtn" disabled>④ 发布云端</button>
 </div>
 <div id="excelFileMeta" class="note" style="margin-top:8px">尚未选择 Excel 文件。</div>
 <div id="excelStatus" class="excel-status"></div>
 <div id="excelPreview" class="excel-preview hidden"></div>`;
 publishCard.parentNode.insertBefore(card,publishCard);
 document.getElementById('excelFile').addEventListener('change',onExcelFile);
 document.getElementById('excelValidateBtn').onclick=validateExcel;
 document.getElementById('excelPreviewBtn').onclick=showPreview;
 document.getElementById('excelApplyBtn').onclick=applyExcel;
 document.getElementById('excelPublishBtn').onclick=publishExcel;
 document.getElementById('excelExportBtn').onclick=exportExcel;
}

async function onExcelFile(e){
 const f=e.target.files?.[0];if(!f)return;
 excelBook=null;excelCandidate=null;excelValidation=null;excelApplied=false;excelFileName=f.name;
 document.getElementById('excelPreview').classList.add('hidden');
 document.getElementById('excelPreview').innerHTML='';
 document.getElementById('excelStatus').innerHTML='';
 try{
   ensureXlsx();const buf=await f.arrayBuffer();excelBook=XLSX.read(buf,{type:'array',cellDates:false});
   document.getElementById('excelFileMeta').textContent=`已读取：${f.name} ｜ ${(f.size/1024).toFixed(1)} KB ｜ 工作表：${excelBook.SheetNames.join('、')}`;
   document.getElementById('excelValidateBtn').disabled=false;
   document.getElementById('excelPreviewBtn').disabled=true;document.getElementById('excelApplyBtn').disabled=true;document.getElementById('excelPublishBtn').disabled=true;
 }catch(err){showExcelError('Excel 读取失败：'+err.message)}
}

function rowsFromSheet(name,markerAliases){
 const ws=excelBook?.Sheets?.[name];if(!ws)throw new Error(`缺少工作表：${name}`);
 const grid=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
 const idx=grid.findIndex(row=>markerAliases.some(m=>row.some(c=>txt(c)===m)));
 if(idx<0)throw new Error(`${name} 未找到表头：${markerAliases.join(' / ')}`);
 const headers=grid[idx].map(x=>txt(x));
 return grid.slice(idx+1).filter(r=>r.some(c=>txt(c)!=='')).map((r,i)=>{
   const o={__row:idx+2+i};headers.forEach((h,j)=>{if(h)o[h]=r[j]??''});return o;
 });
}


const SCENE_ALIASES={
 '常温、内陆气候\n（不含盐湖）':'常温内陆气候',
 '热带雨林气候或亚热带/热带季风气候区':'热带雨林气候',
 '滨海盐雾气候\n（不含盐湖）':'滨海盐雾气候',
 '沙戈荒气候\n':'沙戈荒气候',
 '高温环境':'高温环境',
 '高海拔高寒环境\n':'高原高寒气候',
 '极寒暴雪环境':'寒地暴雪气候',
 '海洋气候':'海洋气候'
};
function resolveScenario(raw){const s=String(raw??'');return SCENE_ALIASES[s]||SCENE_ALIASES[s.trim()]||s.trim()}
function parseOnly06Workbook(){
 const errors=[],warnings=[],detail=rowsFromSheet('06_七模块明细',['技术措施']);
 const names=new Set(Object.keys(workingScenarios)),levels={标准方案:'Standard',强化方案:'Pro',极致方案:'Plus'};
 const buckets=new Map(),slots=new Map();
 for(const r of detail){
  const scene=resolveScenario(r['场景']),level=levels[txt(r['方案名称'])],code=txt(r['模块编号']).padStart(2,'0'),module=Number(code)-1;
  if(!names.has(scene)||!level||module<0||module>=MODULE_NAMES.length){errors.push('06第'+r.__row+'行：场景、方案或模块编号错误');continue;}
  if(txt(r['技术模块'])!==MODULE_NAMES[module]){errors.push('06第'+r.__row+'行：模块编号与名称不一致');continue;}
  const key=scene+'|'+level,cell=key+'|'+code;
  if(slots.has(cell)){errors.push('06第'+r.__row+'行：重复模块位置 '+cell);continue;}
  slots.set(cell,true);
  const bin=buckets.get(key)||[];bin.push({module,value:String(r['技术措施']??'')});buckets.set(key,bin);
 }
 const selected=[...new Set([...buckets.keys()].map(k=>k.split('|')[0]))];
 for(const scene of selected)for(const level of Object.values(levels))for(let i=1;i<=7;i++){
  if(!slots.has(scene+'|'+level+'|'+String(i).padStart(2,'0')))errors.push('06缺少模块：'+scene+' '+level+' '+i);
 }
 const result=clone(workingScenarios);
 for(const [key,records] of buckets){const [scene,level]=key.split('|');result[scene].plans[level]=records.sort((a,b)=>a.module-b.module).filter(x=>x.value.trim()).map(x=>'['+String(x.module+1).padStart(2,'0')+'] '+x.value);}
 if(excelBook.Sheets['方案附加信息']){
  for(const r of rowsFromSheet('方案附加信息',['主要风险'])){
   const scene=resolveScenario(r['场景']),level=levels[txt(r['方案名称'])];
   if(!names.has(scene)||!level){warnings.push('附加信息第'+r.__row+'行无法匹配场景或方案');continue;}
   const meta={...(result[scene].planMeta?.[level]||{})};
   meta.mainRisk=r['主要风险']??'';meta.positioning=r['方案定位']??'';
   meta.costChange=r['成本预估']??'';
   result[scene].planMeta={...(result[scene].planMeta||{}),[level]:meta};
  }
 }
 return {errors,warnings,candidate:{scenarios:result,packages:clone(workingPackages)},stats:{demands:0,reqs:0,plans:selected.length,packages:workingPackages.length,slots:slots.size}};
}

function parseWorkbook(){
 if(excelBook?.Sheets?.['06_七模块明细']&&!excelBook.Sheets['04_客户诉求'])return parseOnly06Workbook();
 const errors=[],warnings=[],scenes=scenarioNames(),sceneSet=new Set(scenes),knownTypes=new Set(Object.keys(TYPE_LABELS));
 const detail=parseDetailSheet(excelBook,scenes,workingScenarios);if(detail)errors.push(...detail.errors);
 const r04=rowsFromSheet('04_客户诉求',['客户诉求标题']);
 const r05=rowsFromSheet('05_设计需求',['设计需求 / 验证要求','设计需求/验证要求','设计需求']);
 const r06=excelBook.Sheets['06_场景方案']?rowsFromSheet('06_场景方案',['Standard']):[];
 if(!r06.length&&!detail)throw new Error('缺少06方案数据：请提供06_七模块明细工作表');
 const r07=rowsFromSheet('07_升级包',['升级包名称']);

 const demands=[];const dSeqSeen=new Set();
 for(const r of r04){if(!enabled(get(r,'启用')))continue;const scene=txt(get(r,'场景')),title=txt(get(r,'客户诉求标题','客户诉求')),desc=txt(get(r,'客户语言描述','客户描述')),type=txt(get(r,'类型代码','触发类型代码')),seq=num(get(r,'场景内序号','序号'),999);
   if(!sceneSet.has(scene)){errors.push(`04 第${r.__row}行：未知场景“${scene||'空'}”`);continue}
   if(!title)errors.push(`04 第${r.__row}行：客户诉求标题不能为空`);if(!type)errors.push(`04 第${r.__row}行：类型代码不能为空`);
   const sk=`${scene}|${seq}`;if(seq!==999&&dSeqSeen.has(sk))warnings.push(`04 ${scene}：场景内序号 ${seq} 重复`);dSeqSeen.add(sk);
   if(type&&!knownTypes.has(type))warnings.push(`04 第${r.__row}行：类型代码“${type}”不是当前内置类型，将按自定义类型导入`);
   demands.push({scene,title,desc,type,seq,row:r.__row});
 }

 const reqs=[];
 for(const r of r05){if(!enabled(get(r,'启用')))continue;const scene=txt(get(r,'场景')),type=txt(get(r,'类型代码')),text=txt(get(r,'设计需求 / 验证要求','设计需求/验证要求','设计需求','产品设计需求')),seq=num(get(r,'类型内序号','序号'),999);
   if(!sceneSet.has(scene)){errors.push(`05 第${r.__row}行：未知场景“${scene||'空'}”`);continue}if(!type)errors.push(`05 第${r.__row}行：类型代码不能为空`);if(!text)errors.push(`05 第${r.__row}行：设计需求不能为空`);
   if(type&&!knownTypes.has(type))warnings.push(`05 第${r.__row}行：类型代码“${type}”不是当前内置类型，将按自定义类型导入`);
   reqs.push({scene,type,text,seq,row:r.__row});
 }

 const plans=[];const planSeen=new Set();
 for(const r of r06){if(!enabled(get(r,'启用')))continue;const scene=txt(get(r,'场景'));if(!sceneSet.has(scene)){errors.push(`06 第${r.__row}行：未知场景“${scene||'空'}”`);continue}if(planSeen.has(scene))errors.push(`06：场景“${scene}”出现多行`);planSeen.add(scene);
   plans.push({scene,Standard:splitMulti(get(r,'Standard')),Pro:splitMulti(get(r,'Pro')),Plus:splitMulti(get(r,'Plus')),planMeta:{Standard:{majorComponentPlan:txt(get(r,'Standard_大部件差异化配置','Standard大部件差异化配置','Standard_大部件差异化方案','Standard大部件差异化方案')),mainRisk:txt(get(r,'Standard_主要风险','Standard主要风险')),positioning:txt(get(r,'Standard_方案定位','Standard方案定位')),costChange:txt(get(r,'Standard_成本变化','Standard成本变化'))},Pro:{majorComponentPlan:txt(get(r,'Pro_大部件差异化配置','Pro大部件差异化配置','Pro_大部件差异化方案','Pro大部件差异化方案')),mainRisk:txt(get(r,'Pro_主要风险','Pro主要风险')),positioning:txt(get(r,'Pro_方案定位','Pro方案定位')),costChange:txt(get(r,'Pro_成本变化','Pro成本变化'))},Plus:{majorComponentPlan:txt(get(r,'Plus_大部件差异化配置','Plus大部件差异化配置','Plus_大部件差异化方案','Plus大部件差异化方案')),mainRisk:txt(get(r,'Plus_主要风险','Plus主要风险')),positioning:txt(get(r,'Plus_方案定位','Plus方案定位')),costChange:txt(get(r,'Plus_成本变化','Plus成本变化'))}},row:r.__row});
 }
 if(detail){for(const scene of scenes){let p=plans.find(x=>x.scene===scene);if(!p){p={scene,planMeta:clone(workingScenarios[scene]?.planMeta||{})};plans.push(p);planSeen.add(scene);}for(const level of Object.keys(PLAN_LEVELS))p[level]=detail.plans.get(scene+'|'+level)||[];}}
 for(const scene of scenes)if(!planSeen.has(scene))errors.push(`06：缺少场景“${scene}”的 标准方案 / 强化方案 / 极致方案 方案行`);

 const pkgs=[];const pkgSeen=new Set();
 for(const r of r07){if(!enabled(get(r,'启用')))continue;const name=txt(get(r,'升级包名称','升级包')),applicable=txt(get(r,'适用风险 / 触发条件','适用风险/触发条件','适用风险','触发条件')),measures=txt(get(r,'具体措施','具体方案/措施','措施')),types=splitCodes(get(r,'触发类型代码','类型代码')),order=num(get(r,'排序','序号'),999);
   if(!name){errors.push(`07 第${r.__row}行：升级包名称不能为空`);continue}if(pkgSeen.has(name))errors.push(`07：升级包“${name}”重复`);pkgSeen.add(name);
   if(!measures)warnings.push(`07 ${name}：具体措施为空`);if(!types.length)warnings.push(`07 ${name}：触发类型代码为空，将不会被环境类型自动触发`);
   types.filter(t=>!knownTypes.has(t)).forEach(t=>warnings.push(`07 ${name}：类型代码“${t}”不是当前内置类型`));
   pkgs.push({name,applicable,measures,types,order,row:r.__row});
 }

 const demandPairs=new Set(demands.filter(x=>x.type).map(x=>`${x.scene}|${x.type}`));const reqPairs=new Set(reqs.filter(x=>x.type&&x.text).map(x=>`${x.scene}|${x.type}`));
 for(const pair of demandPairs)if(!reqPairs.has(pair)){const [scene,type]=pair.split('|');errors.push(`04→05 映射缺失：${scene} 的客户诉求类型 ${type}（${typeCn(type)}）在05中没有设计需求`)}
 for(const pair of reqPairs)if(!demandPairs.has(pair)){const [scene,type]=pair.split('|');warnings.push(`05 孤立需求：${scene} / ${type} 在04没有对应客户诉求`)}
 for(const scene of scenes)if(!demands.some(x=>x.scene===scene))errors.push(`04：场景“${scene}”没有任何启用的客户诉求`);

 const baseline=clone(cloudRow?.config?.scenarios||workingScenarios);const candidateScenarios={};
 for(const scene of scenes){const base=clone(baseline[scene]||workingScenarios[scene]||{});const ds=demands.filter(x=>x.scene===scene).sort((a,b)=>a.seq-b.seq);const rq={};reqs.filter(x=>x.scene===scene).sort((a,b)=>a.seq-b.seq).forEach(x=>(rq[x.type]||(rq[x.type]=[])).push(x.text));const p=plans.find(x=>x.scene===scene);
   candidateScenarios[scene]={...base,demands:ds.map(x=>[x.title,x.desc,x.type]),reqs:rq,plans:p?{Standard:p.Standard,Pro:p.Pro,Plus:p.Plus}:clone(base.plans||{Standard:[],Pro:[],Plus:[]}),planMeta:p?.planMeta||clone(base.planMeta||{})};
 }
 const candidatePackages=pkgs.sort((a,b)=>a.order-b.order).map(x=>[x.name,x.applicable,x.measures,x.types]);
 return{errors,warnings,candidate:{scenarios:candidateScenarios,packages:candidatePackages},stats:{demands:demands.length,reqs:reqs.length,plans:plans.length,packages:candidatePackages.length,slots:detail?.slots||0}};
}

function renderValidation(v){
 const el=document.getElementById('excelStatus');const parts=[];
 parts.push(`<div class="msg ${v.errors.length?'err':'ok'}"><b>${v.errors.length?'校验未通过':'校验通过'}</b>：04客户诉求 ${v.stats.demands} 条；05设计需求 ${v.stats.reqs} 条；06场景方案 ${v.stats.plans} 个场景；七模块位置 ${v.stats.slots||'旧版模板未提供'}；07升级包 ${v.stats.packages} 个。</div>`);
 if(v.errors.length)parts.push(`<div class="bad"><b>错误 ${v.errors.length} 项：</b><ul>${v.errors.slice(0,40).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${v.errors.length>40?'<div>其余错误请修正后重新导入。</div>':''}</div>`);
 if(v.warnings.length)parts.push(`<div class="warn"><b>提醒 ${v.warnings.length} 项：</b><ul>${v.warnings.slice(0,30).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`);
 el.innerHTML=parts.join('');
}

function validateExcel(){
 if(!excelBook)return;
 try{excelValidation=parseWorkbook();excelCandidate=excelValidation.candidate;excelApplied=false;renderValidation(excelValidation);const ok=!excelValidation.errors.length;document.getElementById('excelPreviewBtn').disabled=!ok;document.getElementById('excelApplyBtn').disabled=!ok;document.getElementById('excelPublishBtn').disabled=true;if(ok)buildPreview();}
 catch(err){excelCandidate=null;showExcelError('数据校验失败：'+err.message)}
}

function flattenCfg(cfg){
 const out={demand:new Map(),req:new Map(),plan:new Map(),pkg:new Map()};const sc=cfg?.scenarios||{};
 for(const [scene,d] of Object.entries(sc)){
   (d.demands||[]).forEach(x=>out.demand.set(`${scene}|${x[0]}|${x[2]}`,x[1]||''));
   for(const [type,arr] of Object.entries(d.reqs||{}))(arr||[]).forEach(x=>out.req.set(`${scene}|${type}|${x}`,''));
   for(const level of ['Standard','Pro','Plus']){
     ((d.plans||{})[level]||[]).forEach(x=>out.plan.set(`${scene}|${level}|${x}`,''));
     const m=d.planMeta?.[level]||{};
     if(m.majorComponentPlan)out.plan.set(`${scene}|${level}|大部件差异化配置`,m.majorComponentPlan);
     if(m.mainRisk)out.plan.set(`${scene}|${level}|主要风险`,m.mainRisk);
     if(m.positioning)out.plan.set(`${scene}|${level}|方案定位`,m.positioning);
     if(m.costChange)out.plan.set(`${scene}|${level}|成本变化`,m.costChange);
   }
 }
 (cfg?.packages||[]).forEach(p=>out.pkg.set(p[0],JSON.stringify([p[1]||'',p[2]||'',p[3]||[]])));return out;
}
function niceKey(module,key){const a=key.split('|');if(module==='04 客户诉求')return`${a[0]}｜${a[1]}｜${typeCn(a[2])}`;if(module==='05 设计需求')return`${a[0]}｜${typeCn(a[1])}｜${a.slice(2).join('|')}`;if(module==='06 场景方案')return`${a[0]}｜${a[1]}｜${a.slice(2).join('|')}`;return key}
function diffMap(module,b,a){const rows=[];for(const [k,v] of a)if(!b.has(k))rows.push({module,obj:niceKey(module,k),change:'新增',old:'',next:v||niceKey(module,k)});else if(b.get(k)!==v)rows.push({module,obj:niceKey(module,k),change:'修改',old:b.get(k),next:v});for(const [k,v] of b)if(!a.has(k))rows.push({module,obj:niceKey(module,k),change:'删除',old:v||niceKey(module,k),next:''});return rows}
function diffPackage(b,a){const rows=[];for(const [k,v] of a)if(!b.has(k))rows.push({module:'07 升级包',obj:k,change:'新增',old:'',next:v});else if(b.get(k)!==v)rows.push({module:'07 升级包',obj:k,change:'修改',old:b.get(k),next:v});for(const [k,v] of b)if(!a.has(k))rows.push({module:'07 升级包',obj:k,change:'删除',old:v,next:''});return rows}
function candidateConfig(){const base=clone(cloudRow?.config||compose());base.scenarios=clone(excelCandidate.scenarios);base.packages=clone(excelCandidate.packages);return base}
function getDiff(){const b=flattenCfg(cloudRow?.config||compose()),a=flattenCfg(candidateConfig());return[...diffMap('04 客户诉求',b.demand,a.demand),...diffMap('05 设计需求',b.req,a.req),...diffMap('06 场景方案',b.plan,a.plan),...diffPackage(b.pkg,a.pkg)]}

function buildPreview(){
 const diffs=getDiff();const counts={};for(const d of diffs){counts[d.module]=(counts[d.module]||0)+1}const html=`<div class="excel-preview-head"><span class="diff-pill">基线：${esc(cloudRow?.version||'当前云端')}</span><span class="diff-pill">04 变化 ${counts['04 客户诉求']||0}</span><span class="diff-pill">05 变化 ${counts['05 设计需求']||0}</span><span class="diff-pill">06 变化 ${counts['06 场景方案']||0}</span><span class="diff-pill">07 变化 ${counts['07 升级包']||0}</span><span class="diff-pill">合计 ${diffs.length}</span></div><div class="diff-scroll"><table class="diff-table"><thead><tr><th>模块</th><th>对象</th><th>变化</th><th>当前云端</th><th>Excel 导入</th></tr></thead><tbody>${diffs.length?diffs.slice(0,300).map(d=>`<tr><td>${esc(d.module)}</td><td>${esc(d.obj)}</td><td class="${d.change==='新增'?'chg-add':d.change==='删除'?'chg-del':'chg-mod'}">${d.change}</td><td>${esc(d.old)}</td><td>${esc(d.next)}</td></tr>`).join(''):'<tr><td colspan="5">Excel 与当前云端 04～07 内容一致，无变化。</td></tr>'}</tbody></table></div>${diffs.length>300?'<div class="note" style="padding:8px">变化超过300项，页面只展示前300项；发布时仍会应用全部通过校验的数据。</div>':''}`;
 const el=document.getElementById('excelPreview');el.innerHTML=html;return diffs;
}
function showPreview(){if(!excelCandidate)return;buildPreview();document.getElementById('excelPreview').classList.remove('hidden')}

function applyExcel(){
 if(!excelCandidate||excelValidation?.errors?.length)return;if(!confirm('确认用 Excel 中的 04、05、06、07 内容替换当前编辑区？02 风险规则及场景识别参数不会被修改。'))return;
 workingScenarios=clone(excelCandidate.scenarios);workingPackages=clone(excelCandidate.packages);excelApplied=true;markDirty(`Excel“${excelFileName}”已应用到编辑区，尚未发布到云端。`);initEditors();document.getElementById('excelPublishBtn').disabled=false;document.getElementById('excelStatus').insertAdjacentHTML('beforeend','<div class="msg ok">已应用到编辑区。请检查页面内容，确认后点击“④ 发布云端”。</div>');
}
async function publishExcel(){
 if(!excelApplied){alert('请先点击“应用到编辑区”。');return}if(!confirm(`确认将 Excel“${excelFileName}”对应的 04～07 技术货架正式发布到云端？发布后其他用户刷新页面将读取新版本。`))return;
 if(!$('publishDesc').value.trim())$('publishDesc').value=`Excel导入：${excelFileName}`;await publishCloud();excelApplied=false;document.getElementById('excelPublishBtn').disabled=true;
}

function aoaSheet(title,headers,rows){return XLSX.utils.aoa_to_sheet([[title],[],headers,...rows])}
function exportExcel(){
 try{ensureXlsx();const cfg=compose(),wb=XLSX.utils.book_new();const dRows=[],rRows=[];(Object.entries(cfg.scenarios||{})).forEach(([scene,d])=>{(d.demands||[]).forEach((x,i)=>dRows.push([`DMD`,scene,i+1,x[0],x[1],typeCn(x[2]),x[2],'是','']));for(const [type,arr] of Object.entries(d.reqs||{}))(arr||[]).forEach((x,i)=>rRows.push(['REQ',scene,typeCn(type),type,i+1,x,'是','']));});const kRows=(cfg.packages||[]).map((p,i)=>['PKG',i+1,p[0],p[1],p[2],(p[3]||[]).map(typeCn).join('、'),(p[3]||[]).join(','),'是','']);
   XLSX.utils.book_append_sheet(wb,aoaSheet('04 客户核心诉求',['记录ID','场景','场景内序号','客户诉求标题','客户语言描述','类型中文','类型代码','启用','备注'],dRows),'04_客户诉求');
   XLSX.utils.book_append_sheet(wb,aoaSheet('05 产品设计需求',['记录ID','场景','类型中文','类型代码','类型内序号','设计需求 / 验证要求','启用','备注'],rRows),'05_设计需求');
   XLSX.utils.book_append_sheet(wb,aoaSheet('06 七模块逐条技术措施',['场景','方案名称','模块编号','技术模块','技术措施'],moduleDetailRows(cfg.scenarios)),'06_七模块明细');
   XLSX.utils.book_append_sheet(wb,aoaSheet('07 升级包',['记录ID','排序','升级包名称','适用风险 / 触发条件','具体措施','触发类型中文','触发类型代码','启用','备注'],kRows),'07_升级包');
   const dict=[['场景名称','', '类型代码','类型中文'],...scenarioNames().map((s,i)=>[s,'',Object.keys(TYPE_LABELS)[i]||'',Object.values(TYPE_LABELS)[i]||''])];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dict),'99_字典');
   XLSX.writeFile(wb,`环境技术货架_04-07_${cloudRow?.version||'draft'}.xlsx`);
 }catch(err){showExcelError('Excel 导出失败：'+err.message)}
}

function showExcelError(msg){document.getElementById('excelStatus').innerHTML=`<div class="msg err">${esc(msg)}</div>`;const ids=['excelPreviewBtn','excelApplyBtn','excelPublishBtn'];ids.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true})}

function boot(){installStyle();installUi()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
