const DEFAULT_RISK_RULES={
  t99:{label:'P99最高气温',unit:'℃',direction:'high',medium:40,high:45},
  tmin:{label:'极端最低气温',unit:'℃',direction:'low',medium:-20,high:-30},
  rhAvg:{label:'年均相对湿度',unit:'%',direction:'high',medium:75,high:85},
  rh90:{label:'相对湿度>90%小时数',unit:'h/y',direction:'high',medium:300,high:1000},
  rainYear:{label:'年降水量',unit:'mm/y',direction:'high',medium:900,high:1800},
  rain1h:{label:'最大1小时降水',unit:'mm/h',direction:'high',medium:30,high:80},
  snowHours:{label:'年降雪小时',unit:'h/y',direction:'high',medium:30,high:120},
  alt:{label:'海拔',unit:'m',direction:'high',medium:1500,high:3000},
  pm10:{label:'PM10平均浓度',unit:'μg/m³',direction:'high',medium:45,high:150},
  dust:{label:'沙尘（Dust）平均浓度',unit:'μg/m³',direction:'high',medium:50,high:150},
  so2:{label:'二氧化硫（SO₂）平均浓度',unit:'μg/m³',direction:'high',medium:5,high:20},
  salt:{label:'海盐气溶胶平均浓度',unit:'μg/m³',direction:'high',medium:5,high:20},
  wind95:{label:'P95风速',unit:'m/s',direction:'high',medium:10,high:15},
  rad95:{label:'P95太阳辐射',unit:'W/m²',direction:'high',medium:600,high:800}
};

const RISK_PARAM_CN={
  t99:'P99最高气温',
  tmin:'极端最低气温',
  rhAvg:'年均相对湿度',
  rh90:'相对湿度>90%小时数',
  rainYear:'年降水量',
  rain1h:'最大1小时降水',
  snowHours:'年降雪小时',
  alt:'海拔',
  pm10:'PM10平均浓度',
  dust:'沙尘（Dust）平均浓度',
  so2:'二氧化硫（SO₂）平均浓度',
  salt:'海盐气溶胶平均浓度',
  wind95:'P95风速',
  rad95:'P95太阳辐射'
};

const MATCH_RULE={high:70,medium:45,version:'V2.7-CORE-SUPPORT'};

function localizeAdminRiskRuleUI(){
  const body=document.getElementById('riskRuleBody');
  if(!body)return;
  const table=body.closest('table');
  const firstHead=table?.querySelector('thead th:first-child');
  if(firstHead&&firstHead.textContent!=='参数标识（中文）')firstHead.textContent='参数标识（中文）';
  body.querySelectorAll('tr').forEach(tr=>{
    const b=tr.querySelector('td:first-child b');
    if(!b)return;
    const key=b.dataset.ruleKey||b.textContent.trim();
    const cn=RISK_PARAM_CN[key]||key;
    b.dataset.ruleKey=key;
    if(b.textContent!==cn)b.textContent=cn;
    b.title=`内部参数标识：${key}`;
  });
}

