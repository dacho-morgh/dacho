#!/usr/bin/env python3
"""Keep the update page and authenticated deploy logs outside Docker."""

import base64
import binascii
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen

USERNAME = "admin"
PASSWORD = "S@jjaddgadmin"
ASSETS = Path(__file__).resolve().parent
STATE = Path(os.environ.get("DACHO_MAINTENANCE_DIR", "/var/lib/dacho-maintenance"))
LOG_LIMIT = 256 * 1024


def services_ready():
    for url in ("http://127.0.0.1:3000/", "http://127.0.0.1:4000/health"):
        try:
            with urlopen(url, timeout=2) as response:
                if response.status != 200:
                    return False
        except (URLError, OSError):
            return False
    return True


def deploy_logs():
    try:
        with (STATE / "deploy.log").open("rb") as log:
            log.seek(0, 2)
            log.seek(max(0, log.tell() - LOG_LIMIT))
            text = log.read().decode("utf-8", errors="replace")
    except FileNotFoundError:
        text = "Waiting for the next deployment.\n"
    return text.replace(PASSWORD, "<REDACTED>")


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, content_type, headers=None):
        body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def authenticated(self):
        scheme, _, token = self.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "basic":
            return False
        try:
            decoded = base64.b64decode(token, validate=True)
        except (ValueError, binascii.Error):
            return False
        return hmac.compare_digest(decoded, f"{USERNAME}:{PASSWORD}".encode())

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/update/logs" or path.startswith("/update/logs/"):
            if not self.authenticated():
                self.reply(401, "Login required.\n", "text/plain; charset=utf-8", {
                    "WWW-Authenticate": 'Basic realm="Dacho deployment logs", charset="UTF-8"',
                })
                return
            if path == "/update/logs/data":
                self.reply(200, deploy_logs(), "text/plain; charset=utf-8")
            elif path in ("/update/logs", "/update/logs/"):
                self.reply(200, (ASSETS / "logs.html").read_text(encoding="utf-8"),
                           "text/html; charset=utf-8")
            else:
                self.reply(404, "Not found.\n", "text/plain; charset=utf-8")
            return
        if path == "/update/status":
            active = (STATE / "active").exists()
            self.reply(200, json.dumps({"active": active, "ready": not active and services_ready()}),
                       "application/json")
            return
        self.reply(200 if path in ("/update", "/update/") else 503,
                   (ASSETS / "maintenance.html").read_text(encoding="utf-8"),
                   "text/html; charset=utf-8", {"Retry-After": "30"})

    do_HEAD = do_GET

    def log_message(self, *_args):
        # Request URLs and credentials do not belong in the deployment log.
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("DACHO_MAINTENANCE_PORT", "9080"))),
                        Handler).serve_forever()
