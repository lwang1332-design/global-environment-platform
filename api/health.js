'use strict';
const {setCors,json}=require('../server/lib/security');
module.exports=async function(req,res){setCors(req,res);if(req.method==='OPTIONS')return json(res,204,{});return json(res,200,{ok:true,service:'global-environment-config',schemaVersion:'2.9',time:new Date().toISOString()})};
