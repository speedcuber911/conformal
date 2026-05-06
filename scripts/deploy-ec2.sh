#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-dcmshriram}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/ubuntu/partner-apps/${APP_NAME}}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.dcmshriram.yml}"

cd "$DEPLOY_PATH"

if [ -f /etc/leap.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /etc/leap.env
  set +a
fi

docker compose -f "$COMPOSE_FILE" build app
docker compose -f "$COMPOSE_FILE" up -d app

for attempt in $(seq 1 20); do
  if docker exec cut-nginx wget -qO- http://partner-dcmshriram:3000/api/health >/dev/null; then
    break
  fi

  if [ "$attempt" -eq 20 ]; then
    docker logs --tail=80 partner-dcmshriram
    exit 1
  fi

  sleep 2
done

docker exec cut-nginx nginx -t
docker exec cut-nginx nginx -s reload
