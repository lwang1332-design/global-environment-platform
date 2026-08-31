'use strict';
const crypto=require('crypto');

function b64url(input){return Buffer.from(input).toString('base64url')}
function sign(data,secret){return crypto.createHmac('sha256',secret).update(data).digest('base64url')}
function safeEqual(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}

function verifyPassword(password,stored){
  if(!stored||!password)return false;
  const parts=String(stored).split(':');
  if(parts.length!==3||parts[0]!=='scrypt')return false;
  const [,salt,expected]=parts;
  const actual=crypto.scryptSync(String(password),salt,32).toString('hex');
  return safeEqual(actual,expected);
}
function issueToken(subject='admin'){
  const secret=process.env.ADMIN_SESSION_SECRET;
  if(!secret)throw new Error('ADMIN_SESSION_SECRET is not configured');
  const ttl=Math.max(300,Math.min(86400,Number(process.env.ADMIN_TOKEN_TTL_SECONDS||3600)));
  const payload={sub:String(subject).slice(0,80),iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+ttl,scope:'config:publish'};
  const body=b64url(JSON.stringify(payload));
  return `${body}.${sign(body,secret)}`;
}
function verifyToken(token){
  try{
    const secret=process.env.ADMIN_SESSION_SECRET;if(!secret)return null;
    const [body,sig]=String(token||'').split('.');if(!body||!sig||!safeEqual(sign(body,secret),sig))return null;
    const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(!p.exp||p.exp<Math.floor(Date.now()/1000)||p.scope!=='config:publish')return null;
    return p;
  }catch{return null}
}
function bearer(req){const h=req.headers.authorization||req.headers.Authorization||'';return /^Bearer\s+(.+)$/i.exec(h)?.[1]||''}
function setCors(req,res){
  const allowed=String(process.env.ALLOWED_ORIGIN||'https://lwang1332-design.github.io').split(',').map(x=>x.trim()).filter(Boolean);
  const origin=req.headers.origin;
  if(origin&&allowed.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Cache-Control','no-store');
}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
module.exports={verifyPassword,issueToken,verifyToken,bearer,setCors,json};
