from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'async function air(' not in s:
    aux=r'''async function air(lat,lon){let e=new Date();e.setUTCDate(e.getUTCDate()-1);let s=new Date(e);s.setUTCDate(s.getUTCDate()-89);let v='pm10,pm2_5,dust,sea_salt_aerosol,sulphur_dioxide,nitrogen_dioxide';let u=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=${v}&start_date=${iso(s)}&end_date=${iso(e)}&timezone=auto&domains=cams_global`;try{let j=await fetch(u).then(r=>{if(!r.ok)throw Error();return r.json()});return{ok:true,j,start:iso(s),end:iso(e)}}catch{return{ok:false,j:null,start:iso(s),end:iso(e)}}}
async function marine(lat,lon){
 let u=`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,sea_surface_temperature,ocean_current_velocity&timezone=auto&cell_selection=sea`;
 try{let j=await fetch(u).then(r=>{if(!r.ok)throw Error();return r.json()});return{ok:true,j}}catch{return{ok:false,j:null}}
}
'''
    anchor='async function assess(loc)'
    if anchor not in s: raise SystemExit('assess anchor not found')
    s=s.replace(anchor,aux+anchor,1)
p.write_text(s,encoding='utf-8')
print('air/marine restored', 'async function air(' in s, 'async function marine(' in s)
# trigger restore workflow
