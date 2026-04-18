#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh

require docker

if [[ ! -f .env ]]; then
  cp .env.example .env
  warn "Se copió .env.example → .env. Ajusta valores antes de continuar si aplica."
fi

mkdir -p automations/n8n_data automations/n8n_flows data/csv data/reports docker/nginx/certs

docker compose up -d postgres redis
docker compose build
docker compose up -d

ok "Entorno inicializado. Proxy: http://localhost"

