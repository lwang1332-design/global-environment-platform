'use strict';

function env(){
  const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Supabase environment variables are not configured');
  return{url,key};
}
async function request(path,options={}){
  const {url,key}=env();
  const r=await fetch(`${url}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json',...(options.headers||{})}
  });
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){const e=new Error(data?.message||data?.hint||`Supabase HTTP ${r.status}`);e.status=r.status;e.data=data;throw e}
  return data;
}
async function latest(){
  const rows=await request('config_versions?is_active=eq.true&select=version,updated_at,updated_by,description,parameters,schema_version,is_active&order=updated_at.desc&limit=1');
  return rows?.[0]||null;
}
async function history(limit=30){
  const n=Math.max(1,Math.min(100,Number(limit)||30));
  return await request(`config_versions?select=version,updated_at,updated_by,description,parameters,schema_version,is_active&order=updated_at.desc&limit=${n}`);
}
async function publish({parameters,description,updatedBy,schemaVersion}){
  const rows=await request('rpc/publish_config',{method:'POST',body:JSON.stringify({p_parameters:parameters,p_description:description||'',p_updated_by:updatedBy||'admin',p_schema_version:schemaVersion||'2.9'})});
  return Array.isArray(rows)?rows[0]:rows;
}
module.exports={latest,history,publish};
