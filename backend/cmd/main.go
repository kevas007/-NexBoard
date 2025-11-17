package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"nexboard/internal/config"
	"nexboard/internal/handlers"
	"nexboard/internal/routes"
	"nexboard/internal/seeders"
	"nexboard/internal/sse"
	"nexboard/internal/store"

	_ "modernc.org/sqlite"
)

func main() {
	// Charger la configuration
	cfg := config.Load()

	// Configuration de la base de données
	db, err := sql.Open("sqlite", cfg.Database.Path)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Créer le store
	store := store.NewStore(db)

	// Exécuter les migrations
	if err := store.Migrate(); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Charger les seeders uniquement en environnement de développement
	if cfg.Environment == "dev" {
		if err := seeders.SeedDatabase(db); err != nil {
			log.Printf("⚠️  Erreur lors du chargement des seeders: %v", err)
			// Ne pas arrêter l'application si les seeders échouent
		}
	} else {
		log.Println("🚀 Mode production: aucune donnée de test ne sera chargée")
	}

	// Créer le hub SSE
	hub := sse.NewHub()
	hub.Start()

	// Créer les handlers
	handlers := handlers.NewHandlers(store)

	// Configuration du routeur
	r := routes.SetupRoutes(handlers, hub)

	// Démarrer le serveur
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	fmt.Printf("Server starting on %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}
