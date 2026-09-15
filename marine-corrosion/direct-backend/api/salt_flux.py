import base64
import json
import os
import re
import tempfile
import zipfile
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

ALLOWED_ORIGINS={"https://lwang1332-design.github.io"}
ADS_URL=os.environ.get("CAMS_ADS_URL","https://ads.atmosphere.copernicus.eu/api")
ADS_KEY=os.environ.get("CAMS_ADS_API_KEY")
JOB_RE=re.compile(r"^[A-Za-z0-9_-]{8,4096}$")
REQUEST_ID_RE=re.compile(r"^[A-Za-z0-9-]{8,200}$")
DATASET="cams-global-atmospheric-composition-forecasts"
# CAMS operational sea-salt deposition fluxes, kg m-2 s-1.
DRY=[
    "dry_deposition_of_sea_salt_aerosol_0.03-0.5um",
    "dry_deposition_of_sea_salt_aerosol_0.5-5um",
    "dry_deposition_of_sea_salt_aerosol_5-20um",
]
SED=[
    "sedimentation_of_sea_salt_aerosol_0.03-0.5um",
    "sedimentation_of_sea_salt_aerosol_0.5-5um",
    "sedimentation_of_sea_salt_aerosol_5-20um",
]
WET_CONV=[
    "wet_deposition_of_sea_salt_aerosol_0.03-0.5um_by_convective_precipitation",
    "wet_deposition_of_sea_salt_aerosol_0.5-5um_by_convective_precipitation",
    "wet_deposition_of_sea_salt_aerosol_5-20um_by_convective_precipitation",
]
WET_LS=[
    "wet_deposition_of_sea_salt_aerosol_0.03-0.5um_by_large_scale_precipitation",
    "wet_deposition_of_sea_salt_aerosol_0.5-5um_by_large_scale_precipitation",
    "wet_deposition_of_sea_salt_aerosol_5-20um_by_large_scale_precipitation",
]
VARIABLES=DRY+SED+WET_CONV+WET_LS
SHORTS={
    "ssDry1":"aerddpsss","ssDry2":"aerddpssm","ssDry3":"aerddpssl",
    "ssSed1":"aersdmsss","ssSed2":"aersdmssm","ssSed3":"aersdmssl",
    "ssWetConv1":"aerwdccsss","ssWetConv2":"aerwdccssm","ssWetConv3":"aerwdccssl",
    "ssWetLs1":"aerwdlssss","ssWetLs2":"aerwdlsssm","ssWetLs3":"aerwdlsssl",
}
FIELD_VARIABLES={
    "ssDry1":DRY[0],"ssDry2":DRY[1],"ssDry3":DRY[2],
    "ssSed1":SED[0],"ssSed2":SED[1],"ssSed3":SED[2],
    "ssWetConv1":WET_CONV[0],"ssWetConv2":WET_CONV[1],"ssWetConv3":WET_CONV[2],
    "ssWetLs1":WET_LS[0],"ssWetLs2":WET_LS[1],"ssWetLs3":WET_LS[2],
}


def _num(v):
    try:
        x=float(v);return x if x==x and abs(x)!=float("inf") else None
    except Exception:return None

def _area(lat,lon,half=.8):
    return [min(90.,lat+half),max(-180.,lon-half),max(-90.,lat-half),min(180.,lon+half)]

def _latest_cycle(now=None):
    now=now or datetime.now(timezone.utc);safe=now-timedelta(hours=8);hour=12 if safe.hour>=12 else 0
    return safe.replace(hour=hour,minute=0,second=0,microsecond=0)

def build_historical_request(year,lat,lon):
    if year<2019:
        raise ValueError("CAMS archived sea-salt deposition flux full-year mode requires year >= 2019")
    return {"dataset":DATASET,"request":{
        "variable":VARIABLES,
        "date":[f"{year}-01-01/{year}-12-31"],
        "time":["00:00"],
        "type":["forecast"],
        "leadtime_hour":[str(h) for h in range(0,24,3)],
        "data_format":"netcdf_zip",
        "area":_area(lat,lon),
    },"resolution":"~0.4° / 3 h archived operational deposition flux","history_basis":"ARCHIVED_FORECAST_FLUX"}

