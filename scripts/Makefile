# Makefile pour ProxmoxDash
.PHONY: help build run test clean dev prod security-test

# Variables
BACKEND_DIR = backend
FRONTEND_DIR = frontend
DOCKER_COMPOSE = docker compose

help: ## Affiche cette aide
	@echo "ProxmoxDash - Commandes disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Installe toutes les dépendances
	@echo "Installation des dépendances..."
	cd $(BACKEND_DIR) && go mod download
	cd $(FRONTEND_DIR) && npm install

build: ## Compile le projet complet
	@echo "Compilation du projet..."
	cd $(BACKEND_DIR) && go build -o main ./cmd/main.go
	cd $(FRONTEND_DIR) && npm run build

run-backend: ## Lance le backend Go
	@echo "Démarrage du backend..."
	cd $(BACKEND_DIR) && go run ./cmd/main.go

run-frontend: ## Lance le frontend en mode dev
	@echo "Démarrage du frontend..."
	cd $(FRONTEND_DIR) && npm run dev

dev: ## Lance l'environnement de développement complet
	@echo "Démarrage de l'environnement de développement..."
	$(DOCKER_COMPOSE) --env-file config.env up -d

prod: ## Lance l'environnement de production
	@echo "Démarrage de l'environnement de production..."
	$(DOCKER_COMPOSE) --env-file config.prod.env up -d

stop: ## Arrête tous les services Docker
	@echo "Arrêt des services..."
	$(DOCKER_COMPOSE) down

logs: ## Affiche les logs des services
	$(DOCKER_COMPOSE) logs -f

test: ## Lance les tests
	@echo "Exécution des tests..."
	cd $(BACKEND_DIR) && go test ./...
	cd $(FRONTEND_DIR) && npm run test:run

test-backend: ## Lance les tests du backend uniquement
	@echo "Tests du backend..."
	cd $(BACKEND_DIR) && go test -v ./...

test-frontend: ## Lance les tests du frontend uniquement
	@echo "Tests du frontend..."
	cd $(FRONTEND_DIR) && npm run test:run

test-coverage: ## Lance les tests avec couverture
	@echo "Tests avec couverture..."
	cd $(BACKEND_DIR) && go test -cover ./...
	cd $(FRONTEND_DIR) && npm run test:coverage

test-watch: ## Lance les tests en mode watch
	@echo "Tests en mode watch..."
	cd $(FRONTEND_DIR) && npm test

test-ui: ## Lance l'interface de test
	@echo "Interface de test..."
	cd $(FRONTEND_DIR) && npm run test:ui

security-test: ## Lance les tests de sécurité
	@echo "Tests de sécurité..."
	@bash test-security.sh

generate-tokens: ## Génère des tokens de sécurité
	@echo "Génération de tokens sécurisés..."
	@node scripts/generate-tokens.js

clean: ## Nettoie les fichiers de build
	@echo "Nettoyage..."
	cd $(BACKEND_DIR) && rm -f main
	cd $(FRONTEND_DIR) && rm -rf dist
	cd $(FRONTEND_DIR) && rm -rf node_modules/.cache
	$(DOCKER_COMPOSE) down --volumes --remove-orphans

rebuild: clean build ## Nettoie et recompile tout

docker-build: ## Construit les images Docker
	@echo "Construction des images Docker..."
	$(DOCKER_COMPOSE) build

docker-rebuild: ## Reconstruit les images Docker sans cache
	@echo "Reconstruction des images Docker..."
	$(DOCKER_COMPOSE) build --no-cache

health-check: ## Vérifie la santé des services
	@echo "Vérification de la santé des services..."
	@curl -s http://localhost:8080/api/health > /dev/null && echo "Backend: OK" || echo "Backend: KO"
	@curl -s http://localhost:5173/health > /dev/null && echo "Frontend: OK" || echo "Frontend: KO"
	@curl -s http://localhost:8025/ > /dev/null && echo "MailHog: OK" || echo "MailHog: KO"

backup: ## Sauvegarde la base de données
	@echo "Sauvegarde de la base de données..."
	@mkdir -p backups
	@if [ -f data/app.db ]; then \
		cp data/app.db backups/app-$$(date +%Y%m%d-%H%M%S).db; \
		echo "Sauvegarde créée dans backups/"; \
	else \
		echo "Aucune base de données à sauvegarder"; \
	fi

restore: ## Restaure la dernière sauvegarde
	@echo "Restauration de la dernière sauvegarde..."
	@LATEST=$$(ls -t backups/app-*.db 2>/dev/null | head -1); \
	if [ -n "$$LATEST" ]; then \
		cp "$$LATEST" data/app.db; \
		echo "Base de données restaurée depuis $$(basename $$LATEST)"; \
	else \
		echo "Aucune sauvegarde trouvée"; \
	fi

setup-dev: ## Configuration initiale pour le développement
	@echo "Configuration de l'environnement de développement..."
	@if [ ! -f config.env ]; then cp env.example config.env && echo "Fichier config.env créé"; fi
	@mkdir -p data backups logs
	$(MAKE) install
	@echo "Environnement de développement prêt!"
	@echo "Lancez 'make dev' pour démarrer"

setup-prod: ## Configuration initiale pour la production
	@echo "Configuration de l'environnement de production..."
	@if [ ! -f config.prod.env ]; then \
		cp env.example config.prod.env && \
		echo "Fichier config.prod.env créé" && \
		echo "ATTENTION: Modifiez config.prod.env avec vos valeurs de production!" && \
		echo "Utilisez 'make generate-tokens' pour créer des tokens sécurisés"; \
	fi
	@mkdir -p data backups logs
	@echo "Configuration de production créée"

lint: ## Lance les linters
	@echo "Linting du code..."
	cd $(BACKEND_DIR) && go fmt ./...
	cd $(FRONTEND_DIR) && npm run lint

format: ## Formate le code
	@echo "Formatage du code..."
	cd $(BACKEND_DIR) && go fmt ./...
	cd $(FRONTEND_DIR) && npm run lint --fix

update: ## Met à jour les dépendances
	@echo "Mise à jour des dépendances..."
	cd $(BACKEND_DIR) && go mod tidy && go get -u ./...
	cd $(FRONTEND_DIR) && npm update

# Commande par défaut
.DEFAULT_GOAL := help
