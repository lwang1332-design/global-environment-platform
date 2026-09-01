#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Global Environment Platform local workstation server.
Python stdlib only: static hosting + SQLite + cache/project/config APIs + safe Open-Meteo proxy.
"""
from __future__ import annotations
import json, os, re, shutil, socket, sqlite3, sys, threading, time, traceback, urllib.parse, urllib.request, zipfile
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CONFIG = ROOT / "config"
CACHE = ROOT / "cache"
PROJECTS = ROOT / "projects"
REPORTS = ROOT / "reports"
LOGS = ROOT / "logs"
BACKUP = ROOT / "backup"
DB = DATA / "environment_platform.sqlite3"
PID = ROOT / ".local_server.pid"
VERSION_FILE = ROOT / "VERSION.json"
REMOTE_CONFIG_BASE = "https://vzlnwrxscufkchxkdjus.supabase.co/functions/v1/v29-config"

for p in (DATA, CONFIG, CACHE, PROJECTS, REPORTS, LOGS, BACKUP): p.mkdir(parents=True, exist_ok=True)

def now(): return datetime.now(timezone.utc).isoformat()
def log(kind, msg):
    line=f"{now()} [{kind}] {msg}\n"
    try: (LOGS / f"app_{datetime.now().strftime('%Y%m%d')}.log").open('a',encoding='utf-8').write(line)
    except Exception: pass
    print(line.rstrip())

def db():
    c=sqlite3.connect(DB, timeout=20)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    c.executescript('''
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,payload TEXT NOT NULL,source TEXT,updated_at TEXT NOT NULL,expires_at INTEGER);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,detail TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS calculations(id TEXT PRIMARY KEY,project_id TEXT,payload TEXT NOT NULL,created_at TEXT NOT NULL);
    ''')
    return c

def json_bytes(obj): return json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('utf-8')
def valid_coord(v,a,b):
    try: x=float(v); return x if a<=x<=b else None
    except: return None

def cache_key(lat,lon,start,end): return f"era5:{lat:.5f}:{lon:.5f}:{start}:{end}"
def fetch_json(url, timeout=20):
    req=urllib.request.Request(url,headers={'User-Agent':'GlobalEnvironmentPlatform-Local/3.0','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as r: return json.loads(r.read().decode('utf-8'))

def get_cached(key):
    with db() as c:
        row=c.execute("SELECT payload,source,updated_at,expires_at FROM cache WHERE key=?",(key,)).fetchone()
    if not row: return None
    try:
        return {'payload':json.loads(row[0]),'source':row[1],'updated_at':row[2],'expired':bool(row[3] and row[3]<int(time.time()))}
    except: return None

def put_cache(key,payload,source,ttl=21600):
    ts=now(); exp=int(time.time())+ttl
    with db() as c:c.execute("INSERT OR REPLACE INTO cache(key,payload,source,updated_at,expires_at) VALUES(?,?,?,?,?)",(key,json.dumps(payload,ensure_ascii=False),source,ts,exp))

def backup_all():
    stamp=datetime.now().strftime('%Y%m%d_%H%M%S'); out=BACKUP/f"EnvironmentPlatform_Backup_{stamp}.zip"
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for p in (CONFIG,PROJECTS,DATA):
            if p.exists():
                for f in p.rglob('*'):
                    if f.is_file() and f!=out:z.write(f,f.relative_to(ROOT))
    return out

class Handler(SimpleHTTPRequestHandler):
    server_version="GEPlatformLocal/3.0"
    def log_message(self, fmt, *args): log('HTTP',fmt%args)
    def end_headers(self):
        self.send_header('Cache-Control','no-store' if self.path.startswith('/local-api/') else 'no-cache')
        super().end_headers()
    def sendj(self,status,obj):
        b=json_bytes(obj); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def body(self):
        n=int(self.headers.get('Content-Length','0') or 0); return json.loads(self.rfile.read(n).decode('utf-8') or '{}') if n else {}
    def do_OPTIONS(self): self.send_response(204); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS'); self.send_header('Access-Control-Allow-Headers','Content-Type,Authorization'); self.end_headers()
    def do_GET(self):
        u=urllib.parse.urlparse(self.path); q=urllib.parse.parse_qs(u.query); path=u.path
        try:
            if path=='/local-api/health': return self.sendj(200,{'ok':True,'mode':'local-workstation','time':now(),'database':str(DB.name)})
            if path=='/local-api/version':
                v=json.loads(VERSION_FILE.read_text(encoding='utf-8')) if VERSION_FILE.exists() else {}; return self.sendj(200,{'ok':True,'version':v})
            if path=='/local-api/diagnostics':
                with db() as c: integrity=c.execute('PRAGMA integrity_check').fetchone()[0]
                return self.sendj(200,{'ok':integrity=='ok','python':sys.version.split()[0],'sqlite':sqlite3.sqlite_version,'db_integrity':integrity,'disk_free_gb':round(shutil.disk_usage(ROOT).free/1024**3,2),'directories':{x.name:x.exists() for x in (DATA,CONFIG,CACHE,PROJECTS,REPORTS,LOGS,BACKUP)},'time':now()})
            if path=='/local-api/projects':
                with db() as c: rows=c.execute("SELECT id,name,created_at,updated_at FROM projects ORDER BY updated_at DESC").fetchall()
                return self.sendj(200,{'ok':True,'projects':[dict(zip(('id','name','created_at','updated_at'),r)) for r in rows]})
            if path.startswith('/local-api/projects/'):
                pid=path.rsplit('/',1)[1]
                with db() as c: row=c.execute("SELECT id,name,payload,created_at,updated_at FROM projects WHERE id=?",(pid,)).fetchone()
                return self.sendj(404,{'ok':False,'message':'项目不存在'}) if not row else self.sendj(200,{'ok':True,'project':{'id':row[0],'name':row[1],'payload':json.loads(row[2]),'created_at':row[3],'updated_at':row[4]}})
            if path=='/local-api/cache/status':
                with db() as c: n=c.execute('SELECT count(*) FROM cache').fetchone()[0]
                return self.sendj(200,{'ok':True,'entries':n})
            if path=='/local-api/environment' or path=='/api/environment':
                lat=valid_coord(q.get('latitude',[''])[0],-90,90); lon=valid_coord(q.get('longitude',[''])[0],-180,180); start=q.get('start_date',[''])[0]; end=q.get('end_date',[''])[0]
                if lat is None or lon is None or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',start) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',end): return self.sendj(400,{'error':True,'message':'Invalid latitude, longitude or date range'})
                key=cache_key(lat,lon,start,end); cached=get_cached(key)
                hourly='temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,shortwave_radiation,surface_pressure,cloud_cover'; daily='temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum'
                qs=urllib.parse.urlencode({'latitude':lat,'longitude':lon,'start_date':start,'end_date':end,'hourly':hourly,'daily':daily,'timezone':'auto','models':'era5','wind_speed_unit':'ms'},safe=',')
                try:
                    data=fetch_json('https://archive-api.open-meteo.com/v1/archive?'+qs,25); payload={'ok':True,'source':'ERA5 via Open-Meteo Historical Weather API','model':'ERA5','resolution':'0.25° (~25 km)','temporal_resolution':'hourly','start_date':start,'end_date':end,'queried_at':now(),'cache':'live','data':data}; put_cache(key,payload,payload['source']); return self.sendj(200,payload)
                except Exception as e:
                    if cached:
                        p=cached['payload']; p['cache']='cached'; p['cache_updated_at']=cached['updated_at']; p['upstream_error']=str(e); return self.sendj(200,p)
                    return self.sendj(502,{'error':True,'message':'数据源暂不可用','detail':str(e),'source':'ERA5 via Open-Meteo'})
            if path=='/local-api/cloud-config/latest':
                try:return self.sendj(200,fetch_json(REMOTE_CONFIG_BASE+'/config/latest',12))
                except Exception as e:return self.sendj(503,{'ok':False,'message':'中央参数服务暂不可用','detail':str(e)})
            return super().do_GET()
        except Exception as e: log('ERROR',traceback.format_exc()); return self.sendj(500,{'ok':False,'message':str(e)})
    def do_POST(self):
        path=urllib.parse.urlparse(self.path).path
        try:
            data=self.body()
            if path=='/local-api/projects':
                pid=str(data.get('id') or f"PRJ-{datetime.now().strftime('%Y%m%d%H%M%S')}"); name=str(data.get('name') or pid)[:200]; payload=data.get('payload',data); ts=now()
                with db() as c:
                    old=c.execute('SELECT created_at FROM projects WHERE id=?',(pid,)).fetchone(); created=old[0] if old else ts
                    c.execute('INSERT OR REPLACE INTO projects(id,name,payload,created_at,updated_at) VALUES(?,?,?,?,?)',(pid,name,json.dumps(payload,ensure_ascii=False),created,ts))
                return self.sendj(200,{'ok':True,'id':pid,'updated_at':ts})
            if path=='/local-api/calculations':
                cid=str(data.get('id') or f"GEA-{datetime.now().strftime('%Y%m%d-%H%M%S')}");
                with db() as c:c.execute('INSERT OR REPLACE INTO calculations(id,project_id,payload,created_at) VALUES(?,?,?,?)',(cid,data.get('project_id'),json.dumps(data,ensure_ascii=False),now()))
                return self.sendj(200,{'ok':True,'calculation_id':cid})
            if path=='/local-api/backup': return self.sendj(200,{'ok':True,'file':str(backup_all().relative_to(ROOT))})
            return self.sendj(404,{'ok':False,'message':'Unknown local API'})
        except Exception as e: log('ERROR',traceback.format_exc()); return self.sendj(500,{'ok':False,'message':str(e)})

def main():
    os.chdir(ROOT); port=int(os.environ.get('GE_PORT','8080')); host='127.0.0.1';
    while port<=8090:
        try: httpd=ThreadingHTTPServer((host,port),Handler); break
        except OSError: port+=1
    else: raise SystemExit('8080-8090 均被占用')
    PID.write_text(str(os.getpid()),encoding='ascii'); (ROOT/'.local_server.port').write_text(str(port),encoding='ascii')
    log('START',f'http://{host}:{port}');
    try:httpd.serve_forever()
    finally:
        try:PID.unlink(missing_ok=True)
        except:pass
if __name__=='__main__': main()
