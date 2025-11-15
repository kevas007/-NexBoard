package main

import (
	"database/sql"
	"os"
	"testing"

	"proxmox-dashboard/internal/store"

	_ "modernc.org/sqlite"
)

// setupTestDB crée une base de données de test
func setupTestDB(t *testing.T) *store.Store {
	// Créer une base de données temporaire en mémoire
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	store := store.NewStore(db)

	// Exécuter les migrations
	if err := store.Migrate(); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return store
}

// setupTestEnv configure l'environnement de test
func setupTestEnv() {
	// Définir les variables d'environnement de test
	os.Setenv("DB_PATH", ":memory:")
	os.Setenv("PORT", "8080")
	os.Setenv("HOST", "localhost")
}

// cleanupTestEnv nettoie l'environnement de test
func cleanupTestEnv() {
	// Nettoyer les variables d'environnement si nécessaire
}
