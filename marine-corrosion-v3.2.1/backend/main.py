"""Marine Corrosion Engineering Data Gateway V3.2.1.
Direct connectors: ERA5/CDS, CAMS/ADS, CMEMS/Copernicus Marine.
"""
from __future__ import annotations
import os, math, tempfile, json, hashlib, zipfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import xarray as xr
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    import cdsapi
except Exception:
    cdsapi=None
try:
    import copernicusmarine
except Exception:
    copernicusmarine=None

APP_VERSION="3.2.1"
CACHE=Path(os.getenv("DATA_CACHE_DIR","/tmp/marine-cache")); CACHE.mkdir(parents=True,exist_ok=True)
TOKEN=os.getenv("ENGINEERING_DATA_API_TOKEN","")
CDS_KEY=os.getenv("CDS_API_KEY","")
ADS_KEY=os.getenv("ADS_API_KEY",CDS_KEY)
CM_USER=os.getenv("COPERNICUSMARINE_SERVICE_USERNAME","")
CM_PASS=os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD","")
GSHHG_PATH=os.getenv("GSHHG_SHAPEFILE","")

app=FastAPI(title="Marine Corrosion Engineering Data Gateway",version=APP_VERSION)
app.add_middleware(CORSMiddleware,allow_origins=[x.strip() for x in os.getenv("CORS_ORIGINS","*").split(",")],allow_methods=["GET"],allow_headers=["*"])

def auth(authorization:Optional[str]):
    if TOKEN and authorization != f"Bearer {TOKEN}": raise HTTPException(401,"invalid gateway token")

def cache_path(kind,lat,lon,key):
    h=hashlib.sha1(f"{kind}|{lat:.4f}|{lon:.4f}|{key}".encode()).hexdigest()[:18]
    return CACHE/f"{kind}-{h}.json"

def save_cache(p,obj): p.write_text(json.dumps(obj,ensure_ascii=False,default=lambda v:v.tolist() if isinstance(v,np.ndarray) else v.item() if isinstance(v,(np.floating,np.integer)) else v),encoding="utf-8")
def load_cache(p):
    try: return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    except Exception: return None

def nearest_series(ds,lat,lon):
    ren={}
    for a,b in [("valid_time","time"),("latitude","lat"),("longitude","lon")]:
        if a in ds.coords and b not in ds.coords: ren[a]=b
    if ren: ds=ds.rename(ren)
    if "lon" in ds.coords:
        x=lon; vals=ds.lon.values
        if np.nanmax(vals)>180 and x<0: x+=360
        ds=ds.sel(lon=x,method="nearest")
    if "lat" in ds.coords: ds=ds.sel(lat=lat,method="nearest")
    return ds

def arr(ds,names,scale=1,offset=0):
    for name in names:
        if name in ds:
            return (np.asarray(ds[name].values).squeeze()*scale+offset).astype(float).reshape(-1).tolist()
    return None

def times(ds):
    return pd.to_datetime(ds.time.values).strftime("%Y-%m-%dT%H:%M:%S").tolist() if "time" in ds.coords else []

def cds_client(url,key):
    if cdsapi is None: raise HTTPException(503,"cdsapi is not installed")
    if not key: raise HTTPException(503,"Copernicus Data Store token is not configured")
    return cdsapi.Client(url=url,key=key,quiet=True)

ERA5_VARS=["2m_temperature","2m_dewpoint_temperature","10m_u_component_of_wind","10m_v_component_of_wind","100m_u_component_of_wind","100m_v_component_of_wind","surface_pressure","total_precipitation","boundary_layer_height","total_cloud_cover","low_cloud_cover","skin_temperature","surface_solar_radiation_downwards","surface_thermal_radiation_downwards","10m_wind_gust_since_previous_post_processing"]

