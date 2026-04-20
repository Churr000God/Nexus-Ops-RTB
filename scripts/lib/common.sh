#!/usr/bin/env bash
set -euo pipefail

log() { printf "[INFO] %s\n" "$*"; }
ok() { printf "[ OK ] %s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*" >&2; }
err() { printf "[ERR ] %s\n" "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || err "Falta dependencia: $1"
}

require_env_file() {
  [[ -f .env ]] || err "No existe .env. Copia .env.example y completa variables."
}

env_get() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep -E "^${key}=" .env 2>/dev/null | tail -n 1 | cut -d'=' -f2- || true)"
  if [[ -n "$value" ]]; then
    printf "%s\n" "$value"
  else
    printf "%s\n" "$default"
  fi
}

compose_files() {
  local mode="${1:-dev}"
  if [[ "$mode" == "prod" || "$mode" == "production" ]]; then
    echo "-f docker-compose.yml -f docker-compose.prod.yml"
  else
    echo "-f docker-compose.yml"
  fi
}

compose_cmd() {
  local mode="${1:-dev}"
  shift || true
  local files
  files="$(compose_files "$mode")"
  # shellcheck disable=SC2086
  docker compose $files "$@"
}

postgres_service_name() {
  echo "postgres"
}

wait_for_postgres() {
  local mode="${1:-dev}"
  local timeout="${2:-60}"
  local elapsed=0
  local db_name db_user
  db_name="$(env_get POSTGRES_DB nexus_ops)"
  db_user="$(env_get POSTGRES_USER nexus)"
  local service
  service="$(postgres_service_name)"

  while (( elapsed < timeout )); do
    if compose_cmd "$mode" exec -T "$service" pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
      ok "PostgreSQL disponible."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  err "PostgreSQL no estuvo disponible en ${timeout}s."
}

