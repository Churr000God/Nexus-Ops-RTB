.PHONY: up down logs ps rebuild prod-up prod-down deploy health backup restore restore-latest setup-db update

# === Desarrollo ===
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

rebuild:
	docker compose build --no-cache

restart:
	docker compose restart

# === Produccion ===
prod-up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# === Deploy automatico ===
deploy-dev:
	bash ./scripts/deploy.sh dev

deploy-prod:
	bash ./scripts/deploy.sh prod

deploy-force:
	bash ./scripts/deploy.sh prod --force

# === Actualizacion ===
update:
	bash ./scripts/update-and-deploy.sh dev

update-prod:
	bash ./scripts/update-and-deploy.sh prod

pull:
	bash ./scripts/pull-auto.sh

push:
	bash ./scripts/push-auto-branch.sh

# === Mantenimiento ===
health:
	bash ./scripts/health-check.sh

backup:
	bash ./scripts/backup-db.sh

restore:
	@echo "Uso: make restore FILE=data/backups/nombre.sql.gz"
	@test -n "$(FILE)" && bash ./scripts/restore-db.sh $(FILE)

restore-latest:
	bash ./scripts/restore-db.sh

setup-db:
	bash ./scripts/setup-db.sh

# === Desarrollo (lint/test) ===
lint-backend:
	cd backend && ruff check . && ruff format --check .

lint-frontend:
	cd frontend && npm run lint && npm run typecheck

test-backend:
	cd backend && pytest tests/ -v

init:
	bash ./scripts/init-project.sh

