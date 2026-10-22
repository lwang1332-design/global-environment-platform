const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
function fixture(){
 const grid={innerHTML:'',className:''};
 const doc={readyState:'loading',getElementById:id=>id==='envGrid'?grid:{value:id==='periodYears'?'1':'0'},createElement:()=>({textContent:''}),head:{appendChild(){}},addEventListener(){}};
 const ctx={document:doc,localStorage:{getItem(){return null}},console,fetch:async()=>({ok:false}),derive(){},renderEnv(){},riskLevel(){return 1},riskRules:{},env:{},loadWeather:async()=>({})};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('v2.7-metric-catalog.js'),ctx);vm.runInContext(read('v2.7-health-v3.js'),ctx);return ctx;
}
const expect=(name,test)=>{test();console.log('PASS',name)};
expect('50 unique canonical metrics, 10 groups x 5 and formula/source coverage',()=>{
 const ctx=fixture(),f=ctx.EA_METRIC_CATALOG;
 assert.equal(f.length,50);assert.equal(new Set(f.map(x=>x.id)).size,50);assert.equal(new Set(f.map(x=>x.group)).size,10);
 for(const group of new Set(f.map(x=>x.group)))assert.equal(f.filter(x=>x.group===group).length,5);
 assert.ok(f.every(x=>x.unit&&x.formula&&x.version&&x.defaultSource));
});
function sample(){
 const h={},n=48;h.temperature_2m=Array.from({length:n},(_,i)=>i<24?20:30);
 h.rain=Array.from({length:n},(_,i)=>i===5?24:i===30?3:0);
 h.precipitation=h.rain.map(x=>x+5);h.relative_humidity_2m=Array(n).fill(70);
 h.wind_speed_10m=Array(n).fill(6);h.surface_pressure=Array(n).fill(1000);
 h.shortwave_radiation=Array.from({length:n},(_,i)=>i);
 h.snowfall=Array(n).fill(0);h.snow_depth=Array(n).fill(0);
 h.dew_point_2m=Array(n).fill(10);h.weather_code=Array(n).fill(0);
 return h;
}
expect('independent 2-day sample: daily Tmax P99, rain/day not precipitation/day, P99 shortwave',()=>{
 const ctx=fixture();ctx.derive(sample(),{pm10:[20],pm2_5:[9],dust:[10],sulphur_dioxide:[1],nitrogen_dioxide:[1],sea_salt_aerosol:[2]},125);ctx.renderEnv();
 const f=ctx.envHealthV31.fields;
 assert.equal(f.length,50);assert.ok(Math.abs(f[0].value-29.9)<1e-8);
 assert.equal(f[16].value,24);
 assert.ok(Math.abs(f[46].value-46.53)<1e-8);
 assert.ok(f[38].value>1.1&&f[38].value<1.2);
 assert.equal(f[7].value,null,'condensation cannot be computed from humidity alone');
 assert.equal(f[20].value,null,'salt deposition must not be inferred from aerosol');
});
expect('missing specialty data is UNKNOWN, not zero or LOW',()=>{
 const ctx=fixture();ctx.derive(sample(),{},125);ctx.renderEnv();
 const a=ctx.envHealthV31.fields;
 assert.equal(a[41].riskStatus,'UNKNOWN');assert.equal(a[42].riskStatus,'UNKNOWN');
 assert.equal(a[20].riskStatus,'UNKNOWN');
});
expect('V3.2 decision/report and security hook files exist',()=>{
 for(const n of ['v2.7-decision-integrity-v32.js','v2.7-admin-auth-v32.js','v2.7-admin-metric-rules-v32.js','v2.7-health-v31-report.js'])assert.ok(read(n).length>100);
 assert.ok(read('v2.5-report.html').includes('附录C'));
 assert.ok(read('v2.7.html').includes('v2.7-decision-integrity-v32.js'));
});
console.log('ALL LOCAL STATIC + SYNTHETIC TESTS PASSED');
