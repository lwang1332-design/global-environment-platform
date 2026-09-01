import { chromium } from 'playwright';
import fs from 'node:fs';

const port=fs.readFileSync('.local_server.port','utf8').trim();
const base=`http://127.0.0.1:${port}/?localUiSmoke=${Date.now()}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#localWorkstationPill',{timeout:15000});
  const mode=await page.evaluate(()=>({runtime:window.GE_RUNTIME_MODE,hasApi:!!window.LocalWorkstation,hasNativeFetch:typeof window.__GE_NATIVE_FETCH__==='function'}));
  if(mode.runtime!=='local-workstation'||!mode.hasApi||!mode.hasNativeFetch)throw new Error('localhost runtime adapter not initialized: '+JSON.stringify(mode));
  await page.click('#localWorkstationPill');
  await page.waitForSelector('#localWorkstationMask.show',{timeout:10000});
  const tabs=await page.locator('.localWsTabs').innerText();
  for(const x of ['运行状态','项目管理','数据源','系统诊断'])if(!tabs.includes(x))throw new Error('missing workstation tab: '+x);
  await page.getByRole('button',{name:'系统诊断'}).click();
  await page.waitForTimeout(500);
  const diag=await page.locator('[data-pane="diagnostics"]').innerText();
  if(!diag.includes('SQLite')||!diag.includes('数据库'))throw new Error('diagnostics UI incomplete');
  const dataBadge=await page.locator('#localDataModeBadge').innerText();
  if(!dataBadge.includes('数据：'))throw new Error('live/cache badge missing');
  console.log('LOCAL_UI_SMOKE_OK');
}finally{
  await browser.close();
}
if(errors.length){
  console.log('Browser console/page errors observed:');
  for(const e of errors.slice(0,20))console.log(' - '+e);
}
