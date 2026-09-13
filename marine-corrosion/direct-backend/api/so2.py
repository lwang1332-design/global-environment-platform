import base64
import json
import os
import re
import tempfile
import zipfile
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

ALLOWED_ORIGINS = {"https://lwang1332-design.github.io"}
ADS_URL = os.environ.get("CAMS_ADS_URL", "https://ads.atmosphere.copernicus.eu/api")
ADS_KEY = os.environ.get("CAMS_ADS_API_KEY")
JOB_RE = re.compile(r"^[A-Za-z0-9_-]{8,4096}$")
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9-]{8,200}$")


def _num(v):
    try:
        x = float(v)
        return x if x == x and abs(x) != float("inf") else None
    except Exception:
        return None


def _area(lat, lon, half=0.8):
    return [min(90.0, lat + half), max(-180.0, lon - half), max(-90.0, lat - half), min(180.0, lon + half)]


def build_eac4_request(year, lat, lon):
    return {
        "dataset": "cams-global-reanalysis-eac4-monthly",
        "request": {
            "variable": ["sulphur_dioxide"],
            "model_level": ["60"],
            "year": [str(year)],
            "month": [f"{m:02d}" for m in range(1, 13)],
            "product_type": ["monthly_mean"],
            "data_format": "netcdf",
            "download_format": "unarchived",
            "area": _area(lat, lon),
        },
        "model_level": "60",
        "resolution": "0.75° monthly mean",
    }


def _latest_cycle(now=None):
    now = now or datetime.now(timezone.utc)
    safe = now - timedelta(hours=8)
    hour = 12 if safe.hour >= 12 else 0
    return safe.replace(hour=hour, minute=0, second=0, microsecond=0)


def build_forecast_request(lat, lon, cycle=None):
    cycle = cycle or _latest_cycle()
    return {
        "dataset": "cams-global-atmospheric-composition-forecasts",
        "request": {
            "variable": ["sulphur_dioxide"],
            "model_level": ["137"],
            "date": [cycle.strftime("%Y-%m-%d")],
            "time": [cycle.strftime("%H:00")],
            "type": ["forecast"],
            "leadtime_hour": [str(h) for h in range(0, 121, 3)],
            "data_format": "netcdf_zip",
            "area": _area(lat, lon),
        },
        "model_level": "137",
        "resolution": "~0.4° / 3 h / 5 d",
        "cycle": cycle,
    }


def _client():
    if not ADS_KEY:
        raise RuntimeError("CAMS_ADS_API_KEY is not configured")
    from ecmwf.datastores import Client
    return Client(url=ADS_URL, key=ADS_KEY, progress=False, cleanup=False, timeout=30, maximum_tries=3, retry_after=2, sleep_max=5)


def _encode_job(payload):
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_job(token):
    if not isinstance(token, str) or not JOB_RE.match(token):
        raise ValueError("invalid job token")
    raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    p = json.loads(raw.decode("utf-8"))
    if not isinstance(p, dict) or not REQUEST_ID_RE.match(str(p.get("requestId", ""))):
        raise ValueError("invalid request id")
    lat, lon = _num(p.get("lat")), _num(p.get("lon"))
    if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180 or p.get("mode") not in {"historical", "current"}:
        raise ValueError("invalid job metadata")
    return p


def _submit(lat, lon, mode, year=None, cycle=None, back=0):
    if mode == "historical":
        spec = build_eac4_request(year, lat, lon)
    else:
        cycle = cycle or (_latest_cycle() - timedelta(hours=12 * back))
        spec = build_forecast_request(lat, lon, cycle)
    remote = _client().submit(spec["dataset"], spec["request"])
    rid = str(remote.request_id)
    if not REQUEST_ID_RE.match(rid):
        raise RuntimeError("ADS did not return a valid request id")
    meta = {
        "requestId": rid,
        "lat": lat,
        "lon": lon,
        "mode": mode,
        "year": year,
        "dataset": spec["dataset"],
        "modelLevel": spec["model_level"],
        "resolution": spec["resolution"],
        "back": back,
    }
    if mode == "current":
        meta["cycle"] = spec["cycle"].isoformat().replace("+00:00", "Z")
    return _encode_job(meta), str(remote.status or "accepted"), meta


