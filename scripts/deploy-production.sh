#!/usr/bin/env bash
set -Eeuo pipefail

# Runs on the VPS after CI publishes both immutable SHA images. The VPS never
# builds source; its existing Docker login supplies GHCR read access.
repo_dir="${DACHO_REPO_DIR:-/home/ubuntu/dev/dacho}"
frontend_image=ghcr.io/dacho-morgh/dacho/frontend
backend_image=ghcr.io/dacho-morgh/dacho/backend
installed_script="${HOME}/.local/bin/dacho-deploy-production"
failure_marker="${HOME}/.dacho-deploy-failed"

log() { printf '[dacho-cd] %s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

cd "$repo_dir"
exec 9>"${HOME}/.dacho-deploy.lock"
flock -n 9 || exit 0

read_tag() {
  sed -n 's/^IMAGE_TAG=//p' .env
}

write_tag() {
  local tag="$1" tmp
  tmp="$(mktemp .env.deploy.XXXXXX)"
  if ! sed "s/^IMAGE_TAG=.*/IMAGE_TAG=${tag}/" .env >"$tmp" \
    || ! grep -Fxq "IMAGE_TAG=${tag}" "$tmp" \
    || [[ "$(wc -c <"$tmp")" -lt 100 ]]; then
    rm -f -- "$tmp"
    return 1
  fi
  chmod --reference=.env "$tmp"
  mv -f -- "$tmp" .env
}

wait_for_http() {
  local url="$1" attempt
  for attempt in {1..40}; do
    if curl -fsS --max-time 10 -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    sleep 3
  done
  return 1
}

sync_installed_script() {
  local next="${installed_script}.next"
  install -m 0755 scripts/deploy-production.sh "$next"
  mv -f -- "$next" "$installed_script"
}

[[ -f .env && -f docker-compose.prod.yml ]] || die 'Production configuration is missing'
[[ -z "$(git status --porcelain)" ]] || die 'Server checkout has local changes'

git fetch --quiet origin main
target_sha="$(git rev-parse origin/main)"
target_tag="sha-${target_sha:0:7}"
old_tag="$(read_tag)"
[[ "$old_tag" =~ ^sha-[0-9a-f]{7,40}$ ]] || die 'IMAGE_TAG must pin an immutable SHA tag'

if [[ "${1:-}" == '--check' ]]; then
  log "Current: ${old_tag}; target: ${target_tag}"
  for image in "$frontend_image" "$backend_image"; do
    if docker manifest inspect "${image}:${target_tag}" >/dev/null 2>&1; then
      log "Ready: ${image}:${target_tag}"
    else
      log "Waiting: ${image}:${target_tag}"
    fi
  done
  exit 0
fi

for image in "$frontend_image" "$backend_image"; do
  if ! docker manifest inspect "${image}:${target_tag}" >/dev/null 2>&1; then
    log "CI is still publishing ${image}:${target_tag}"
    exit 0
  fi
done

running_revision() {
  docker inspect "$1" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' 2>/dev/null || true
}

if [[ "$old_tag" == "$target_tag" ]] \
  && [[ "$(running_revision dacho-frontend-1)" == "$target_sha" ]] \
  && [[ "$(running_revision dacho-backend-1)" == "$target_sha" ]]; then
  git merge --ff-only origin/main >/dev/null
  sync_installed_script
  rm -f -- "$failure_marker"
  log "Already running ${target_tag}"
  exit 0
fi

if [[ "$old_tag" == "$target_tag" ]]; then
  log "Repairing containers for ${target_tag}"
  docker pull -q "${frontend_image}:${target_tag}" >/dev/null
  docker pull -q "${backend_image}:${target_tag}" >/dev/null
  git merge --ff-only origin/main >/dev/null
  docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate frontend
  wait_for_http http://127.0.0.1:3000/ || die 'Frontend did not become ready'
  docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
  wait_for_http http://127.0.0.1:4000/health || die 'Backend did not become ready'
  [[ "$(running_revision dacho-frontend-1)" == "$target_sha" ]] || die 'Frontend is running the wrong image'
  [[ "$(running_revision dacho-backend-1)" == "$target_sha" ]] || die 'Backend is running the wrong image'
  sync_installed_script
  rm -f -- "$failure_marker"
  log "Repaired ${target_tag}"
  exit 0
fi

# A failed release can require pulling the old image back from GHCR. Avoid
# repeating that outage every two minutes while retaining automatic retries.
if [[ -f "$failure_marker" ]] \
  && [[ "$(cat "$failure_marker")" == "$target_sha" ]] \
  && (( $(date +%s) - $(stat -c %Y "$failure_marker") < 1800 )) \
  && curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
  log "Waiting 30 minutes before retrying failed release ${target_tag}"
  exit 0
fi

old_head="$(git rev-parse HEAD)"
old_frontend="${frontend_image}:${old_tag}"
old_backend="${backend_image}:${old_tag}"
new_frontend="${frontend_image}:${target_tag}"
new_backend="${backend_image}:${target_tag}"
old_frontend_id="$(docker image inspect "$old_frontend" --format '{{.Id}}' 2>/dev/null || true)"
old_backend_id="$(docker image inspect "$old_backend" --format '{{.Id}}')"

rollback_armed=0
rollback() {
  local status="$1"
  trap - EXIT INT TERM
  set +e
  if [[ "$rollback_armed" == 1 ]]; then
    log "Deployment failed; restoring ${old_tag}"
    docker compose -f docker-compose.prod.yml stop frontend >/dev/null 2>&1
    docker compose -f docker-compose.prod.yml rm -f frontend >/dev/null 2>&1
    docker image rm -f "$new_frontend" >/dev/null 2>&1
    docker image prune -f >/dev/null 2>&1
    git reset --hard "$old_head" >/dev/null
    write_tag "$old_tag"
    docker image inspect "$old_frontend" >/dev/null 2>&1 || docker pull -q "$old_frontend"
    docker compose -f docker-compose.prod.yml up -d --no-deps frontend
    wait_for_http http://127.0.0.1:3000/
    docker image inspect "$old_backend" >/dev/null 2>&1 || docker pull -q "$old_backend"
    docker compose -f docker-compose.prod.yml up -d --no-deps backend
    wait_for_http http://127.0.0.1:4000/health
    log "Rollback attempted; check the services and journal"
  fi
  exit "$status"
}
trap 'rollback $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log "Deploying ${target_tag}"
docker pull -q "$new_backend" >/dev/null
[[ "$(docker image inspect "$new_backend" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" == "$target_sha" ]] \
  || die 'Backend image revision does not match main'

git merge --ff-only origin/main >/dev/null
rollback_armed=1
printf '%s\n' "$target_sha" >"$failure_marker"
docker compose -f docker-compose.prod.yml config -q

# The VPS cannot hold two 5 GB frontend images. When space is tight, remove
# the old frontend after verifying that its immutable tag can be pulled again.
free_bytes="$(df -B1 --output=avail / | tail -n 1 | tr -d ' ')"
old_size="$(docker image inspect "$old_frontend" --format '{{.Size}}' 2>/dev/null || echo 0)"
if [[ -n "$old_frontend_id" ]] && (( free_bytes < old_size + 1073741824 )); then
  log 'Freeing the old frontend image before pulling the new one'
  docker compose -f docker-compose.prod.yml stop frontend
  docker compose -f docker-compose.prod.yml rm -f frontend
  docker image rm -f "$old_frontend_id" >/dev/null
fi

docker pull -q "$new_frontend" >/dev/null
[[ "$(docker image inspect "$new_frontend" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" == "$target_sha" ]] \
  || die 'Frontend image revision does not match main'

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
write_tag "$target_tag"
docker compose -f docker-compose.prod.yml up -d --no-deps frontend
wait_for_http http://127.0.0.1:3000/ || die 'Frontend did not become ready'
if docker logs --since "$started_at" dacho-frontend-1 2>&1 | grep -Fq 'Migration skipped'; then
  die 'Frontend migration reported a failure'
fi
[[ "$(running_revision dacho-frontend-1)" == "$target_sha" ]] || die 'Frontend is running the wrong image'

docker compose -f docker-compose.prod.yml up -d --no-deps backend
wait_for_http http://127.0.0.1:4000/health || die 'Backend did not become ready'
[[ "$(running_revision dacho-backend-1)" == "$target_sha" ]] || die 'Backend is running the wrong image'

rollback_armed=0
trap - EXIT INT TERM
sync_installed_script
docker image rm -f "$old_frontend_id" "$old_backend_id" >/dev/null 2>&1 || true
rm -f -- "$failure_marker"
log "Deployed ${target_tag}"
