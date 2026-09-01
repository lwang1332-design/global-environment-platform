#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stdlib smoke tests for the Windows local workstation server."""
from __future__ import annotations
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT_FILE = ROOT / ".local_server.port"
PASS = 0
FAIL = 0
WARN = 0

def request(path, method="GET", body=None, expected=(200,)):
    if not PORT_FILE.exists():
        raise RuntimeError(".local_server.port not found; start local_server.py first")
    port = PORT_FILE.read_text(encoding="ascii").strip()
    url = f"http://127.0.0.1:{port}{path}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            status = r.status
            raw = r.read()
            headers = dict(r.headers.items())
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read()
        headers = dict(e.headers.items())
    if status not in expected:
        raise AssertionError(f"{method} {path}: expected {expected}, got {status}: {raw[:300]!r}")
    ct = headers.get("Content-Type", "")
    if "application/json" in ct:
        return status, json.loads(raw.decode("utf-8")), headers
    return status, raw, headers

def check(name, fn):
    global PASS, FAIL
    try:
        fn()
        PASS += 1
        print(f"PASS  {name}")
    except Exception as e:
        FAIL += 1
        print(f"FAIL  {name}: {e}")

def warn(name, message):
    global WARN
    WARN += 1
    print(f"WARN  {name}: {message}")

def main():
    stamp = int(time.time())
    pid = f"PRJ-SMOKE-{stamp}"

    check("health", lambda: (
        (lambda x: (_ for _ in ()).throw(AssertionError(x)) if not x.get("ok") else None)(
            request("/local-api/health")[1]
        )
    ))

    def diag():
        j = request("/local-api/diagnostics")[1]
        assert j["ok"] is True
        assert j["db_integrity"] == "ok"
        assert all(j["directories"].values())
    check("diagnostics/sqlite/directories", diag)

    def version():
        j = request("/local-api/version")[1]
        assert j["version"].get("platform_version")
        assert j["version"].get("model_version")
    check("version metadata", version)

    check("homepage", lambda: (
        (lambda x: (_ for _ in ()).throw(AssertionError("index.html empty")) if len(x) < 1000 else None)(
            request("/")[1]
        )
    ))
    check("local workstation JS", lambda: request("/assets/local-workstation.js"))
    check("local workstation CSS", lambda: request("/assets/local-workstation.css"))
    check("runtime localhost bootstrap", lambda: (
        (lambda b: (_ for _ in ()).throw(AssertionError("local-api/openmeteo hook missing"))
         if b"local-api/openmeteo" not in b else None)(request("/assets/v29-runtime-config.js")[1])
    ))

    def save_project():
        j = request("/local-api/projects", "POST", {
            "id": pid,
            "name": "Smoke三亚",
            "payload": {
                "schema": "GE-LOCAL-PROJECT-1",
                "current": {"name": "Smoke三亚", "lat": 18.2528, "lon": 109.5119},
                "versions": {"model": "V2.9-compatible"},
                "result": {"severity": 42}
            }
        })[1]
        assert j["ok"] and j["id"] == pid
    check("project save", save_project)

    def read_project():
        j = request("/local-api/projects/" + urllib.parse.quote(pid))[1]
        assert j["project"]["name"] == "Smoke三亚"
        assert j["project"]["payload"]["current"]["lat"] == 18.2528
    check("project open/read", read_project)

    def list_project():
        j = request("/local-api/projects")[1]
        assert any(x["id"] == pid for x in j["projects"])
    check("project list", list_project)

    calc_id = []
    def save_calc():
        j = request("/local-api/calculations", "POST", {
            "project_id": pid, "project_name": "Smoke三亚",
            "coordinate": {"latitude": 18.2528, "longitude": 109.5119},
            "severity": 42, "adapt": 85, "gap": 0
        })[1]
        assert j["calculation_id"].startswith("GEA-")
        calc_id.append(j["calculation_id"])
    check("calculation id", save_calc)

    def list_calc():
        j = request("/local-api/calculations?limit=20")[1]
        assert any(x["id"] == calc_id[0] for x in j["calculations"])
    check("calculation trace list", list_calc)

    def backup():
        j = request("/local-api/backup", "POST", {})[1]
        assert j["ok"]
        assert (ROOT / j["file"]).exists()
    check("backup zip", backup)

    def source_status():
        j = request("/local-api/sources?latitude=18.2528&longitude=109.5119")[1]
        assert len(j["sources"]) >= 5
        assert all("ok" in x and "latency_ms" in x for x in j["sources"])
        good = [x["name"] for x in j["sources"] if x["ok"]]
        if os.environ.get("REQUIRE_LIVE_DATA") == "1":
            assert good, "no external live data source reachable"
        elif not good:
            warn("live sources", "all external sources unavailable; offline-safe structure still passed")
    check("data-source health structure", source_status)

    def offline_miss():
        status, j, h = request(
            "/local-api/openmeteo?_kind=elevation&_offline=1&latitude=-89.99999&longitude=-179.99999",
            expected=(200, 503)
        )
        if status == 503:
            assert j.get("reason") == "离线且本地无缓存"
            assert h.get("X-GE-Cache-Mode") == "miss"
        else:
            assert h.get("X-GE-Cache-Mode") == "cached"
    check("offline cache/miss deterministic", offline_miss)

    def delete_project():
        j = request("/local-api/projects/" + urllib.parse.quote(pid), "DELETE")[1]
        assert j["ok"] and j["deleted"] is True
        j2 = request("/local-api/projects")[1]
        assert not any(x["id"] == pid for x in j2["projects"])
    check("project delete", delete_project)

    print()
    print(f"TOTAL={PASS+FAIL} PASS={PASS} FAIL={FAIL} WARN={WARN}")
    return 1 if FAIL else 0

if __name__ == "__main__":
    raise SystemExit(main())
