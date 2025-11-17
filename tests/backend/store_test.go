package backend_test

import (
	"database/sql"
	"nexboard/internal/models"
	"nexboard/internal/store"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *store.Store {
	// Créer une base de données temporaire en mémoire
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	testStore := store.NewStore(db)

	// Exécuter les migrations
	if err := testStore.Migrate(); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return testStore
}

func TestStore_CreateApp(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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

	err := s.CreateApp(app)
	if err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	if app.ID == 0 {
		t.Error("Expected app ID to be set")
	}

	// Vérifier que l'app a été créée
	retrieved, err := s.GetApp(app.ID)
	if err != nil {
		t.Fatalf("GetApp() error = %v", err)
	}

	if retrieved.Name != app.Name {
		t.Errorf("Expected name %s, got %s", app.Name, retrieved.Name)
	}
}

func TestStore_GetApps(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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
		if err := s.CreateApp(app); err != nil {
			t.Fatalf("CreateApp() error = %v", err)
		}
	}

	// Récupérer tous les apps
	retrieved, err := s.GetApps()
	if err != nil {
		t.Fatalf("GetApps() error = %v", err)
	}

	if len(retrieved) != 2 {
		t.Errorf("Expected 2 apps, got %d", len(retrieved))
	}
}

func TestStore_UpdateApp(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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

	if err := s.CreateApp(app); err != nil {
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

	err := s.UpdateApp(app.ID, req)
	if err != nil {
		t.Fatalf("UpdateApp() error = %v", err)
	}

	// Vérifier les modifications
	retrieved, err := s.GetApp(app.ID)
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
	s := setupTestDB(t)
	defer s.Close()

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

	if err := s.CreateApp(app); err != nil {
		t.Fatalf("CreateApp() error = %v", err)
	}

	// Supprimer l'app
	err := s.DeleteApp(app.ID)
	if err != nil {
		t.Fatalf("DeleteApp() error = %v", err)
	}

	// Vérifier que l'app a été supprimé
	_, err = s.GetApp(app.ID)
	if err == nil {
		t.Error("Expected error when getting deleted app")
	}
}

func TestStore_CreateAlert(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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

	if err := s.CreateApp(app); err != nil {
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

	err := s.CreateAlert(alert)
	if err != nil {
		t.Fatalf("CreateAlert() error = %v", err)
	}

	if alert.ID == 0 {
		t.Error("Expected alert ID to be set")
	}
}

func TestStore_GetAlerts(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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

	if err := s.CreateApp(app); err != nil {
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
		if err := s.CreateAlert(alert); err != nil {
			t.Fatalf("CreateAlert() error = %v", err)
		}
	}

	// Récupérer les alertes
	retrieved, err := s.GetAlerts()
	if err != nil {
		t.Fatalf("GetAlerts() error = %v", err)
	}

	if len(retrieved) != 2 {
		t.Errorf("Expected 2 alerts, got %d", len(retrieved))
	}
}

func TestStore_CreateNotificationSubscription(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	sub := &models.NotifySubscription{
		Channel:   "email",
		Endpoint:  "test@example.com",
		Enabled:   true,
		CreatedAt: time.Now(),
	}

	err := s.CreateNotificationSubscription(sub)
	if err != nil {
		t.Fatalf("CreateNotificationSubscription() error = %v", err)
	}

	if sub.ID == 0 {
		t.Error("Expected subscription ID to be set")
	}
}

func TestStore_GetNotificationSubscriptions(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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
		if err := s.CreateNotificationSubscription(sub); err != nil {
			t.Fatalf("CreateNotificationSubscription() error = %v", err)
		}
	}

	// Récupérer les abonnements
	retrieved, err := s.GetNotificationSubscriptions()
	if err != nil {
		t.Fatalf("GetNotificationSubscriptions() error = %v", err)
	}

	if len(retrieved) != 2 {
		t.Errorf("Expected 2 subscriptions, got %d", len(retrieved))
	}
}

func TestStore_CreateEmailQueue(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	err := s.CreateEmailQueue(email)
	if err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	if email.ID == 0 {
		t.Error("Expected email ID to be set")
	}
}

func TestStore_GetPendingEmails(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

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
		if err := s.CreateEmailQueue(email); err != nil {
			t.Fatalf("CreateEmailQueue() error = %v", err)
		}
	}

	// Récupérer les emails en attente
	pending, err := s.GetPendingEmails()
	if err != nil {
		t.Fatalf("GetPendingEmails() error = %v", err)
	}

	if len(pending) != 1 {
		t.Errorf("Expected 1 pending email, got %d", len(pending))
	}
}

func TestStore_UpdateEmailStatus(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	// Créer un email
	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := s.CreateEmailQueue(email); err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	// Mettre à jour le statut
	err := s.UpdateEmailStatus(email.ID, "sent")
	if err != nil {
		t.Fatalf("UpdateEmailStatus() error = %v", err)
	}

	// Vérifier le statut
	updated, err := s.GetEmailQueue(email.ID)
	if err != nil {
		t.Fatalf("GetEmailQueue() error = %v", err)
	}

	if updated.State != "sent" {
		t.Errorf("Expected state 'sent', got %s", updated.State)
	}
}

