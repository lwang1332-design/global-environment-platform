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