def build_current_request(lat,lon,cycle=None):
    cycle=cycle or _latest_cycle()
    return {"dataset":DATASET,"request":{
        "variable":VARIABLES,
        "date":[cycle.strftime("%Y-%m-%d")],
        "time":[cycle.strftime("%H:00")],
        "type":["forecast"],
        "leadtime_hour":[str(h) for h in range(0,121,3)],
        "data_format":"netcdf_zip",
        "area":_area(lat,lon),
    },"resolution":"~0.4° / 3 h / 5 d deposition flux","cycle":cycle,"history_basis":"FORECAST_FLUX"}

def _client():
    if not ADS_KEY:raise RuntimeError("CAMS_ADS_API_KEY is not configured")
    from ecmwf.datastores import Client
    return Client(url=ADS_URL,key=ADS_KEY,progress=False,cleanup=False,timeout=30,maximum_tries=3,retry_after=2,sleep_max=5)

def _encode_job(p):return base64.urlsafe_b64encode(json.dumps(p,separators=(",",":")).encode()).decode().rstrip("=")
def _decode_job(token):
    if not isinstance(token,str) or not JOB_RE.match(token):raise ValueError("invalid job token")
    p=json.loads(base64.urlsafe_b64decode(token+"="*(-len(token)%4)).decode())
    if not isinstance(p,dict) or not REQUEST_ID_RE.match(str(p.get("requestId",""))):raise ValueError("invalid request id")
    lat,lon=_num(p.get("lat")),_num(p.get("lon"))
    if lat is None or lon is None or abs(lat)>90 or abs(lon)>180 or p.get("mode") not in {"historical","current"}:raise ValueError("invalid job metadata")
    return p

def _submit(lat,lon,mode,year=None,cycle=None,back=0):
    spec=build_historical_request(year,lat,lon) if mode=="historical" else build_current_request(lat,lon,cycle or (_latest_cycle()-timedelta(hours=12*back)))
    remote=_client().submit(spec["dataset"],spec["request"]);rid=str(remote.request_id)
    if not REQUEST_ID_RE.match(rid):raise RuntimeError("ADS did not return a valid request id")
    meta={"requestId":rid,"lat":lat,"lon":lon,"mode":mode,"year":year,"dataset":spec["dataset"],"resolution":spec["resolution"],"historyBasis":spec["history_basis"],"back":back}
    if mode=="current":meta["cycle"]=spec["cycle"].isoformat().replace("+00:00","Z")
    return _encode_job(meta),str(remote.status or "accepted"),meta

def _datasets(path):
    import xarray as xr
    if zipfile.is_zipfile(path):
        tmp=tempfile.mkdtemp(prefix="cams-salt-flux-");out=[]
        with zipfile.ZipFile(path) as zf:zf.extractall(tmp)
        for root,_,files in os.walk(tmp):
            for name in files:
                if name.lower().endswith((".nc",".netcdf")):out.append(xr.open_dataset(os.path.join(root,name)))
        if not out:raise RuntimeError("CAMS deposition zip does not contain NetCDF")
        return out
    return [xr.open_dataset(path)]

def _nearest(ds,lat,lon):
    latn=next((x for x in ("latitude","lat") if x in ds.coords),None);lonn=next((x for x in ("longitude","lon") if x in ds.coords),None)
    if not latn or not lonn:return ds,{"latitude":None,"longitude":None}
    vals=ds[lonn].values
    try:lo,hi=float(vals.min()),float(vals.max())
    except Exception:lo,hi=-180,180
    qlon=lon%360 if lo>=0 and hi>180 else lon;pt=ds.sel({latn:lat,lonn:qlon},method="nearest")
    return pt,{"latitude":float(pt[latn].values),"longitude":float(pt[lonn].values)}

