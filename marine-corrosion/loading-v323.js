(() => {
  'use strict';
  const DIRECT='https://global-marine-corrosion-direct-v322-lwang1332-4885.vercel.app/api/direct';
  const $=s=>document.querySelector(s);
  let running=false, started=0, timer=null, activeFetches=0, doneHours=0, totalHours=null, finalizing=false;
  const yearHours=new Map();
  const labels={pending:'等待',active:'进行中',done:'完成',warn:'Fallback',error:'失败'};
  function stage(i,status,detail){const r=document.querySelector(`[data-load-stage="${i}"]`);if(!r)return;r.dataset.status=status;const e=r.querySelector('.load-stage-status');if(e)e.textContent=labels[status]||status;if(detail){const d=r.querySelector('.load-stage-detail');if(d)d.textContent=detail}}
  function leap(y){return (y%4===0&&y%100!==0)||y%400===0}
  function expected(){if($('#mode')?.value!=='historical')return null;const end=Number($('#year')?.value),n=Number($('#period')?.value||1);if(!end)return null;let h=0;for(let i=0;i<n;i++){const y=end-n+1+i;h+=leap(y)?8784:8760}return h}
  function meta(){const h=$('#loadingHours'),e=$('#loadingElapsed');if(h)h.textContent=totalHours?`${Math.min(doneHours,totalHours).toLocaleString()} / ${totalHours.toLocaleString()} h`:(doneHours?`${doneHours.toLocaleString()} h`:'Current窗口');if(e&&started)e.textContent=`${Math.round((Date.now()-started)/1000)} s`}
  function progress(v){const b=$('#progressBar');if(b){b.style.animation='none';b.style.width=`${Math.max(4,Math.min(100,v))}%`}}
  function reset(){doneHours=0;yearHours.clear();totalHours=expected();started=Date.now();for(let i=0;i<4;i++)stage(i,'pending');stage(0,'active','准备GIS与项目定位');stage(1,'active','准备ERA5 / CAMS / CMEMS数据请求');progress(6);meta();clearInterval(timer);timer=setInterval(meta,1000)}
  function inferHoursFromJson(d,key='current'){const n=d?.weather?.time?.length||d?.hourly?.time?.length||0;if(n){yearHours.set(String(key||'current'),n);doneHours=[...yearHours.values()].reduce((a,b)=>a+b,0);meta()}return n}
  function afterNetwork(){if(!running||activeFetches>0)return;stage(0,'done','GIS/定位请求已返回或已进入本地计算');stage(1,'done',doneHours?`环境数据已返回 ${Math.min(doneHours,totalHours||doneHours).toLocaleString()} h；来源类型以结果页RAW/Fallback/EST为准`:'环境数据请求已返回；正在解析');progress(78);stage(2,'active',doneHours?`统一 ${Math.min(doneHours,totalHours||doneHours).toLocaleString()} h 时间轴并检查缺测`:'统一时间轴并检查缺测');setTimeout(()=>{if(!running)return;stage(2,'done',doneHours?`${Math.min(doneHours,totalHours||doneHours).toLocaleString()} h 已进入统一时间轴`:'时间轴已统一');progress(90);stage(3,'active','执行海盐 → Cl⁻沉降 → 盐库存 → 湿润/凝露 → ISO 9223');},80)}
  const rawFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    const method=String(init?.method||'GET').toUpperCase();
    let requestKey='current';
    const isDirect=url.includes('/api/direct');
    const isHistoricalWeather=url.includes('archive-api.open-meteo.com');
    const isCurrentWeather=url.includes('api.open-meteo.com/v1/forecast');
    const countTimeline=isDirect||isHistoricalWeather||isCurrentWeather;
    try{
      if(isDirect&&method==='POST'&&init?.body){const b=JSON.parse(init.body);requestKey=b?.year||b?.mode||'current'}
      else if(isHistoricalWeather){const u=new URL(url);requestKey=(u.searchParams.get('start_date')||'current').slice(0,4)}
    }catch{}
    let options=init, healthTimer=null;
    if(!running&&url.startsWith(DIRECT)&&method==='GET'&&!init?.signal){const c=new AbortController();options={...init,signal:c.signal};healthTimer=setTimeout(()=>c.abort(),4000)}
    const track=running;
    if(track){activeFetches++;if(isDirect){stage(1,'active','Direct：ERA5 / CAMS / CMEMS 请求中');progress(25)}else if(url.includes('open-meteo.com')){stage(1,'warn','Direct未返回完整数据，正在使用明确标记的Open-Meteo Fallback');progress(42)}else if(/topodata|elevation|gebco|gis/i.test(url)){stage(0,'active','正在解析GIS/陆海与距海信息');progress(15)}}
    try{
      const r=await rawFetch(input,options);
      if(track&&countTimeline){try{const clone=r.clone();clone.json().then(d=>{const n=inferHoursFromJson(d,requestKey);if(isDirect){const rawReady=!!(d?.weather?.time?.length&&d?.cams?.time?.length&&d?.ocean?.time?.length);stage(1,rawReady?'done':'warn',rawReady?`Direct已返回 ${n.toLocaleString()} h ERA5 + CAMS + CMEMS`:'Direct响应不完整，将按页面规则使用Fallback/EST')};}).catch(()=>{})}catch{}}
      return r;
    }catch(e){if(track){if(isDirect)stage(1,'warn','Direct请求失败，平台将尝试Fallback/EST');else stage(1,'warn',`数据请求异常：${e.message}`)}throw e}
    finally{if(healthTimer)clearTimeout(healthTimer);if(track){activeFetches=Math.max(0,activeFetches-1);setTimeout(afterNetwork,0)}}
  };
  const runBtn=$('#runBtn');if(runBtn)runBtn.addEventListener('click',()=>{running=true;finalizing=false;reset();setTimeout(()=>{const l=$('#loading');if(l)l.classList.remove('hidden')},0)},true);
  const loading=$('#loading');if(loading){new MutationObserver(()=>{const hidden=loading.classList.contains('hidden');if(!hidden&&running){meta();return}if(hidden&&running&&!finalizing){finalizing=true;const shown=Math.min(doneHours,totalHours||doneHours);stage(2,'done',shown?`${shown.toLocaleString()} h 时间轴完成`:'时间轴完成');stage(3,'done','物理模型与工程判定完成');progress(100);clearInterval(timer);running=false;finalizing=false;}}).observe(loading,{attributes:true,attributeFilter:['class']})}
})();