function installAdminDraftWorkflow(){
  if(!/admin/i.test(location.pathname||'')||window.__eaDraftInstalled)return;
  window.__eaDraftInstalled=true;
  const DRAFT_KEY='ea_v27_admin_local_draft_v1';
  let currentScene=null,currentPackage=null,timer=null;
  const byId=id=>document.getElementById(id);
  const cloneDraft=x=>JSON.parse(JSON.stringify(x));
  const emptyDraft=()=>({schema:'ea-admin-draft-1',savedAt:'',baseVersion:'',scenes:{},packages:{}});
  function getDraft(){try{return {...emptyDraft(),...(JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')||{})}}catch{return emptyDraft()}}
  function putDraft(d,msg){d.savedAt=new Date().toISOString();try{d.baseVersion=typeof cloudRow!=='undefined'?(cloudRow?.version||d.baseVersion||''):d.baseVersion||''}catch{}localStorage.setItem(DRAFT_KEY,JSON.stringify(d));updateDraftUI(msg)}
  function fmtTime(s){if(!s)return'—';try{return new Date(s).toLocaleString()}catch{return s}}
  function updateDraftUI(msg){
    const d=getDraft(),has=Object.keys(d.scenes||{}).length||Object.keys(d.packages||{}).length;
    const badge=byId('localDraftBadge'),info=byId('localDraftInfo');
    if(badge){badge.textContent=has?'本地草稿已保存':'暂无本地草稿';badge.className='cloudstat'+(has?' dirty':'')}
    if(info)info.textContent=msg||(has?`本地草稿：${fmtTime(d.savedAt)}${d.baseVersion?' ｜ 基于 '+d.baseVersion:''}`:'框内修改可自动保存在本浏览器；正式用户不会看到，直到点击“发布到云端”。');
  }
  function sceneName(){return currentScene||byId('sceneSelect')?.value||''}
  function packageIndex(){const v=currentPackage??byId('packageSelect')?.value;return v==null?'':String(v)}
  function captureScene(name=sceneName(),persist=true){
    if(!name||!byId('demandEditor'))return;
    const reqs={};document.querySelectorAll('[data-reqtype]').forEach(el=>reqs[el.dataset.reqtype]=String(el.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
    const demands=String(byId('demandEditor')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const a=line.split('||').map(x=>x.trim());return[a[0]||'未命名诉求',a[1]||'',a[2]||'normal']});
    const plans={Standard:String(byId('planStandard')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),Pro:String(byId('planPro')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),Plus:String(byId('planPlus')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)};
    const d=getDraft();d.scenes=d.scenes||{};d.scenes[name]={demands,reqs,plans};if(persist)putDraft(d,'当前场景内容已保存到本地草稿。');else return d;
  }
  function capturePackage(idx=packageIndex(),persist=true){
    if(idx===''||!byId('pkgApply'))return;
    const d=getDraft();d.packages=d.packages||{};d.packages[idx]={apply:String(byId('pkgApply')?.value||'').trim(),desc:String(byId('pkgDesc')?.value||'').trim(),types:String(byId('pkgTypes')?.value||'').split(',').map(x=>x.trim()).filter(Boolean)};if(persist)putDraft(d,'当前升级包已保存到本地草稿。');else return d;
  }
  function captureVisible(msg='已保存本地草稿。'){
    captureScene(sceneName(),true);capturePackage(packageIndex(),true);const d=getDraft();putDraft(d,msg);
  }
  function applyDraftToWorking(render=true){
    const d=getDraft();
    try{
      for(const [name,s] of Object.entries(d.scenes||{})){
        if(typeof workingScenarios==='undefined'||!workingScenarios[name])continue;
        workingScenarios[name]={...workingScenarios[name],demands:cloneDraft(s.demands||[]),reqs:cloneDraft(s.reqs||{}),plans:{...workingScenarios[name].plans,...cloneDraft(s.plans||{})}};
      }
      for(const [idx,p] of Object.entries(d.packages||{})){
        const i=Number(idx);if(typeof workingPackages==='undefined'||!workingPackages[i])continue;
        const old=workingPackages[i];workingPackages[i]=[old[0],p.apply||'',p.desc||'',cloneDraft(p.types||[])];
      }
      if(typeof markDirty==='function')markDirty('已载入本地草稿；尚未发布到云端。');
      if(render&&typeof initEditors==='function')initEditors();
      updateDraftUI('本地草稿已载入编辑区；检查无误后可发布到云端。');
      return true;
    }catch(e){alert('读取本地草稿失败：'+e.message);return false}
  }
  function clearDraft(ask=true){if(ask&&!confirm('确定清除本浏览器中的本地草稿？云端正式版本不会受到影响。'))return;localStorage.removeItem(DRAFT_KEY);updateDraftUI('本地草稿已清除；云端正式版本未改变。')}
  function injectUI(){
    if(byId('localDraftToolbar'))return;
    const cloudbar=document.querySelector('.cloudbar');if(!cloudbar)return;
    const card=cloudbar.closest('.card');if(!card)return;
    const box=document.createElement('div');box.id='localDraftToolbar';box.style.cssText='margin-top:10px;padding:10px;border:1px dashed #cbd5e1;border-radius:10px;background:#fbfcfe';
    box.innerHTML='<div class="cloudbar"><span class="cloudstat" id="localDraftBadge">暂无本地草稿</span><button class="btn secondary" id="saveLocalDraftBtn" type="button">保存本地草稿</button><button class="btn secondary" id="loadLocalDraftBtn" type="button">读取本地草稿</button><button class="btn secondary" id="clearLocalDraftBtn" type="button">清除本地草稿</button></div><div class="note" id="localDraftInfo" style="margin-top:7px">框内修改可自动保存在本浏览器；正式用户不会看到，直到点击“发布到云端”。</div>';
    card.appendChild(box);
    byId('saveLocalDraftBtn').onclick=()=>captureVisible('04/05/06/07 当前编辑内容已保存到本地草稿。');
    byId('loadLocalDraftBtn').onclick=()=>{if(!Object.keys(getDraft().scenes||{}).length&&!Object.keys(getDraft().packages||{}).length){alert('当前浏览器没有本地草稿。');return}applyDraftToWorking(true)};
    byId('clearLocalDraftBtn').onclick=()=>clearDraft(true);
    const sb=byId('saveScene');if(sb)sb.textContent='保存当前场景为草稿';
    const pb=byId('savePackage');if(pb)pb.textContent='保存当前升级包为草稿';
    const pub=byId('publishBtn');if(pub)pub.textContent='发布到云端（正式生效）';
    updateDraftUI();
  }
  function scheduleDraft(){clearTimeout(timer);timer=setTimeout(()=>{try{captureScene(sceneName(),false);capturePackage(packageIndex(),false);const d=getDraft();if(sceneName()){
      const reqs={};document.querySelectorAll('[data-reqtype]').forEach(el=>reqs[el.dataset.reqtype]=String(el.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
      d.scenes=d.scenes||{};d.scenes[sceneName()]={demands:String(byId('demandEditor')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const a=line.split('||').map(x=>x.trim());return[a[0]||'未命名诉求',a[1]||'',a[2]||'normal']}),reqs,plans:{Standard:String(byId('planStandard')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),Pro:String(byId('planPro')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),Plus:String(byId('planPlus')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}};
    }
    const idx=packageIndex();if(idx!==''){d.packages=d.packages||{};d.packages[idx]={apply:String(byId('pkgApply')?.value||'').trim(),desc:String(byId('pkgDesc')?.value||'').trim(),types:String(byId('pkgTypes')?.value||'').split(',').map(x=>x.trim()).filter(Boolean)}};
    putDraft(d,'已自动保存本地草稿。');if(typeof markDirty==='function')markDirty('框内内容已修改并自动保存本地草稿；尚未发布到云端。');}catch{}},700)}
  document.addEventListener('focusin',e=>{if(e.target?.id==='sceneSelect')currentScene=e.target.value;if(e.target?.id==='packageSelect')currentPackage=String(e.target.value)});
  document.addEventListener('change',e=>{
    if(e.target?.id==='sceneSelect'){
      const old=currentScene;if(old)captureScene(old,true);currentScene=e.target.value;setTimeout(()=>{const s=getDraft().scenes?.[currentScene];if(s){byId('demandEditor').value=(s.demands||[]).map(x=>x.join(' || ')).join('\n');for(const el of document.querySelectorAll('[data-reqtype]'))el.value=(s.reqs?.[el.dataset.reqtype]||[]).join('\n');byId('planStandard').value=(s.plans?.Standard||[]).join('\n');byId('planPro').value=(s.plans?.Pro||[]).join('\n');byId('planPlus').value=(s.plans?.Plus||[]).join('\n')}},0);
    }
    if(e.target?.id==='packageSelect'){
      const old=currentPackage;if(old!=null)capturePackage(old,true);currentPackage=String(e.target.value);setTimeout(()=>{const p=getDraft().packages?.[currentPackage];if(p){byId('pkgApply').value=p.apply||'';byId('pkgDesc').value=p.desc||'';byId('pkgTypes').value=(p.types||[]).join(',')}},0);
    }
  },true);
  document.addEventListener('input',e=>{const id=e.target?.id||'';if(['demandEditor','planStandard','planPro','planPlus','pkgApply','pkgDesc','pkgTypes'].includes(id)||e.target?.hasAttribute?.('data-reqtype'))scheduleDraft()},true);
  document.addEventListener('click',e=>{
    if(e.target?.id==='saveScene')setTimeout(()=>captureScene(sceneName(),true),0);
    if(e.target?.id==='savePackage')setTimeout(()=>capturePackage(packageIndex(),true),0);
  },true);
  const mo=new MutationObserver(()=>{injectUI();localizeAdminRiskRuleUI();if(byId('sceneSelect')&&!currentScene)currentScene=byId('sceneSelect').value;if(byId('packageSelect')&&currentPackage==null)currentPackage=String(byId('packageSelect').value||'0')});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>{
    injectUI();
    const pub=byId('publishBtn');if(pub)pub.addEventListener('click',()=>{captureVisible('发布前已自动保存本地草稿。');applyDraftToWorking(false)},true);
    const exp=byId('exportBtn');if(exp)exp.addEventListener('click',()=>{captureVisible('导出前已自动保存本地草稿。');applyDraftToWorking(false)},true);
    const msg=byId('saveMsg');if(msg){const obs=new MutationObserver(()=>{if(/发布成功/.test(msg.textContent||''))clearDraft(false)});obs.observe(msg,{childList:true,subtree:true,characterData:true})}
    updateDraftUI();
  },{once:true});
}

(function bootstrapV27Cloud(){
  const path=location.pathname||'';
  if(/admin/i.test(path)){
    installAdminDraftWorkflow();
    window.addEventListener('load',()=>{
      localizeAdminRiskRuleUI();
      const body=document.getElementById('riskRuleBody');
      if(body){
        const ob=new MutationObserver(()=>localizeAdminRiskRuleUI());
        ob.observe(body,{childList:true,subtree:true});
      }
    },{once:true});
  }
  if(/\/v2\.5-admin\.html$/.test(path)){
    location.replace('v2.5-admin-cloud.html'+(location.search||'?v=20260905-draft1'));
    return;
  }
  if(/\/v2\.5\.html$/.test(path)){
    window.addEventListener('load',()=>{
      if(document.querySelector('script[data-v27-cloud]'))return;
      const s=document.createElement('script');
      s.src='v2.5-cloud.js?v=20260905-cloud1';
      s.dataset.v27Cloud='1';
      document.body.appendChild(s);
    },{once:true});
  }
})();
