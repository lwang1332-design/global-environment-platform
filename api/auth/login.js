'use strict';
const {verifyPassword,issueToken,setCors,json}=require('../../server/lib/security');
module.exports=async function(req,res){
  setCors(req,res);if(req.method==='OPTIONS')return json(res,204,{});if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const password=String(body.password||'');
    if(!verifyPassword(password,process.env.ADMIN_PASSWORD_HASH))return json(res,401,{error:'管理员密码错误'});
    const token=issueToken(body.username||'admin');
    return json(res,200,{token,expiresIn:Number(process.env.ADMIN_TOKEN_TTL_SECONDS||3600)});
  }catch(e){console.error(e);return json(res,500,{error:'Authentication service unavailable',detail:e.message})}
};
