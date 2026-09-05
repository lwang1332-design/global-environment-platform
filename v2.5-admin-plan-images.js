// Admin plugin: upload / preview / replace / clear Standard-Pro-Plus plan images.
(function installAdminPlanImages(){
  const LEVELS=['Standard','Pro','Plus'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  let mediaRoot=null;

  function ensureFields(scene){
    if(!scene)return;
    scene.planImages=scene.planImages&&typeof scene.planImages==='object'?scene.planImages:{};
    scene.planImageCaptions=scene.planImageCaptions&&typeof scene.planImageCaptions==='object'?scene.planImageCaptions:{};
  }

  function installStyle(){
    if(document.getElementById('adminPlanImageStyle'))return;
    const st=document.createElement('style');st.id='adminPlanImageStyle';st.textContent=`
      .admin-plan-media-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
      .admin-plan-media-card{border:1px solid var(--line);border-radius:10px;padding:10px;background:#fafbfc}
      .admin-plan-media-card h4{margin:0 0 7px;color:var(--nav);font-size:12px}
      .admin-plan-preview{aspect-ratio:4/3;border:1px dashed #cfd8e6;border-radius:8px;background:#f3f6fa;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px}
      .admin-plan-preview img{width:100%;height:100%;object-fit:contain;background:#fff}
      .admin-plan-empty{font-size:10px;color:var(--muted);text-align:center;padding:10px}.admin-plan-empty b{display:block;color:#607086;margin-bottom:3px}
      .admin-plan-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.admin-plan-actions .btn{padding:6px 8px}
      .admin-upload-state{font-size:9px;color:var(--muted);margin-top:6px;min-height:14px}
      @media(max-width:760px){.admin-plan-media-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  function installUi(){
    if(document.getElementById('adminPlanMediaRoot')){mediaRoot=document.getElementById('adminPlanMediaRoot');return}
    const ref=document.getElementById('planStandard')?.closest('.card');if(!ref)return;
    mediaRoot=document.createElement('div');mediaRoot.id='adminPlanMediaRoot';mediaRoot.className='admin-plan-media-grid';
    const toolbar=ref.querySelector('.toolbar');ref.insertBefore(mediaRoot,toolbar||null);
  }

  function preview(level,url,caption){
    if(!url)return `<div class="admin-plan-preview"><div class="admin-plan-empty"><b>暂无方案图</b>上传后仅进入当前编辑草稿</div></div>`;
    return `<div class="admin-plan-preview"><img src="${esc(url)}" alt="${esc(caption||level+' 方案图')}" onerror="this.parentElement.innerHTML='<div class=\'admin-plan-empty\'><b>图片加载失败</b>请重新上传</div>'"></div>`;
  }

  function render(){
    installUi();if(!mediaRoot)return;
    const name=document.getElementById('sceneSelect')?.value;const d=workingScenarios?.[name];if(!d)return;ensureFields(d);
    mediaRoot.innerHTML=LEVELS.map(level=>{const url=d.planImages?.[level]||'',cap=d.planImageCaptions?.[level]||'';return `<div class="admin-plan-media-card" data-level="${level}"><h4>${level} 方案图</h4>${preview(level,url,cap)}
      <label>图片标题 / 图注<input data-caption="${level}" value="${esc(cap)}" placeholder="例如：海洋气候 ${level} 方案系统架构示意图"></label>
      <input data-file="${level}" type="file" accept="image/jpeg,image/png,image/webp" style="display:none">
      <div class="admin-plan-actions"><button type="button" class="btn secondary" data-upload="${level}">${url?'更换图片':'上传图片'}</button><button type="button" class="btn secondary" data-clear="${level}" ${url?'':'disabled'}>移除图片</button></div>
      <div class="admin-upload-state" data-state="${level}">${url?'已配置方案图':'未配置方案图'}</div></div>`}).join('');
    LEVELS.forEach(level=>{
      const file=mediaRoot.querySelector(`[data-file="${level}"]`),upload=mediaRoot.querySelector(`[data-upload="${level}"]`),clear=mediaRoot.querySelector(`[data-clear="${level}"]`),cap=mediaRoot.querySelector(`[data-caption="${level}"]`);
      upload.onclick=()=>file.click();file.onchange=e=>uploadImage(level,e.target.files?.[0]);
      clear.onclick=()=>clearImage(level);
      cap.oninput=()=>{const scene=workingScenarios[document.getElementById('sceneSelect').value];ensureFields(scene);scene.planImageCaptions[level]=cap.value.trim();markDirty(`${level} 方案图注已修改，尚未发布。`)};
    });
  }

  async function uploadImage(level,file){
    if(!file)return;if(file.size>5*1024*1024){alert('图片不能超过 5 MB');return}if(!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('仅支持 JPG / PNG / WebP');return}
    const name=document.getElementById('sceneSelect').value,state=mediaRoot.querySelector(`[data-state="${level}"]`);state.textContent='正在上传…';
    try{const fd=new FormData();fd.append('file',file);fd.append('scene',name);fd.append('level',level);const r=await fetch(CLOUD_API+'/media/upload',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Error(j.error||j.detail||('HTTP '+r.status));const d=workingScenarios[name];ensureFields(d);d.planImages[level]=j.url;markDirty(`${name} · ${level} 方案图已上传到云端存储并写入当前编辑草稿，尚未正式发布。`);render()}catch(e){state.textContent='上传失败：'+e.message}}
  function clearImage(level){const name=document.getElementById('sceneSelect').value,d=workingScenarios[name];ensureFields(d);d.planImages[level]='';markDirty(`${name} · ${level} 方案图已从当前编辑草稿移除，尚未发布。`);render()}

  installStyle();installUi();
  const baseLoad=loadScene;loadScene=function(){baseLoad();render()};
  document.getElementById('sceneSelect')?.addEventListener('change',()=>setTimeout(render,0));
  render();
})();