func TestStore_AcknowledgeAlert(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	// Créer une alerte
	alert := &models.Alert{
		Source:       "test",
		Severity:     "high",
		Title:        "Service Down",
		Message:      "Service is down",
		CreatedAt:    time.Now(),
		Acknowledged: false,
	}

	if err := s.CreateAlert(alert); err != nil {
		t.Fatalf("CreateAlert() error = %v", err)
	}

	// Acquitter l'alerte
	err := s.AcknowledgeAlert(alert.ID)
	if err != nil {
		t.Fatalf("AcknowledgeAlert() error = %v", err)
	}

	// Vérifier que l'alerte est acquittée
	alerts, err := s.GetAlerts()
	if err != nil {
		t.Fatalf("GetAlerts() error = %v", err)
	}

	found := false
	for _, a := range alerts {
		if a.ID == alert.ID {
			if !a.Acknowledged {
				t.Error("Expected alert to be acknowledged")
			}
			found = true
			break
		}
	}

	if !found {
		t.Error("Alert not found after acknowledgment")
	}
}

func TestStore_AcknowledgeAllAlerts(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	// Créer plusieurs alertes
	alerts := []*models.Alert{
		{
			Source:       "test",
			Severity:     "high",
			Title:        "Alert 1",
			Message:      "Message 1",
			CreatedAt:    time.Now(),
			Acknowledged: false,
		},
		{
			Source:       "test",
			Severity:     "medium",
			Title:        "Alert 2",
			Message:      "Message 2",
			CreatedAt:    time.Now(),
			Acknowledged: false,
		},
	}

	for _, alert := range alerts {
		if err := s.CreateAlert(alert); err != nil {
			t.Fatalf("CreateAlert() error = %v", err)
		}
	}

	// Acquitter toutes les alertes
	err := s.AcknowledgeAllAlerts()
	if err != nil {
		t.Fatalf("AcknowledgeAllAlerts() error = %v", err)
	}

	// Vérifier que toutes les alertes sont acquittées
	retrieved, err := s.GetAlerts()
	if err != nil {
		t.Fatalf("GetAlerts() error = %v", err)
	}

	for _, alert := range retrieved {
		if !alert.Acknowledged {
			t.Errorf("Expected all alerts to be acknowledged, but alert %d is not", alert.ID)
		}
	}
}

func TestStore_GetEmailQueue(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	// Créer un email
	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := s.CreateEmailQueue(email); err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	// Récupérer l'email
	retrieved, err := s.GetEmailQueue(email.ID)
	if err != nil {
		t.Fatalf("GetEmailQueue() error = %v", err)
	}

	if retrieved.ToAddr != email.ToAddr {
		t.Errorf("Expected ToAddr %s, got %s", email.ToAddr, retrieved.ToAddr)
	}

	if retrieved.Subject != email.Subject {
		t.Errorf("Expected Subject %s, got %s", email.Subject, retrieved.Subject)
	}
}

func TestStore_MarkEmailError(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	// Créer un email
	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := s.CreateEmailQueue(email); err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	// Marquer l'email comme erreur
	errorMsg := "Connection timeout"
	err := s.MarkEmailError(email.ID, errorMsg)
	if err != nil {
		t.Fatalf("MarkEmailError() error = %v", err)
	}

	// Vérifier le statut
	updated, err := s.GetEmailQueue(email.ID)
	if err != nil {
		t.Fatalf("GetEmailQueue() error = %v", err)
	}

	if updated.State != "error" {
		t.Errorf("Expected state 'error', got %s", updated.State)
	}

	if updated.LastError == nil || *updated.LastError != errorMsg {
		t.Errorf("Expected LastError %s, got %v", errorMsg, updated.LastError)
	}
}

func TestStore_MarkEmailSent(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()

	// Créer un email
	email := &models.EmailQueue{
		ToAddr:    "test@example.com",
		Subject:   "Test Subject",
		BodyText:  "Test Body",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := s.CreateEmailQueue(email); err != nil {
		t.Fatalf("CreateEmailQueue() error = %v", err)
	}

	// Marquer l'email comme envoyé
	err := s.MarkEmailSent(email.ID)
	if err != nil {
		t.Fatalf("MarkEmailSent() error = %v", err)
	}

	// Vérifier le statut
	updated, err := s.GetEmailQueue(email.ID)
	if err != nil {
		t.Fatalf("GetEmailQueue() error = %v", err)
	}

	if updated.State != "sent" {
		t.Errorf("Expected state 'sent', got %s", updated.State)
	}

	if updated.SentAt == nil {
		t.Error("Expected SentAt to be set")
	}
}