def _identify(ds,outkey):
    short=SHORTS[outkey];target=FIELD_VARIABLES[outkey].replace("_"," ").lower()
    for key in ds.data_vars:
        attrs=ds[key].attrs or {};name=key.lower();texts=[str(attrs.get(k,"")) for k in ("long_name","standard_name","short_name","GRIB_shortName")]
        text=" ".join(texts).replace("_"," ").lower()
        if name==short or str(attrs.get("GRIB_shortName","")).lower()==short or target in text:return key
    return None

def _time(ds,count,mode,year=None,cycle=None):
    import numpy as np, pandas as pd
    if "valid_time" in ds.coords:
        v=np.asarray(ds["valid_time"].values).reshape(-1)
        if len(v)==count:return [pd.Timestamp(x).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00","Z") for x in v]
    if "forecast_reference_time" in ds.coords and "forecast_period" in ds.coords:
        base=np.asarray(ds["forecast_reference_time"].values).reshape(-1);period=np.asarray(ds["forecast_period"].values)
        if period.size==count:
            if base.size==1:
                b=pd.Timestamp(base[0]);return [(b+pd.to_timedelta(x)).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00","Z") for x in period.reshape(-1)]
            # Multi-cycle archive: construct 2-D valid times when dimensions are compatible.
            if period.ndim==1 and base.size*period.size==count:
                out=[]
                for b in base:
                    bb=pd.Timestamp(b)
                    out.extend([(bb+pd.to_timedelta(x)).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00","Z") for x in period])
                return out
    for name in ("time","forecast_reference_time"):
        if name in ds.coords:
            v=np.asarray(ds[name].values).reshape(-1)
            if len(v)==count:return [pd.Timestamp(x).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00","Z") for x in v]
    if mode=="current" and cycle:return [(cycle+timedelta(hours=3*i)).isoformat().replace("+00:00","Z") for i in range(count)]
    return []

def _extract(path,lat,lon,mode,year=None,cycle=None):
    import numpy as np
    datasets=_datasets(path);series={};units={};grid=None;times=None
    try:
        for outkey in FIELD_VARIABLES:
            found=None
            for ds in datasets:
                pt,g=_nearest(ds,lat,lon);key=_identify(pt,outkey)
                if key:found=(pt,key,g);break
            if not found:raise RuntimeError(f"Unable to identify CAMS deposition variable {outkey}")
            pt,key,g=found;arr=np.asarray(pt[key].values,dtype=float).reshape(-1)
            vals=[]
            for x in arr:
                if not np.isfinite(x):vals.append(None)
                elif x>=0:vals.append(float(x))
                elif x>-1e-20:vals.append(0.0)
                else:vals.append(None)
            tt=_time(pt,len(vals),mode,year=year,cycle=cycle)
            if len(tt)!=len(vals):raise RuntimeError(f"CAMS {outkey} time/value mismatch {len(tt)} vs {len(vals)}")
            if times is None:times=tt
            elif times!=tt:raise RuntimeError("CAMS deposition variables have inconsistent time axes")
            series[outkey]=vals;units[outkey]=str(pt[key].attrs.get("units","kg m**-2 s**-1"));grid=grid or g
        order=sorted(range(len(times)),key=lambda i:times[i]);times=[times[i] for i in order]
        for k in series:series[k]=[series[k][i] for i in order]
        return times,series,units,grid
    finally:
        for ds in datasets:
            try:ds.close()
            except Exception:pass

def _result(meta):
    remote=_client().get_remote(meta["requestId"]);status=str(remote.status or "unknown").lower()
    if status in {"accepted","running","queued"} or not remote.results_ready:return "pending",{"status":status,"retryAfterSeconds":5}
    if status in {"failed","rejected"}:
        if meta["mode"]=="current" and int(meta.get("back",0))<3:
            prev=datetime.fromisoformat(meta["cycle"].replace("Z","+00:00"))-timedelta(hours=12);job,st,new=_submit(meta["lat"],meta["lon"],"current",cycle=prev,back=int(meta.get("back",0))+1)
            return "resubmitted",{"jobId":job,"status":st,"retryAfterSeconds":5,"cycle":new.get("cycle")}
        raise RuntimeError(f"ADS request {meta['requestId']} ended with status {status}")
    with tempfile.NamedTemporaryFile(suffix=".zip",delete=False) as f:target=f.name
    try:
        remote.download(target);cycle=datetime.fromisoformat(meta["cycle"].replace("Z","+00:00")) if meta.get("cycle") else None
        time,series,upunits,grid=_extract(target,meta["lat"],meta["lon"],meta["mode"],year=meta.get("year"),cycle=cycle);n=max(1,len(time));coverage={k:sum(v is not None for v in vals)/n for k,vals in series.items()}
        return "complete",{"version":"3.4.0","configured":True,"source":"CAMS archived operational sea-salt deposition flux" if meta["mode"]=="historical" else "CAMS Global atmospheric composition forecast sea-salt deposition flux","dataset":meta["dataset"],"productType":meta["historyBasis"],"resolution":meta["resolution"],**({"cycle":meta["cycle"]} if meta.get("cycle") else {}),"time":time,**series,"units":{k:"kg/(m²·s)" for k in series}|{"upstream":upunits},"grid":grid,"coverage":coverage,"referenceRhPercent":80,"massBasis":"CAMS sea-salt prognostic mass basis; platform converts deposition mass /4.3 to dry sea salt before chloride fraction","retrievedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z")}
    finally:
        try:os.remove(target)
        except OSError:pass

class handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin=self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:self.send_header("Access-Control-Allow-Origin",origin)
        self.send_header("Vary","Origin");self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS");self.send_header("Access-Control-Allow-Headers","Content-Type")
    def _json(self,status,body,cache="no-store"):
        raw=json.dumps(body,ensure_ascii=False).encode();self.send_response(status);self._cors();self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Cache-Control",cache);self.send_header("Content-Length",str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_OPTIONS(self):self.send_response(204);self._cors();self.end_headers()
    def _params(self):
        if self.command=="POST":
            length=int(self.headers.get("Content-Length","0") or "0");return json.loads(self.rfile.read(length) or b"{}")
        q=parse_qs(urlparse(self.path).query);return {k:v[-1] for k,v in q.items()}
    def _handle(self):
        origin=self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:return self._json(403,{"error":{"code":"ORIGIN","message":"Origin not allowed"}})
        if not ADS_KEY:return self._json(503,{"version":"3.4.0","configured":False,"error":{"code":"NOT_CONFIGURED","message":"CAMS_ADS_API_KEY is not configured on the server"}})
        try:
            p=self._params()
            if self.command=="GET" and p.get("job"):
                meta=_decode_job(p["job"]);state,data=_result(meta)
                if state in {"pending","resubmitted"}:
                    if state=="pending":data["jobId"]=p["job"]
                    return self._json(202,{"version":"3.4.0","configured":True,**data})
                cache="public, s-maxage=21600, stale-while-revalidate=86400" if meta["mode"]=="current" else "public, s-maxage=2592000, stale-while-revalidate=604800";return self._json(200,data,cache)
            lat,lon=_num(p.get("lat")),_num(p.get("lon"));mode=str(p.get("mode","")).lower();year=int(p.get("year")) if p.get("year") not in (None,"") else None
            if lat is None or lon is None or abs(lat)>90 or abs(lon)>180 or mode not in {"historical","current"}:return self._json(400,{"error":{"code":"INPUT","message":"Invalid lat/lon/mode"}})
            if mode=="historical" and (year is None or year<2019 or year>2025):return self._json(400,{"error":{"code":"INPUT","message":"Historical CAMS archived sea-salt flux requires full year 2019-2025"}})
            job,status,meta=_submit(lat,lon,mode,year=year);return self._json(202,{"version":"3.4.0","configured":True,"status":status,"jobId":job,"dataset":meta["dataset"],"productType":meta["historyBasis"],"resolution":meta["resolution"],"retryAfterSeconds":5,**({"cycle":meta["cycle"]} if meta.get("cycle") else {})})
        except Exception as e:return self._json(502,{"version":"3.4.0","configured":True,"error":{"code":"UPSTREAM","message":str(e)[:900]}})
    def do_GET(self):self._handle()
    def do_POST(self):self._handle()