def fetch_era5(lat,lon,year):
    cp=cache_path("era5",lat,lon,str(year)); c=load_cache(cp)
    if c:return c
    client=cds_client("https://cds.climate.copernicus.eu/api",CDS_KEY); frames=[]
    with tempfile.TemporaryDirectory() as td:
        for month in range(1,13):
            days=pd.Period(f"{year}-{month:02d}").days_in_month
            req={"product_type":["reanalysis"],"variable":ERA5_VARS,"year":[str(year)],"month":[f"{month:02d}"],"day":[f"{d:02d}" for d in range(1,days+1)],"time":[f"{h:02d}:00" for h in range(24)],"data_format":"netcdf","download_format":"unarchived","area":[lat,lon,lat,lon]}
            f=Path(td)/f"era5-{month:02d}.nc"; client.retrieve("reanalysis-era5-single-levels",req,str(f))
            d=xr.open_dataset(f); d=nearest_series(d,lat,lon); frames.append(d.load()); d.close()
        ds=xr.concat(frames,dim="time").sortby("time")
        out={"source":"ERA5 Direct / CDS API","resolution":"1h","time":times(ds),"temperature_2m":arr(ds,["t2m","2m_temperature"],offset=-273.15),"dewpoint_2m":arr(ds,["d2m","2m_dewpoint_temperature"],offset=-273.15),"u10_component":arr(ds,["u10","10m_u_component_of_wind"]),"v10_component":arr(ds,["v10","10m_v_component_of_wind"]),"u100_component":arr(ds,["u100","100m_u_component_of_wind"]),"v100_component":arr(ds,["v100","100m_v_component_of_wind"]),"surface_pressure":arr(ds,["sp","surface_pressure"],scale=.01),"precipitation":arr(ds,["tp","total_precipitation"],scale=1000),"boundary_layer_height":arr(ds,["blh","boundary_layer_height"]),"cloud_cover":arr(ds,["tcc","total_cloud_cover"],scale=100),"shortwave_down":arr(ds,["ssrd","surface_solar_radiation_downwards"],scale=1/3600),"longwave_down":arr(ds,["strd","surface_thermal_radiation_downwards"],scale=1/3600),"wind_gust_10m":arr(ds,["fg10","10m_wind_gust_since_previous_post_processing"])}
    save_cache(cp,out); return out

CAMS_VARS=["sea_salt_aerosol_0.03-0.5um_mixing_ratio","sea_salt_aerosol_0.5-5um_mixing_ratio","sea_salt_aerosol_5-20um_mixing_ratio","sulphur_dioxide"]

def fetch_cams_eac4(lat,lon,year):
    cp=cache_path("cams-eac4",lat,lon,str(year)); c=load_cache(cp)
    if c:return c
    client=cds_client("https://ads.atmosphere.copernicus.eu/api",ADS_KEY)
    with tempfile.TemporaryDirectory() as td:
        f=Path(td)/"cams.nc"
        req={"variable":CAMS_VARS,"model_level":[os.getenv("CAMS_EAC4_SURFACE_LEVEL","60")],"date":[f"{year}-01-01/{year}-12-31"],"time":["00:00","03:00","06:00","09:00","12:00","15:00","18:00","21:00"],"data_format":"netcdf","download_format":"unarchived","area":[lat,lon,lat,lon]}
        client.retrieve("cams-global-reanalysis-eac4",req,str(f))
        ds=xr.open_dataset(f); ds=nearest_series(ds,lat,lon).load()
        out={"source":"CAMS EAC4 Direct / ADS","resolution":"3h; 0.75deg","time":times(ds),"ss1":arr(ds,["aermr01","sea_salt_aerosol_0.03-0.5um_mixing_ratio"]),"ss2":arr(ds,["aermr02","sea_salt_aerosol_0.5-5um_mixing_ratio"]),"ss3":arr(ds,["aermr03","sea_salt_aerosol_5-20um_mixing_ratio"]),"so2":arr(ds,["so2","sulphur_dioxide"])}; ds.close()
    save_cache(cp,out); return out

