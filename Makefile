SHELL := /bin/bash

DEPLOY_HOST ?= tc
PUBLIC_HOST ?= 106.55.78.71
REMOTE_ROOT ?= /data/work/server/glimmer-notes
BACKEND_PORT ?= 8769
CLIENT_PORT ?= 8770
API_BASE_URL ?= http://$(PUBLIC_HOST):$(BACKEND_PORT)
DEV_LAN_HOST ?= 192.168.112.146
DEV_ORIGINS ?= http://localhost:10086,http://127.0.0.1:10086,http://localhost:10087,http://127.0.0.1:10087,http://localhost:10088,http://127.0.0.1:10088,http://$(DEV_LAN_HOST):10086,http://$(DEV_LAN_HOST):10087,http://$(DEV_LAN_HOST):10088
ALLOWED_ORIGINS ?= http://$(PUBLIC_HOST):$(CLIENT_PORT),$(DEV_ORIGINS)
SSH_OPTS ?= -o BatchMode=yes -o ConnectTimeout=10
SSH_BIN ?= /usr/bin/ssh
RSYNC_RSH ?= /usr/bin/ssh $(SSH_OPTS)

.PHONY: dev up_client up_backend up_106 build_client test_backend

dev:
	npm run dev:h5

build_client:
	npm ci
	npm run typecheck
	TARO_APP_API_BASE_URL="$(API_BASE_URL)" npm run build:h5

test_backend:
	npm run test:backend

up_client: build_client
	$(SSH_BIN) $(SSH_OPTS) $(DEPLOY_HOST) 'mkdir -p "$(REMOTE_ROOT)/client"'
	rsync -e '$(RSYNC_RSH)' -az --delete dist/ $(DEPLOY_HOST):$(REMOTE_ROOT)/client/
	$(SSH_BIN) $(SSH_OPTS) $(DEPLOY_HOST) 'set -eu; \
		if pm2 describe glimmer-notes-client >/dev/null 2>&1; then \
			pm2 restart glimmer-notes-client; \
		else \
			pm2 serve "$(REMOTE_ROOT)/client" "$(CLIENT_PORT)" --spa --name glimmer-notes-client; \
		fi; \
		firewall-cmd --permanent --add-port="$(CLIENT_PORT)/tcp" >/dev/null; \
		firewall-cmd --add-port="$(CLIENT_PORT)/tcp" >/dev/null; \
		pm2 save --force >/dev/null; \
		ready=0; \
		for attempt in $$(seq 1 20); do \
			if curl -fsS "http://127.0.0.1:$(CLIENT_PORT)/" >/dev/null; then ready=1; break; fi; \
			sleep 1; \
		done; \
		test "$$ready" = 1'
	@echo "Client deployed: http://$(PUBLIC_HOST):$(CLIENT_PORT)/"

up_backend: test_backend
	$(SSH_BIN) $(SSH_OPTS) $(DEPLOY_HOST) 'mkdir -p "$(REMOTE_ROOT)/backend" "$(REMOTE_ROOT)/config" "$(REMOTE_ROOT)/data" "$(REMOTE_ROOT)/logs"'
	rsync -e '$(RSYNC_RSH)' -az --delete backend/ $(DEPLOY_HOST):$(REMOTE_ROOT)/backend/
	$(SSH_BIN) $(SSH_OPTS) $(DEPLOY_HOST) 'set -eu; \
		HOST="0.0.0.0" \
		PORT="$(BACKEND_PORT)" \
		DATA_FILE="$(REMOTE_ROOT)/data/store.json" \
		ALLOWED_ORIGINS="$(ALLOWED_ORIGINS)" \
		SESSION_TTL_SECONDS="2592000" \
		node "$(REMOTE_ROOT)/backend/scripts/init-auth.mjs" "$(REMOTE_ROOT)/config/backend.env"; \
		set -a; . "$(REMOTE_ROOT)/config/backend.env"; set +a; \
		if pm2 describe glimmer-notes-backend >/dev/null 2>&1; then pm2 delete glimmer-notes-backend >/dev/null; fi; \
		pm2 start "$(REMOTE_ROOT)/backend/main.mjs" --name glimmer-notes-backend --cwd "$(REMOTE_ROOT)" --interpreter node; \
		firewall-cmd --permanent --add-port="$(BACKEND_PORT)/tcp" >/dev/null; \
		firewall-cmd --add-port="$(BACKEND_PORT)/tcp" >/dev/null; \
		pm2 save --force >/dev/null; \
		ready=0; \
		for attempt in $$(seq 1 20); do \
			if curl -fsS "http://127.0.0.1:$(BACKEND_PORT)/health" >/dev/null; then ready=1; break; fi; \
			sleep 1; \
		done; \
		test "$$ready" = 1'
	@echo "Backend deployed: http://$(PUBLIC_HOST):$(BACKEND_PORT)/health"

up_106:
	$(MAKE) up_backend
	$(MAKE) up_client
