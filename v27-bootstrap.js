(()=>{
  const nativeFetch = window.fetch.bind(window);
  window.__ENV_VERSION__ = '2.7';
  window.__ENV_DATA_MODE__ = 'ERA5 direct';

  window.fetch = async function(input, init){
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw && raw.startsWith('https://archive-api.open-meteo.com/v1/archive')) {
      const u = new URL(raw);
      u.searchParams.set('models','era5');
      if (!u.searchParams.has('timezone')) u.searchParams.set('timezone','UTC');
      try {
        const r = await nativeFetch(u.toString(), init);
        if (!r.ok) {
          const payload = await r.clone().json().catch(()=>({}));
          return new Response(JSON.stringify({
            error:true,
            reason:payload.reason || `ERA5 HTTP ${r.status}`
          }), {
            status:r.status,
            headers:{'content-type':'application/json','x-env-source':'Open-Meteo ERA5'}
          });
        }
        const body = await r.arrayBuffer();
        return new Response(body, {
          status:200,
          headers:{'content-type':r.headers.get('content-type') || 'application/json','x-env-source':'Open-Meteo ERA5'}
        });
      } catch (e) {
        return new Response(JSON.stringify({error:true,reason:`ERA5网络连接失败: ${e.message}`}), {
          status:502,
          headers:{'content-type':'application/json','x-env-source':'Open-Meteo ERA5'}
        });
      }
    }
    return nativeFetch(input, init);
  };
})();