'use strict';
const db=require('../../server/lib/db');
const {setCors,json}=require('../../server/lib/security');
module.exports=async function(req,res){
  setCors(req,res);if(req.method==='OPTIONS')return json(res,204,{});if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{const rows=await db.history(req.query?.limit||30);return json(res,200,{items:(rows||[]).map(row=>({version:row.version,updatedAt:row.updated_at,updatedBy:row.updated_by,description:row.description||'',parameters:row.parameters,schemaVersion:row.schema_version,status:row.is_active?'published':'historical'}))})}catch(e){console.error(e);return json(res,503,{error:'Config history unavailable',detail:e.message})}
};
