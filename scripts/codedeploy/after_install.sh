#!/usr/bin/env bash
# =============================================================================
# after_install.sh — CodeDeploy: corre DESPUÉS de copiar los nuevos archivos.
# - Enlaza el .env (almacenado fuera del directorio de deploy en el servidor)
# - Crea directorios de datos necesarios
# - Fija permisos
#
# PRE-REQUISITO EN EC2:
#   El archivo /home/ec2-user/.nexus-ops-rtb.env debe existir con todas las
#   variables de entorno del proyecto. Generarlo manualmente la primera vez:
#     sudo cp /ruta/a/tu.env /home/ec2-user/.nexus-ops-rtb.env
#     sudo chmod 600 /home/ec2-user/.nexus-ops-rtb.env
#   O cargarlo desde AWS SSM Parameter Store.
# =============================================================================
set -euo pipefail

APP_DIR=/home/ec2-user/nexus-ops-rtb
ENV_VAULT=/home/ec2-user/.nexus-ops-rtb.env

log() { echo "[after_install] $*"; }
err() { echo "[after_install] ERROR: $*" >&2; exit 1; }

log "Iniciando post-instalación..."

# --- .env ---
if [[ -f "$ENV_VAULT" ]]; then
  cp "$ENV_VAULT" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  log ".env copiado desde $ENV_VAULT"
elif [[ -f "$APP_DIR/.env" ]]; then
  log ".env ya presente en $APP_DIR (se conserva el existente)"
else
  err "No se encontró .env. Crea $ENV_VAULT en el servidor antes del deploy."
fi

# --- Directorios de datos persistentes ---
mkdir -p \
  "$APP_DIR/data/backups" \
  "$APP_DIR/data/logs" \
  "$APP_DIR/data/csv" \
  "$APP_DIR/data/reports"

# --- Permisos ---
chown -R ec2-user:ec2-user "$APP_DIR"
find "$APP_DIR/scripts" -name "*.sh" -exec chmod 755 {} \;

log "Post-instalación completada."
