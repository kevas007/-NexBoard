package store

import (
	"database/sql"
	"proxmox-dashboard/internal/models"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *Store {
	// Créer une base de données temporaire en mémoire
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	store := NewStore(db)

	// Exécuter les migrations
	if err := store.Migrate(); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return store
}

func TestStore_CreateApp(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	app := &models.App{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
		CreatedAt:  time.Now(),
	}

	err := store.CreateApp(app)
	if err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	if app.ID == 0 {
		t.Error("Expected app ID to be set")
	}

	// Vérifier que l'app a été créée
	retrieved, err := store.GetApp(app.ID)
	if err != nil {
		t.Fatalf("GetApp() error = %v", err)
	}

	if retrieved.Name != app.Name {
		t.Errorf("Expected name %s, got %s", app.Name, retrieved.Name)
	}
}

func TestStore_GetApps(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer quelques apps de test
	apps := []*models.App{
		{
			Name:       "App 1",
			Protocol:   "https",
			Host:       "example1.com",
			Port:       443,
			Path:       "/",
			HealthPath: "/health",
			HealthType: "http",
			CreatedAt:  time.Now(),
		},
		{
			Name:       "App 2",
			Protocol:   "https",
			Host:       "example2.com",
			Port:       443,
			Path:       "/",
			HealthPath: "/health",
			HealthType: "http",
			CreatedAt:  time.Now(),
		},
	}

	for _, app := range apps {
		if err := store.CreateApp(app); err != nil {
			t.Fatalf("CreateApp() error = %v", err)
		}
	}

	// Récupérer tous les apps
	retrieved, err := store.GetApps()
	if err != nil {
		t.Fatalf("GetApps() error = %v", err)
	}

	if len(retrieved) != 2 {
		t.Errorf("Expected 2 apps, got %d", len(retrieved))
	}
}

func TestStore_UpdateApp(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer un app
	app := &models.App{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
		CreatedAt:  time.Now(),
	}

	if err := store.CreateApp(app); err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	// Modifier l'app
	req := models.CreateAppRequest{
		Name:       "Updated App",
		Protocol:   "https",
		Host:       "updated.example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
	}

	err := store.UpdateApp(app.ID, req)
	if err != nil {
		t.Fatalf("UpdateApp() error = %v", err)
	}

	// Vérifier les modifications
	retrieved, err := store.GetApp(app.ID)
	if err != nil {
		t.Fatalf("GetApp() error = %v", err)
	}

	if retrieved.Name != "Updated App" {
		t.Errorf("Expected name 'Updated App', got %s", retrieved.Name)
	}

	if retrieved.Host != "updated.example.com" {
		t.Errorf("Expected host 'updated.example.com', got %s", retrieved.Host)
	}
}

func TestStore_DeleteApp(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer un app
	app := &models.App{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
		CreatedAt:  time.Now(),
	}

	if err := store.CreateApp(app); err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	// Supprimer l'app
	err := store.DeleteApp(app.ID)
	if err != nil {
		t.Fatalf("DeleteApp() error = %v", err)
	}

	// Vérifier que l'app a été supprimé
	_, err = store.GetApp(app.ID)
	if err == nil {
		t.Error("Expected error when getting deleted app")
	}
}

func TestStore_CreateAlert(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer un app d'abord
	app := &models.App{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
		CreatedAt:  time.Now(),
	}

	if err := store.CreateApp(app); err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	// Créer une alerte
	alert := &models.Alert{
		Source:       "test",
		Severity:     "high",
		Title:        "Service Down",
		Message:      "Service is down",
		CreatedAt:    time.Now(),
		Acknowledged: false,
	}

	err := store.CreateAlert(alert)
	if err != nil {
		t.Fatalf("CreateAlert() error = %v", err)
	}

	if alert.ID == 0 {
		t.Error("Expected alert ID to be set")
	}
}

func TestStore_GetAlerts(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer un app
	app := &models.App{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
		CreatedAt:  time.Now(),
	}

	if err := store.CreateApp(app); err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	// Créer quelques alertes
	alerts := []*models.Alert{
		{
			Source:       "test",
			Severity:     "high",
			Title:        "Service Down",
			Message:      "Service is down",
			CreatedAt:    time.Now(),
			Acknowledged: false,
		},
		{
			Source:       "test",
			Severity:     "low",
			Title:        "Service Recovery",
			Message:      "Service is back up",
			CreatedAt:    time.Now(),
			Acknowledged: true,
		},
	}

	for _, alert := range alerts {
		if err := store.CreateAlert(alert); err != nil {
			t.Fatalf("CreateAlert() error = %v", err)
		}
	}

	// Récupérer les alertes
	retrieved, err := store.GetAlerts()
	if err != nil {
		t.Fatalf("GetAlerts() error = %v", err)
	}

	if len(retrieved) != 2 {
		t.Errorf("Expected 2 alerts, got %d", len(retrieved))
	}
}

func TestStore_CreateNotificationSubscription(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	sub := &models.NotifySubscription{
		Channel:   "email",
		Endpoint:  "test@example.com",
		Enabled:   true,
		CreatedAt: time.Now(),
	}

	err := store.CreateNotificationSubscription(sub)
	if err != nil {
		t.Fatalf("CreateNotificationSubscription() error = %v", err)
	}

	if sub.ID == 0 {
		t.Error("Expected subscription ID to be set")
	}
}

func TestStore_GetNotificationSubscriptions(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer quelques abonnements
	subs := []*models.NotifySubscription{
		{
			Channel:   "email",
			Endpoint:  "test1@example.com",
			Enabled:   true,
			CreatedAt: time.Now(),
		},
		{
			Channel:   "webhook",
			Endpoint:  "",
			Enabled:   true,
			CreatedAt: time.Now(),
		},
	}

	for _, sub := range subs {
		if err := store.CreateNotificationSubscription(sub); err != nil {
			t.Fatalf("CreateNotificationSubscription() error = %v", err)
		}
	}

	// Récupérer les abonnements
	retrieved, err := store.GetNotificationSubscriptions()
	if err != nil {
		t.Fatalf("GetNotificationSubscriptions() error = %v", err)
	}

	if len(retrieved) != 2 {
		t.Errorf("Expected 2 subscriptions, got %d", len(retrieved))
	}
}

func TestStore_CreateEmailQueue(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	err := store.CreateEmailQueue(email)
	if err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	if email.ID == 0 {
		t.Error("Expected email ID to be set")
	}
}

func TestStore_GetPendingEmails(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer quelques emails
	emails := []*models.EmailQueue{
		{
			ToAddr:    "test1@example.com",
			Subject:   "Test Subject 1",
			BodyText:  "Test Body 1",
			State:     "pending",
			CreatedAt: time.Now(),
		},
		{
			ToAddr:    "test2@example.com",
			Subject:   "Test Subject 2",
			BodyText:  "Test Body 2",
			State:     "sent",
			CreatedAt: time.Now(),
		},
	}

	for _, email := range emails {
		if err := store.CreateEmailQueue(email); err != nil {
			t.Fatalf("CreateEmailQueue() error = %v", err)
		}
	}

	// Récupérer les emails en attente
	pending, err := store.GetPendingEmails()
	if err != nil {
		t.Fatalf("GetPendingEmails() error = %v", err)
	}

	if len(pending) != 1 {
		t.Errorf("Expected 1 pending email, got %d", len(pending))
	}
}

func TestStore_UpdateEmailStatus(t *testing.T) {
	store := setupTestDB(t)
	defer store.Close()

	// Créer un email
	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := store.CreateEmailQueue(email); err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	// Mettre à jour le statut
	err := store.UpdateEmailStatus(email.ID, "sent")
	if err != nil {
		t.Fatalf("UpdateEmailStatus() error = %v", err)
	}

	// Vérifier le statut
	updated, err := store.GetEmailQueue(email.ID)
	if err != nil {
		t.Fatalf("GetEmailQueue() error = %v", err)
	}

	if updated.State != "sent" {
		t.Errorf("Expected state 'sent', got %s", updated.State)
	}
}
