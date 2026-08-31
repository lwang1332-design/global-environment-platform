'use strict';
const db=require('../../server/lib/db');
const {setCors,json}=require('../../server/lib/security');
module.exports=async function(req,res){
  setCors(req,res);if(req.method==='OPTIONS')return json(res,204,{});if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{const row=await db.latest();if(!row)return json(res,404,{error:'No published config'});return json(res,200,{config:{version:row.version,updatedAt:row.updated_at,updatedBy:row.updated_by,description:row.description||'',parameters:row.parameters,schemaVersion:row.schema_version,status:row.is_active?'published':'inactive'}})}catch(e){console.error(e);return json(res,503,{error:'Config service unavailable',detail:e.message})}
};
