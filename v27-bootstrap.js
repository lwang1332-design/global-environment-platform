(()=>{
  const nativeFetch = window.fetch.bind(window);
  const BACKEND = location.hostname.endsWith('github.io')
    ? 'https://global-environment-platform.vercel.app'
    : '';

  window.__ENV_BACKEND__ = BACKEND || location.origin;
  window.__ENV_VERSION__ = '2.7';

  window.fetch = async function(input, init){
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw && raw.startsWith('https://archive-api.open-meteo.com/v1/archive')) {
      const u = new URL(raw);
      const q = new URLSearchParams({
        type:'era5',
        latitude:u.searchParams.get('latitude') || '',
        longitude:u.searchParams.get('longitude') || '',
        start_date:u.searchParams.get('start_date') || '',
        end_date:u.searchParams.get('end_date') || ''
      });
      const r = await nativeFetch(`${BACKEND}/api/environment?${q.toString()}`, {
        headers:{accept:'application/json'}
      });
      const payload = await r.json().catch(()=>({}));
      if (!r.ok || payload.error) {
        return new Response(JSON.stringify({error:true,reason:payload.message||'ERA5后台查询失败'}), {
          status:r.status || 502,
          headers:{'content-type':'application/json'}
        });
      }
      return new Response(JSON.stringify(payload.data), {
        status:200,
        headers:{'content-type':'application/json','x-env-source':payload.source||'ERA5 backend'}
      });
    }
    return nativeFetch(input, init);
  };
})();