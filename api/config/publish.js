'use strict';
const db=require('../../server/lib/db');
const {SCHEMA_VERSION,validateParameters,normalizeConfigBody}=require('../../server/lib/validate');
const {setCors,json,verifyToken,bearer}=require('../../server/lib/security');
module.exports=async function(req,res){
  setCors(req,res);if(req.method==='OPTIONS')return json(res,204,{});if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const session=verifyToken(bearer(req));if(!session)return json(res,401,{error:'Administrator authentication required'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const cfg=normalizeConfigBody(body);
    if(cfg.schemaVersion!==SCHEMA_VERSION)return json(res,409,{error:'Incompatible config schema',expected:SCHEMA_VERSION,received:cfg.schemaVersion});
    const check=validateParameters(cfg.parameters);if(!check.ok)return json(res,422,{error:'Parameter validation failed',errors:check.errors});
    cfg.updatedBy=session.sub||cfg.updatedBy||'admin';
    const row=await db.publish(cfg);if(!row)throw new Error('Database did not return the published version');
    return json(res,201,{config:{version:row.version,updatedAt:row.updated_at,updatedBy:row.updated_by,description:row.description||'',parameters:row.parameters,schemaVersion:row.schema_version,status:'published'}});
  }catch(e){console.error(e);return json(res,e instanceof SyntaxError?400:503,{error:e instanceof SyntaxError?'Invalid JSON':'Publish failed',detail:e.message})}
};
