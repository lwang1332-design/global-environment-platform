// Public runtime settings only. Do not place passwords, PATs, Service Role Keys or other secrets here.
window.V29_RUNTIME_CONFIG={
  configApiBase:'https://vzlnwrxscufkchxkdjus.supabase.co/functions/v1/v29-config'
};

// Windows localhost workstation adapter. GitHub Pages behavior is unchanged.
if(['localhost','127.0.0.1'].includes(location.hostname)){
  // Route only the public Open-Meteo families already used by V2.9 through the local allowlisted cache/proxy.
  // This preserves the response schema expected by locate/elev/weather/air/marine without touching model formulas.
  const nativeFetch=window.fetch.bind(window);
  const sourceByHost={
    'archive-api.open-meteo.com':'archive',
    'air-quality-api.open-meteo.com':'air',
    'marine-api.open-meteo.com':'marine',
    'api.open-meteo.com':'elevation',
    'geocoding-api.open-meteo.com':'geocode'
  };
  window.__GE_NATIVE_FETCH__=nativeFetch;
  window.GE_LOCAL_SOURCE_STATE=window.GE_LOCAL_SOURCE_STATE||{};

  function renderLocalDataMode(){
    if(!document.body)return;
    const vals=Object.values(window.GE_LOCAL_SOURCE_STATE||{}),modes=new Set(vals.map(x=>x.mode));
    let text='数据：待查询',tone='#667085',bg='#f2f4f7';
    if(modes.has('live')&&modes.has('cached')){text='数据：实时 + 缓存';tone='#9a6700';bg='#fff4d5'}
    else if(modes.has('live')){text='数据：实时';tone='#087a50';bg='#e8f7ef'}
    else if(modes.has('cached')){text='数据：缓存';tone='#9a6700';bg='#fff4d5'}
    else if(modes.has('miss')){text='数据：源不可用';tone='#b4232b';bg='#feecee'}
    let el=document.getElementById('localDataModeBadge');
    if(!el){el=document.createElement('div');el.id='localDataModeBadge';el.style.cssText='position:fixed;right:14px;bottom:52px;z-index:3499;padding:5px 9px;border-radius:999px;font:800 9px Microsoft YaHei,Arial;box-shadow:0 3px 12px rgba(10,42,89,.08);border:1px solid rgba(0,0,0,.06)';document.body.appendChild(el)}
    el.textContent=text;el.style.color=tone;el.style.background=bg;
    el.title=vals.map(x=>`${x.kind}: ${x.mode}${x.updatedAt?' · '+x.updatedAt:''}`).join('\n')||'尚未发起环境数据查询';
  }
  window.addEventListener('ge-local-source-state',renderLocalDataMode);
  window.addEventListener('DOMContentLoaded',renderLocalDataMode,{once:true});

  window.fetch=function(input,init){
    try{
      const raw=input instanceof Request?input.url:String(input);
      const u=new URL(raw,location.href),kind=sourceByHost[u.hostname];
      if(kind){
        const local=new URL('/local-api/openmeteo',location.origin);
        local.searchParams.set('_kind',kind);
        if(!navigator.onLine)local.searchParams.set('_offline','1');
        u.searchParams.forEach((v,k)=>local.searchParams.append(k,v));
        return nativeFetch(local.toString(),init).then(r=>{
          const mode=r.headers.get('X-GE-Cache-Mode')||'unknown';
          const updatedAt=r.headers.get('X-GE-Cache-Updated-At')||'';
          const detail={kind,mode,updatedAt,ok:r.ok,status:r.status,at:new Date().toISOString()};
          window.GE_LOCAL_SOURCE_STATE[kind]=detail;
          window.dispatchEvent(new CustomEvent('ge-local-source-state',{detail}));
          return r;
        });
      }
    }catch{}
    return nativeFetch(input,init);
  };

  const s=document.createElement('script');
  s.src='./assets/local-workstation.js?v=20260901-local-v3-ui4';
  s.async=true;
  document.head.appendChild(s);
}
