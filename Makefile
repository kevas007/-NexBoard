.PHONY: help dev prod build-dev build-prod up-dev up-prod down-dev down-prod clean logs-dev logs-prod

help: ## Affiche l'aide
	@echo "Commandes disponibles:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: build-dev up-dev ## Démarrer l'environnement de développement
	@echo "✅ Environnement de développement démarré"
	@echo "📱 Frontend: http://localhost:5173"
	@echo "🔧 Backend: http://localhost:8081"
	@echo "📧 MailHog: http://localhost:8025"

prod: build-prod up-prod ## Démarrer l'environnement de production
	@echo "✅ Environnement de production démarré"
	@echo "📱 Frontend: http://localhost:5173"
	@echo "🔧 Backend: http://localhost:8081"
	@echo "📧 MailHog: http://localhost:8025"

build-dev: ## Construire les images Docker pour le développement
	docker-compose -f docker-compose.dev.yml build

build-prod: ## Construire les images Docker pour la production
	docker-compose -f docker-compose.prod.yml build

up-dev: ## Démarrer les conteneurs en mode développement
	docker-compose -f docker-compose.dev.yml up -d

up-prod: ## Démarrer les conteneurs en mode production
	docker-compose -f docker-compose.prod.yml up -d

down-dev: ## Arrêter les conteneurs de développement
	docker-compose -f docker-compose.dev.yml down

down-prod: ## Arrêter les conteneurs de production
	docker-compose -f docker-compose.prod.yml down

clean: ## Nettoyer les conteneurs, volumes et images
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose -f docker-compose.prod.yml down -v
	docker system prune -f

logs-dev: ## Voir les logs en mode développement
	docker-compose -f docker-compose.dev.yml logs -f

logs-prod: ## Voir les logs en mode production
	docker-compose -f docker-compose.prod.yml logs -f

restart-dev: ## Redémarrer les conteneurs de développement
	docker-compose -f docker-compose.dev.yml restart

restart-prod: ## Redémarrer les conteneurs de production
	docker-compose -f docker-compose.prod.yml restart
