#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-conformal}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/ubuntu/partner-apps/${APP_NAME}}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.conformal.yml}"
NGINX_CONTAINER="${NGINX_CONTAINER:-cut-nginx}"

cd "$DEPLOY_PATH"

if [ -f /etc/conformal.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /etc/conformal.env
  set +a
fi

docker compose -f "$COMPOSE_FILE" build app
docker compose -f "$COMPOSE_FILE" up -d app

for attempt in $(seq 1 20); do
  if docker exec "$NGINX_CONTAINER" wget -qO- http://conformal-live:3000/api/health >/dev/null; then
    break
  fi

  if [ "$attempt" -eq 20 ]; then
    docker logs --tail=80 conformal-live
    exit 1
  fi

  sleep 2
done

docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
