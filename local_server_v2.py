#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Enhanced localhost entrypoint.
Adds a same-origin relay for the existing V2.9 central parameter API, while
reusing the stable local_server.py workstation implementation.
"""
from __future__ import annotations

import json
import os
import traceback
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import local_server as core

ALLOWED_CLOUD_ROUTES = {
    ("GET", "/config/latest"),
    ("GET", "/config/history"),
    ("POST", "/auth/login"),
    ("POST", "/config/publish"),
}
MAX_CLOUD_BODY = 2_000_000


def _relay_headers(handler):
    headers = {
        "Accept": "application/json",
        "User-Agent": "GlobalEnvironmentPlatform-Local/3.1",
    }
    content_type = handler.headers.get("Content-Type")
    if content_type:
        headers["Content-Type"] = content_type
    auth = handler.headers.get("Authorization")
    if auth:
        headers["Authorization"] = auth
    return headers


class Handler(core.Handler):
    server_version = "GEPlatformLocal/3.1"

    def relay_cloud(self, method, parsed):
        prefix = "/local-api/cloud-config"
        suffix = parsed.path[len(prefix):] or "/"
        if (method, suffix) not in ALLOWED_CLOUD_ROUTES:
            return self.sendj(404, {"ok": False, "message": "Unsupported central config route"})

        upstream = core.REMOTE_CONFIG_BASE + suffix
        if parsed.query:
            upstream += "?" + parsed.query

        data = None
        if method == "POST":
            n = int(self.headers.get("Content-Length", "0") or 0)
            if n > MAX_CLOUD_BODY:
                return self.sendj(413, {"ok": False, "message": "请求数据过大"})
            data = self.rfile.read(n) if n else b"{}"

        req = urllib.request.Request(
            upstream,
            data=data,
            method=method,
            headers=_relay_headers(self),
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                status = resp.status
                body = resp.read(MAX_CLOUD_BODY)
                content_type = resp.headers.get("Content-Type", "application/json; charset=utf-8")
        except urllib.error.HTTPError as e:
            status = e.code
            body = e.read(MAX_CLOUD_BODY)
            content_type = e.headers.get("Content-Type", "application/json; charset=utf-8")
        except Exception as e:
            core.audit("cloud_proxy_error", {"route": suffix, "method": method, "error": str(e)})
            return self.sendj(503, {
                "ok": False,
                "message": "中央参数服务暂不可用",
                "detail": str(e),
            })

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-GE-Cloud-Proxy", "localhost")
        self.end_headers()
        self.wfile.write(body)
        core.audit("cloud_proxy", {"route": suffix, "method": method, "status": status})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/local-api/cloud-config/"):
            try:
                return self.relay_cloud("GET", parsed)
            except Exception as e:
                core.log("ERROR", traceback.format_exc())
                return self.sendj(500, {"ok": False, "message": str(e)})
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/local-api/cloud-config/"):
            try:
                return self.relay_cloud("POST", parsed)
            except Exception as e:
                core.log("ERROR", traceback.format_exc())
                return self.sendj(500, {"ok": False, "message": str(e)})
        return super().do_POST()


def main():
    os.chdir(core.ROOT)
    requested = int(os.environ.get("GE_PORT", "8080"))
    port = requested
    host = "127.0.0.1"
    while port <= max(8090, requested + 10):
        try:
            httpd = ThreadingHTTPServer((host, port), Handler)
            break
        except OSError:
            port += 1
    else:
        raise SystemExit(f"{requested}-{max(8090, requested + 10)} 均被占用")

    core.PID.write_text(str(os.getpid()), encoding="ascii")
    core.PORT_FILE.write_text(str(port), encoding="ascii")
    core.audit("server_start", {"pid": os.getpid(), "port": port, "entrypoint": "local_server_v2.py"})
    core.log("START", f"http://{host}:{port}")
    try:
        httpd.serve_forever()
    finally:
        core.audit("server_stop", {"pid": os.getpid(), "port": port, "entrypoint": "local_server_v2.py"})
        try:
            core.PID.unlink(missing_ok=True)
            core.PORT_FILE.unlink(missing_ok=True)
        except Exception:
            pass


if __name__ == "__main__":
    main()
