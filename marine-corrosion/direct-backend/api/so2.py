import json
import os
import tempfile
import zipfile
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

ALLOWED_ORIGINS = {"https://lwang1332-design.github.io"}
ADS_URL = os.environ.get("CAMS_ADS_URL", "https://ads.atmosphere.copernicus.eu/api")
ADS_KEY = os.environ.get("CAMS_ADS_API_KEY")


def _num(v):
    try:
        x = float(v)
        return x if x == x and abs(x) != float("inf") else None
    except Exception:
        return None


def _area(lat, lon, half=0.8):
    north = min(90.0, lat + half)
    south = max(-90.0, lat - half)
    west = max(-180.0, lon - half)
    east = min(180.0, lon + half)
    return [north, west, south, east]


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
    # ADS can lag the nominal production cycle. Start from a cycle at least 8 h old.
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
        lon_min = float(lon_values.min())
        lon_max = float(lon_values.max())
    except Exception:
        lon_min, lon_max = -180.0, 180.0
    qlon = lon % 360 if lon_min >= 0 and lon_max > 180 else lon
    picked = ds.sel({lat_name: lat, lon_name: qlon}, method="nearest")
    return picked, {
        "latitude": float(picked[lat_name].values),
        "longitude": float(picked[lon_name].values),
    }


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
            out = []
            for p in periods:
                td = pd.to_timedelta(p)
                out.append((base + td).to_pydatetime().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"))
            return out
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
        unit = str(point[key].attrs.get("units", "kg kg**-1"))
        return times, good, unit, grid
    finally:
        ds.close()


def retrieve_so2(lat, lon, mode, year=None):
    if not ADS_KEY:
        raise RuntimeError("CAMS_ADS_API_KEY is not configured")
    import cdsapi

    client = cdsapi.Client(url=ADS_URL, key=ADS_KEY, quiet=True, wait_until_complete=True, delete=False)
    if mode == "historical":
        spec = build_eac4_request(year, lat, lon)
        with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as f:
            target = f.name
        try:
            client.retrieve(spec["dataset"], spec["request"]).download(target)
            time, so2, unit, grid = _extract(target, lat, lon, mode, year=year)
            return {
                "version": "3.3.2",
                "source": "CAMS EAC4 monthly reanalysis",
                "dataset": spec["dataset"],
                "productType": "REANALYSIS",
                "modelLevel": spec["model_level"],
                "resolution": spec["resolution"],
                "time": time,
                "so2": so2,
                "units": {"so2": "kg/kg", "upstream": unit},
                "grid": grid,
                "coverage": sum(x is not None for x in so2) / max(1, len(so2)),
            }
        finally:
            try:
                os.remove(target)
            except OSError:
                pass

    last_error = None
    for back in range(4):
        cycle = _latest_cycle() - timedelta(hours=12 * back)
        spec = build_forecast_request(lat, lon, cycle)
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as f:
            target = f.name
        try:
            client.retrieve(spec["dataset"], spec["request"]).download(target)
            time, so2, unit, grid = _extract(target, lat, lon, mode, cycle=cycle)
            return {
                "version": "3.3.2",
                "source": "CAMS Global atmospheric composition forecast",
                "dataset": spec["dataset"],
                "productType": "FORECAST",
                "modelLevel": spec["model_level"],
                "resolution": spec["resolution"],
                "cycle": cycle.isoformat().replace("+00:00", "Z"),
                "time": time,
                "so2": so2,
                "units": {"so2": "kg/kg", "upstream": unit},
                "grid": grid,
                "coverage": sum(x is not None for x in so2) / max(1, len(so2)),
            }
        except Exception as exc:
            last_error = exc
        finally:
            try:
                os.remove(target)
            except OSError:
                pass
    raise RuntimeError(f"CAMS forecast unavailable for recent cycles: {last_error}")


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
            body = json.loads(self.rfile.read(length) or b"{}")
            return body
        q = parse_qs(urlparse(self.path).query)
        return {k: v[-1] for k, v in q.items()}

    def _handle(self):
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return self._json(403, {"error": {"code": "ORIGIN", "message": "Origin not allowed"}})
        try:
            p = self._params()
            lat = _num(p.get("lat"))
            lon = _num(p.get("lon"))
            mode = str(p.get("mode", "")).lower()
            year = int(p.get("year")) if p.get("year") not in (None, "") else None
            if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180 or mode not in {"historical", "current"}:
                return self._json(400, {"error": {"code": "INPUT", "message": "Invalid lat/lon/mode"}})
            if mode == "historical" and (year is None or year < 2003 or year > 2025):
                return self._json(400, {"error": {"code": "INPUT", "message": "EAC4 historical year must be 2003-2025"}})
            if not ADS_KEY:
                return self._json(503, {"version": "3.3.2", "configured": False, "error": {"code": "NOT_CONFIGURED", "message": "CAMS_ADS_API_KEY is not configured on the server"}})
            data = retrieve_so2(lat, lon, mode, year)
            data["configured"] = True
            data["retrievedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            cache = "public, s-maxage=21600, stale-while-revalidate=86400" if mode == "current" else "public, s-maxage=2592000, stale-while-revalidate=604800"
            return self._json(200, data, cache=cache)
        except Exception as exc:
            return self._json(502, {"version": "3.3.2", "configured": bool(ADS_KEY), "error": {"code": "CAMS_UPSTREAM", "message": str(exc)[:500]}})

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()