def forecast_times(ds):
    if "valid_time" in ds.coords:return pd.to_datetime(np.asarray(ds.valid_time.values).reshape(-1))
    base=None; step=None
    for k in ["forecast_reference_time","time"]:
        if k in ds.coords: base=pd.to_datetime(np.asarray(ds[k].values).reshape(-1)[0]); break
    for k in ["forecast_period","step","leadtime"]:
        if k in ds.coords: step=np.asarray(ds[k].values).reshape(-1); break
    if base is None or step is None:return pd.DatetimeIndex([])
    vals=[]
    for x in step:
        try: vals.append(base+pd.to_timedelta(x))
        except Exception: vals.append(base+pd.to_timedelta(float(x),unit="h"))
    return pd.DatetimeIndex(vals)

def flat(ds,names):
    for n in names:
        if n in ds:return np.asarray(ds[n].values).squeeze().astype(float).reshape(-1).tolist()
    return None

def fetch_cams_current(lat,lon):
    now=datetime.now(timezone.utc); run_day=now.date() if now.hour>=6 else (now-timedelta(days=1)).date(); run_time="12:00" if now.hour>=18 or now.hour<6 else "00:00"
    key=f"{run_day}|{run_time}"; cp=cache_path("cams-current",lat,lon,key); c=load_cache(cp)
    if c:return c
    client=cds_client("https://ads.atmosphere.copernicus.eu/api",ADS_KEY)
    with tempfile.TemporaryDirectory() as td:
        z=Path(td)/"cams.zip"; req={"variable":CAMS_VARS,"model_level":[os.getenv("CAMS_CURRENT_SURFACE_LEVEL","137")],"date":[f"{run_day}/{run_day}"],"time":[run_time],"leadtime_hour":[str(h) for h in range(0,121,3)],"type":["forecast"],"data_format":"netcdf_zip","area":[min(90,lat+.3),max(-180,lon-.3),max(-90,lat-.3),min(180,lon+.3)]}
        client.retrieve("cams-global-atmospheric-composition-forecasts",req,str(z)); ex=Path(td)/"unz"; ex.mkdir(); zipfile.ZipFile(z).extractall(ex)
        files=list(ex.rglob("*.nc"))+list(ex.rglob("*.nc4"));
        if not files: raise HTTPException(502,"CAMS forecast returned no NetCDF files")
        parts=[]
        for f in files:
            d=xr.open_dataset(f); d=nearest_series(d,lat,lon); parts.append(d.load()); d.close()
        try: ds=xr.combine_by_coords(parts,combine_attrs="override") if len(parts)>1 else parts[0]
        except Exception: ds=xr.merge(parts,compat="override") if len(parts)>1 else parts[0]
        vt=forecast_times(ds); out={"source":"CAMS Global Atmospheric Composition Forecast Direct / ADS","resolution":"3h multi-level; 0.4deg","time":vt.strftime("%Y-%m-%dT%H:%M:%S").tolist(),"ss1":flat(ds,["aermr01","sea_salt_aerosol_0.03-0.5um_mixing_ratio"]),"ss2":flat(ds,["aermr02","sea_salt_aerosol_0.5-5um_mixing_ratio"]),"ss3":flat(ds,["aermr03","sea_salt_aerosol_5-20um_mixing_ratio"]),"so2":flat(ds,["so2","sulphur_dioxide"])}
        m=min([len(out["time"])] + [len(x) for x in [out["ss1"],out["ss2"],out["ss3"],out["so2"]] if x]); out["time"]=out["time"][:m]
        for k in ["ss1","ss2","ss3","so2"]: out[k]=(out[k] or [None]*m)[:m]
    save_cache(cp,out);return out

