import fs from 'node:fs';
import { chromium } from 'playwright';

const allPoints=[
  {id:'VN-10.9-106.6-2m',name:'越南 10.9/106.6',lat:10.9,lon:106.6,height:2,observed:46.4},
  {id:'HN-18.300797-109.26452-5m',name:'海南 18.300797/109.264520',lat:18.300797,lon:109.26452,height:5,observed:86.8},
  {id:'FJ-25.42234-119.489225-5m',name:'福建 25.422340/119.489225 5m',lat:25.42234,lon:119.489225,height:5,observed:100.2},
  {id:'FJ-25.42234-119.489225-100m',name:'福建 25.422340/119.489225 100m',lat:25.42234,lon:119.489225,height:100,observed:49.7}
];
const pointId=process.env.POINT_ID||'';
const points=pointId?allPoints.filter(p=>p.id===pointId):allPoints;
if(!points.length)throw new Error('Unknown POINT_ID: '+pointId);

const browser=await chromium.launch({headless:true,args:['--disable-web-security','--disable-features=IsolateOrigins,site-per-process']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const consoleErrors=[];
page.on('pageerror',e=>consoleErrors.push('pageerror:'+e.message));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon/i.test(m.text()))consoleErrors.push('console:'+m.text())});
await page.goto('http://127.0.0.1:4173/marine-corrosion/?v=3.3.3-fourpoint',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('#runBtn',{timeout:30000});
await page.waitForFunction(()=>document.title.includes('V3.3.3'),null,{timeout:30000});

async function setValue(sel,value){await page.locator(sel).fill(String(value));await page.locator(sel).dispatchEvent('change');}
async function runPoint(p){
  console.log(`\n===== START ${p.id} =====`);
  await page.selectOption('#mode','historical');
  await page.selectOption('#period','1');
  await page.selectOption('#year','2025');
  await page.selectOption('#exposureZone','atmospheric');
  await page.selectOption('#material','carbon_steel');
  if(await page.locator('#v331So2Mode').count())await page.selectOption('#v331So2Mode','auto');
  await setValue('#latitude',p.lat);
  await setValue('#longitude',p.lon);
  await setValue('#height',p.height);
  await page.evaluate(()=>{globalThis.__MARINE_V333_LAST_RESULT__=null});
  await page.click('#runBtn');
  await page.waitForFunction(({lat,lon,height})=>{
    const r=globalThis.__MARINE_V333_LAST_RESULT__;
    const q=r?.project;
    return !!q&&Math.abs(Number(q.latitude)-lat)<1e-6&&Math.abs(Number(q.longitude)-lon)<1e-6&&Math.abs(Number(q.height)-height)<1e-6;
  },{lat:p.lat,lon:p.lon,height:p.height},{timeout:540000});
  const data=await page.evaluate(async observed=>{
    const result=globalThis.__MARINE_V333_LAST_RESULT__;
    const mod=await import('./diagnostics-v333.js?e2e='+Date.now());
    const diagnostic=mod.buildDiagnosticChain(result);
    const waterfall=mod.buildBiasWaterfall(diagnostic,observed);
    const sensitivity=mod.rerunSensitivity(result);
    return {
      project:result.project,
      summary:{
        basis:diagnostic.basis,
        predicted:diagnostic.corrosion.predicted,
        corrosionClass:diagnostic.corrosion.class,
        observed,
        bias:waterfall.bias,
        ratio:waterfall.ratio,
        underprediction:waterfall.underprediction,
        airSalt:diagnostic.seaSalt.airSalt,
        saltDep:diagnostic.seaSalt.saltDep,
        drySalt:diagnostic.seaSalt.drySalt,
        impactSalt:diagnostic.seaSalt.impactSalt,
        wetSalt:diagnostic.seaSalt.wetSalt,
        engineeringCl:diagnostic.seaSalt.engineeringCl,
        isoSd:diagnostic.seaSalt.isoSd,
        pd:diagnostic.pollutant.pd,
        pc:diagnostic.pollutant.pc,
        rh:diagnostic.atmosphere.rh,
        temperature:diagnostic.atmosphere.temperature,
        towHours:diagnostic.wetness.towHours,
        wetHours:diagnostic.wetness.wetHours,
        condHours:diagnostic.wetness.condHours,
        saltWetHours:diagnostic.wetness.saltWetHours,
        rainHours:diagnostic.wetness.rainHours,
        wetDepMissingHours:diagnostic.wetness.wetDepMissingHours,
        so2Term:diagnostic.corrosion.so2Term,
        chlorideTerm:diagnostic.corrosion.chlorideTerm,
        camsHours:diagnostic.source.camsHours,
        proxySaltHours:diagnostic.source.proxySaltHours,
        inputGrade:diagnostic.source.inputGrade,
        warnings:diagnostic.warnings,
        sensitivityTop:sensitivity.ranked.slice(0,8),
        sensitivityRows:sensitivity.rows
      }
    };
  },p.observed);
  console.log(JSON.stringify({id:p.id,name:p.name,...data.summary},null,2));
  return {id:p.id,name:p.name,reference:p.observed,...data};
}

const results=[];
for(const p of points){
  try{results.push(await runPoint(p));}
  catch(error){
    const body=await page.locator('body').innerText().catch(()=>null);
    results.push({id:p.id,name:p.name,reference:p.observed,error:String(error?.stack||error),bodyTail:body?.slice(-4000)||null});
    console.error(`FAILED ${p.id}`,error);
  }
}
const payload={version:'3.3.3',scienceModel:'3.3.0',dataLayer:'3.3.2',year:2025,generatedAt:new Date().toISOString(),pointFilter:pointId||null,points:results,consoleErrors};
const suffix=pointId?'-'+pointId:'';
fs.writeFileSync(`/tmp/v333-fourpoint-results${suffix}.json`,JSON.stringify(payload,null,2));
console.log('\n===== POINT SUMMARY =====');
console.log(JSON.stringify(payload,null,2));
await browser.close();
if(results.some(x=>x.error))process.exitCode=2;