def _open_dataset(path):
    import xarray as xr
    if zipfile.is_zipfile(path):
        tmpdir = tempfile.mkdtemp(prefix="cams-so2-")
        with zipfile.ZipFile(path) as zf:
            zf.extractall(tmpdir)
        candidates = []
        for root, _, files in os.walk(tmpdir):
            for name in files:
                if name.lower().endswith((".nc", ".netcdf")):
                    candidates.append(os.path.join(root, name))
        if not candidates:
            raise RuntimeError("CAMS zip does not contain NetCDF")
        return xr.open_dataset(candidates[0])
    return xr.open_dataset(path)


def _find_so2_var(ds):
    for key in ds.data_vars:
        name = key.lower()
        attrs = ds[key].attrs or {}
        text = " ".join(str(attrs.get(k, "")) for k in ("long_name", "standard_name", "short_name")).lower()
        if name in {"so2", "so2_conc", "sulphur_dioxide"} or "sulphur dioxide" in text or "sulfur dioxide" in text:
            return key
    if len(ds.data_vars) == 1:
        return next(iter(ds.data_vars))
    raise RuntimeError("Unable to identify CAMS sulphur dioxide variable")


def _nearest_point(ds, lat, lon):
    lat_name = next((x for x in ("latitude", "lat") if x in ds.coords), None)
    lon_name = next((x for x in ("longitude", "lon") if x in ds.coords), None)
    if not lat_name or not lon_name:
        return ds, {"latitude": None, "longitude": None}
    lon_values = ds[lon_name].values
    try:
        lon_min, lon_max = float(lon_values.min()), float(lon_values.max())
    except Exception:
        lon_min, lon_max = -180.0, 180.0
    qlon = lon % 360 if lon_min >= 0 and lon_max > 180 else lon
    picked = ds.sel({lat_name: lat, lon_name: qlon}, method="nearest")
    return picked, {"latitude": float(picked[lat_name].values), "longitude": float(picked[lon_name].values)}