def cm_open(dataset_id,variables,lat,lon,start,end,depth=False):
    if copernicusmarine is None: raise HTTPException(503,"copernicusmarine is not installed")
    if not (CM_USER and CM_PASS): raise HTTPException(503,"Copernicus Marine credentials are not configured")
    kw=dict(dataset_id=dataset_id,minimum_longitude=lon-.06,maximum_longitude=lon+.06,minimum_latitude=lat-.06,maximum_latitude=lat+.06,start_datetime=start,end_datetime=end,username=CM_USER,password=CM_PASS)
    if variables: kw["variables"]=variables
    if depth:kw.update(minimum_depth=0,maximum_depth=2)
    return copernicusmarine.open_dataset(**kw)

def first(ds,names):
    for n in names:
        if n in ds:return n

def fetch_cmems(lat,lon,start,end,current=False):
    key=f"{start}|{end}|{current}"; cp=cache_path("cmems",lat,lon,key); c=load_cache(cp)
    if c:return c
    wav="cmems_mod_glo_wav_anfc_0.083deg_PT3H-i" if current else "cmems_mod_glo_wav_my_0.2deg_PT3H-i"
    sal="cmems_mod_glo_phy-so_anfc_0.083deg_PT6H-i" if current else "cmems_mod_glo_phy_my_0.083deg_P1D-m"
    w=nearest_series(cm_open(wav,None,lat,lon,start,end),lat,lon)
    nm={"hs":first(w,["VHM0","vhm0"]),"tp":first(w,["VTM10","VTPK","vtm10"]),"wdir":first(w,["VMDR","vmdr"]),"windWaveHs":first(w,["VHM0_WW","vhm0_ww"]),"windWaveTp":first(w,["VTM01_WW","vtm01_ww"]),"swellHs":first(w,["VHM0_SW1","vhm0_sw1"]),"swellTp":first(w,["VTM01_SW1","vtm01_sw1"])}
    wt=times(w); out={"source":"CMEMS Direct / Copernicus Marine Toolbox","resolution":"native","time":wt}
    for k,n in nm.items(): out[k]=arr(w,[n]) if n else [None]*len(wt)
    p=nearest_series(cm_open(sal,["so"],lat,lon,start,end,True),lat,lon); pt=times(p); sv=arr(p,["so"])
    sdf=pd.DataFrame({"time":pd.to_datetime(pt),"salinity":sv}).sort_values("time"); wdf=pd.DataFrame({"time":pd.to_datetime(wt)}).sort_values("time"); m=pd.merge_asof(wdf,sdf,on="time",direction="nearest",tolerance=pd.Timedelta("2D")); out["salinity"]=m.salinity.ffill().bfill().tolist(); out["sst"]=[None]*len(wt)
    save_cache(cp,out);return out

def bearing(lat1,lon1,lat2,lon2):
    p1,p2=math.radians(lat1),math.radians(lat2); dl=math.radians(lon2-lon1); y=math.sin(dl)*math.cos(p2); x=math.cos(p1)*math.sin(p2)-math.sin(p1)*math.cos(p2)*math.cos(dl); return (math.degrees(math.atan2(y,x))+360)%360

def hav(lat1,lon1,lat2,lon2):
    p1,p2=math.radians(lat1),math.radians(lat2); dp=p2-p1; dl=math.radians(lon2-lon1); a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2; return 6371*2*math.atan2(math.sqrt(a),math.sqrt(1-a))

def destination(lat,lon,b,km):
    R=6371; br=math.radians(b); p1=math.radians(lat); l1=math.radians(lon); d=km/R; p2=math.asin(math.sin(p1)*math.cos(d)+math.cos(p1)*math.sin(d)*math.cos(br)); l2=l1+math.atan2(math.sin(br)*math.sin(d)*math.cos(p1),math.cos(d)-math.sin(p1)*math.sin(p2)); return math.degrees(p2),(math.degrees(l2)+540)%360-180

