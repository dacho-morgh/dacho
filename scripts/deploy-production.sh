#!/usr/bin/env bash
set -Eeuo pipefail

# Runs on the VPS after CI publishes both immutable SHA images. The VPS never
# builds source; its existing Docker login supplies GHCR read access.
repo_dir="${DACHO_REPO_DIR:-/home/ubuntu/dev/dacho}"
frontend_image=ghcr.io/dacho-morgh/dacho/frontend
backend_image=ghcr.io/dacho-morgh/dacho/backend
installed_script="${HOME}/.local/bin/dacho-deploy-production"
failure_marker="${HOME}/.dacho-deploy-failed"
maintenance_dir="${DACHO_MAINTENANCE_DIR:-/var/lib/dacho-maintenance}"

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
      log "Ready: ${url}"
      return 0
    fi
    if (( attempt == 1 || attempt % 5 == 0 )); then
      log "Waiting for ${url} (${attempt}/40)"
    fi
    sleep 3
  done
  log "Readiness check failed: ${url}; recent container output follows"
  case "$url" in
    *:3000/*) docker logs --tail 80 dacho-frontend-1 2>&1 || true ;;
    *:4000/*) docker logs --tail 80 dacho-backend-1 2>&1 || true ;;
  esac
  return 1
}

sync_installed_script() {
  local next="${installed_script}.next"
  # An installed update page must not be disabled by an older main checkout.
  if ! grep -Fq 'start_maintenance()' scripts/deploy-production.sh; then
    log 'Keeping the installed deploy script until main includes maintenance support'
    return 0
  fi
  install -m 0755 scripts/deploy-production.sh "$next"
  mv -f -- "$next" "$installed_script"
}

start_maintenance() {
  [[ -d "$maintenance_dir" && -w "$maintenance_dir" ]] || die 'Maintenance state directory is unavailable'
  curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:9080/update/status \
    || die 'Maintenance server is unavailable; refusing to stop the website'
  : >"${maintenance_dir}/deploy.log"
  exec > >(tee -a "${maintenance_dir}/deploy.log") 2>&1
  touch "${maintenance_dir}/active"
  log 'Update page enabled; deployment logs are available at /update/logs'
}

finish_maintenance() {
  [[ -f "${maintenance_dir}/active" ]] || return 0
  if curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:3000/ \
    && curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:4000/health; then
    rm -f -- "${maintenance_dir}/active"
    log 'Both services are healthy; the website is available again'
  else
    log 'A service is unavailable; keeping the update page visible'
  fi
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
  finish_maintenance
  exit 0
fi

if [[ "$old_tag" == "$target_tag" ]]; then
  start_maintenance
  trap 'status=$?; finish_maintenance; exit "$status"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  log "Repairing containers for ${target_tag}"
  docker pull "${frontend_image}:${target_tag}"
  docker pull "${backend_image}:${target_tag}"
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
  finish_maintenance
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
    docker image inspect "$old_frontend" >/dev/null 2>&1 || docker pull "$old_frontend"
    docker compose -f docker-compose.prod.yml up -d --no-deps frontend
    wait_for_http http://127.0.0.1:3000/
    docker image inspect "$old_backend" >/dev/null 2>&1 || docker pull "$old_backend"
    docker compose -f docker-compose.prod.yml up -d --no-deps backend
    wait_for_http http://127.0.0.1:4000/health
    log "Rollback attempted; check the services and journal"
  fi
  finish_maintenance
  exit "$status"
}
trap 'rollback $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_maintenance
log "Deploying ${target_tag}"
docker pull "$new_backend"
[[ "$(docker image inspect "$new_backend" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" == "$target_sha" ]] \
  || die 'Backend image revision does not match main'

git merge --ff-only origin/main >/dev/null
rollback_armed=1
printf '%s\n' "$target_sha" >"$failure_marker"
docker compose -f docker-compose.prod.yml config -q

# Keep the update page visible while making space for the replacement image.
# Verify the rollback image is available before removing the running frontend.
if [[ -n "$old_frontend_id" ]]; then
  docker manifest inspect "$old_frontend" >/dev/null \
    || die 'Previous frontend image is unavailable for rollback'
  log 'Freeing the old frontend image before pulling the new one'
  docker compose -f docker-compose.prod.yml stop frontend
  docker compose -f docker-compose.prod.yml rm -f frontend
  docker image rm -f "$old_frontend_id" >/dev/null
fi

docker pull "$new_frontend"
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
finish_maintenance