def _time_values(ds, count, mode, year=None, cycle=None):
    import numpy as np
    import pandas as pd
    if "valid_time" in ds.coords:
        vals = np.asarray(ds["valid_time"].values).reshape(-1)
        if len(vals) == count:
            return [pd.Timestamp(x).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") for x in vals]
    if mode == "current" and "forecast_reference_time" in ds.coords and "forecast_period" in ds.coords:
        base = pd.Timestamp(np.asarray(ds["forecast_reference_time"].values).reshape(-1)[0])
        periods = np.asarray(ds["forecast_period"].values).reshape(-1)
        if len(periods) == count:
            return [(base + pd.to_timedelta(p)).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") for p in periods]
    for name in ("time", "forecast_reference_time"):
        if name in ds.coords:
            vals = np.asarray(ds[name].values).reshape(-1)
            if len(vals) == count:
                return [pd.Timestamp(x).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") for x in vals]
    if mode == "historical" and year:
        return [datetime(year, m, 15, 12, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") for m in range(1, count + 1)]
    if mode == "current" and cycle:
        return [(cycle + timedelta(hours=3 * i)).isoformat().replace("+00:00", "Z") for i in range(count)]
    return []


def _extract(path, lat, lon, mode, year=None, cycle=None):
    import numpy as np
    ds = _open_dataset(path)
    try:
        point, grid = _nearest_point(ds, lat, lon)
        key = _find_so2_var(point)
        arr = np.asarray(point[key].values, dtype=float).reshape(-1)
        good = [float(x) if np.isfinite(x) and x >= 0 else None for x in arr]
        times = _time_values(point, len(good), mode, year=year, cycle=cycle)
        if len(times) != len(good):
            raise RuntimeError(f"CAMS time/value length mismatch: {len(times)} vs {len(good)}")
        return times, good, str(point[key].attrs.get("units", "kg kg**-1")), grid
    finally:
        ds.close()


def _result_from_remote(meta):
    remote = _client().get_remote(meta["requestId"])
    status = str(remote.status or "unknown").lower()
    if status in {"accepted", "running", "queued"} or not remote.results_ready:
        return "pending", {"status": status, "retryAfterSeconds": 5}
    if status in {"failed", "rejected"}:
        if meta["mode"] == "current" and int(meta.get("back", 0)) < 3:
            prev_cycle = datetime.fromisoformat(meta["cycle"].replace("Z", "+00:00")) - timedelta(hours=12)
            job, new_status, new_meta = _submit(meta["lat"], meta["lon"], "current", cycle=prev_cycle, back=int(meta.get("back", 0)) + 1)
            return "resubmitted", {"jobId": job, "status": new_status, "retryAfterSeconds": 5, "cycle": new_meta.get("cycle")}
        raise RuntimeError(f"ADS request {meta['requestId']} ended with status {status}")
    suffix = ".zip" if meta["mode"] == "current" else ".nc"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        target = f.name
    try:
        remote.download(target)
        cycle = datetime.fromisoformat(meta["cycle"].replace("Z", "+00:00")) if meta.get("cycle") else None
        time, so2, unit, grid = _extract(target, meta["lat"], meta["lon"], meta["mode"], year=meta.get("year"), cycle=cycle)
        return "complete", {
            "version": "3.3.2",
            "configured": True,
            "source": "CAMS EAC4 monthly reanalysis" if meta["mode"] == "historical" else "CAMS Global atmospheric composition forecast",
            "dataset": meta["dataset"],
            "productType": "REANALYSIS" if meta["mode"] == "historical" else "FORECAST",
            "modelLevel": meta["modelLevel"],
            "resolution": meta["resolution"],
            **({"cycle": meta["cycle"]} if meta.get("cycle") else {}),
            "time": time,
            "so2": so2,
            "units": {"so2": "kg/kg", "upstream": unit},
            "grid": grid,
            "coverage": sum(x is not None for x in so2) / max(1, len(so2)),
            "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
    finally:
        try:
            os.remove(target)
        except OSError:
            pass


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, body, cache="no-store"):
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", cache)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _params(self):
        if self.command == "POST":
            length = int(self.headers.get("Content-Length", "0") or "0")
            return json.loads(self.rfile.read(length) or b"{}")
        q = parse_qs(urlparse(self.path).query)
        return {k: v[-1] for k, v in q.items()}

    def _handle(self):
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return self._json(403, {"error": {"code": "ORIGIN", "message": "Origin not allowed"}})
        if not ADS_KEY:
            return self._json(503, {"version": "3.3.2", "configured": False, "error": {"code": "NOT_CONFIGURED", "message": "CAMS_ADS_API_KEY is not configured on the server"}})
        try:
            p = self._params()
            if self.command == "GET" and p.get("job"):
                meta = _decode_job(p["job"])
                state, data = _result_from_remote(meta)
                if state in {"pending", "resubmitted"}:
                    if state == "pending":
                        data["jobId"] = p["job"]
                    return self._json(202, {"version": "3.3.2", "configured": True, **data})
                cache = "public, s-maxage=21600, stale-while-revalidate=86400" if meta["mode"] == "current" else "public, s-maxage=2592000, stale-while-revalidate=604800"
                return self._json(200, data, cache=cache)

            lat, lon = _num(p.get("lat")), _num(p.get("lon"))
            mode = str(p.get("mode", "")).lower()
            year = int(p.get("year")) if p.get("year") not in (None, "") else None
            if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180 or mode not in {"historical", "current"}:
                return self._json(400, {"error": {"code": "INPUT", "message": "Invalid lat/lon/mode"}})
            if mode == "historical" and (year is None or year < 2003 or year > 2025):
                return self._json(400, {"error": {"code": "INPUT", "message": "EAC4 historical year must be 2003-2025"}})
            job, status, meta = _submit(lat, lon, mode, year=year)
            return self._json(202, {"version": "3.3.2", "configured": True, "status": status, "jobId": job, "retryAfterSeconds": 5, "dataset": meta["dataset"], "modelLevel": meta["modelLevel"], **({"cycle": meta["cycle"]} if meta.get("cycle") else {})})
        except ValueError as exc:
            return self._json(400, {"error": {"code": "INPUT", "message": str(exc)}})
        except Exception as exc:
            return self._json(502, {"version": "3.3.2", "configured": True, "error": {"code": "CAMS_UPSTREAM", "message": str(exc)[:500]}})

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()