def fetch_gis(lat,lon):
    if not GSHHG_PATH or not Path(GSHHG_PATH).exists(): return None
    try:
        import geopandas as gpd
        from shapely.geometry import Point,LineString
        from shapely.ops import nearest_points
        gdf=gpd.read_file(GSHHG_PATH,bbox=(lon-12,lat-12,lon+12,lat+12)).to_crs(4326); p=Point(lon,lat)
        if gdf.empty:return None
        poly=gdf.geometry.geom_type.isin(["Polygon","MultiPolygon"]).any(); land=(gdf.geometry.union_all() if hasattr(gdf.geometry,"union_all") else gdf.geometry.unary_union).contains(p) if poly else True; lines=gdf.geometry.boundary if poly else gdf.geometry
        best=None; bestd=1e9
        for geom in lines:
            q=nearest_points(p,geom)[1]; d=hav(lat,lon,q.y,q.x)
            if d<bestd:bestd=d;best=q
        union=lines.union_all() if hasattr(lines,"union_all") else lines.unary_union; bins=[]
        for b in range(0,360,15):
            la,lo=destination(lat,lon,b,1200); inter=LineString([(lon,lat),(lo,la)]).intersection(union); pts=[inter] if getattr(inter,"geom_type","")=="Point" else [x for x in getattr(inter,"geoms",[]) if x.geom_type=="Point"]; ds=sorted(hav(lat,lon,x.y,x.x) for x in pts if hav(lat,lon,x.y,x.x)>.05)
            sea=0.0 if not land else (ds[0] if ds else 999.0); fetch=(ds[0] if ds else 1200.0) if not land else ((ds[1]-ds[0]) if len(ds)>1 else (1200-sea if sea<999 else 0)); bins.append({"bearing":b,"seaDistanceKm":sea,"fetchKm":max(0,fetch)})
        return {"siteMedium":"land" if land else "sea","distanceToCoastKm":bestd,"coastBearing":bearing(lat,lon,best.y,best.x) if best else None,"nearestCoastLat":best.y if best else None,"nearestCoastLon":best.x if best else None,"bearingBins":bins,"provenance":{"type":"CALC","source":"GSHHG Direct GIS Worker"}}
    except Exception:return None

def marine_point(lat,lon,g):
    if not g or g.get("siteMedium")=="sea": return lat,lon
    if g.get("coastBearing") is None:return lat,lon
    return destination(lat,lon,float(g["coastBearing"]),float(g.get("distanceToCoastKm",0))+10)

@app.get('/v1/health')
def health(authorization:Optional[str]=Header(None)):
    auth(authorization);return {"ok":True,"version":APP_VERSION,"era5":bool(CDS_KEY),"cams":bool(ADS_KEY),"cmems":bool(CM_USER and CM_PASS),"gshhg":bool(GSHHG_PATH and Path(GSHHG_PATH).exists()),"cache":str(CACHE)}

@app.get('/v1/historical/context')
def historical_context(lat:float=Query(...),lon:float=Query(...),year:int=Query(...),height:float=10,authorization:Optional[str]=Header(None)):
    auth(authorization)
    if year<1993:raise HTTPException(400,"full Direct stack requires 1993 or later")
    g=fetch_gis(lat,lon); mlat,mlon=marine_point(lat,lon,g)
    return {"weather":fetch_era5(lat,lon,year),"cams":fetch_cams_eac4(lat,lon,year),"ocean":fetch_cmems(mlat,mlon,f"{year}-01-01",f"{year}-12-31",False),"gis":g}

@app.get('/v1/current/context')
def current_context(lat:float=Query(...),lon:float=Query(...),height:float=10,authorization:Optional[str]=Header(None)):
    auth(authorization); now=datetime.now(timezone.utc).replace(minute=0,second=0,microsecond=0); g=fetch_gis(lat,lon); mlat,mlon=marine_point(lat,lon,g)
    return {"weather":None,"cams":fetch_cams_current(lat,lon),"ocean":fetch_cmems(mlat,mlon,(now-timedelta(days=1)).isoformat(),(now+timedelta(days=5)).isoformat(),True),"gis":g}
