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

# Espera a que Supabase (o cualquier PostgreSQL externo) acepte conexiones.
# Uso: wait_for_supabase HOST USER PASS DB [TIMEOUT_SECS]
wait_for_supabase() {
  local host="$1"
  local user="$2"
  local pass="$3"
  local db="${4:-postgres}"
  local timeout="${5:-60}"
  local elapsed=0

  local port
  port="$(grep -E "^SUPABASE_PORT=" .env 2>/dev/null | tail -n1 | cut -d= -f2- || echo 6543)"

  while (( elapsed < timeout )); do
    if PGPASSWORD="$pass" psql -h "$host" -p "$port" -U "$user" -d "$db" \
        -c "SELECT 1" >/dev/null 2>&1; then
      ok "Supabase disponible ($host)."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  err "No se pudo conectar a Supabase ($host) en ${timeout}s."
}
