#!/usr/bin/env bash
set -Eeuo pipefail

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
caddy_file=/etc/caddy/Caddyfile
candidate=/etc/caddy/Caddyfile.dacho-next

sudo install -d -m 0755 /usr/local/lib/dacho-maintenance /etc/caddy/snippets
sudo install -m 0644 "$source_dir"/deploy/maintenance/{server.py,maintenance.html,logs.html} /usr/local/lib/dacho-maintenance/
sudo install -m 0644 "$source_dir/deploy/systemd/dacho-maintenance.service" /etc/systemd/system/
sudo install -m 0644 "$source_dir/deploy/caddy/maintenance.caddy" /etc/caddy/snippets/dacho-maintenance.caddy
sudo systemctl daemon-reload
sudo systemctl enable --now dacho-maintenance.service
sudo systemctl restart dacho-maintenance.service
curl -fsS --retry 5 --retry-delay 1 --retry-connrefused --max-time 5 \
  -o /dev/null http://127.0.0.1:9080/update

# Preserve unrelated Caddy settings and validate the replacement before reload.
sudo python3 - "$caddy_file" "$candidate" <<'PY'
import pathlib
import re
import sys

source = pathlib.Path(sys.argv[1]).read_text()
if "import dacho_maintenance" not in source:
    source, count = re.subn(r"(?m)^([ \t]*)reverse_proxy 127\.0\.0\.1:3000[ \t]*$",
                            r"\1import dacho_maintenance", source)
    if count != 1:
        raise SystemExit("Expected one Dacho frontend proxy; configure the maintenance snippet manually")
include = "import /etc/caddy/snippets/dacho-maintenance.caddy"
if include not in source:
    source = include + "\n\n" + source
pathlib.Path(sys.argv[2]).write_text(source)
PY
sudo caddy validate --config "$candidate" --adapter caddyfile
if [[ ! -f "${caddy_file}.before-maintenance" ]]; then
  sudo cp -p "$caddy_file" "${caddy_file}.before-maintenance"
fi
sudo install -m 0644 "$candidate" "$caddy_file"
sudo systemctl reload caddy
sudo rm -f -- "$candidate"
printf 'Maintenance preview: /update\nProtected deployment logs: /update/logs\n'
