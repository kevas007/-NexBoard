package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"proxmox-dashboard/internal/models"
	"proxmox-dashboard/internal/store"
)

func setupTestHandlers() *Handlers {
	// Créer une base de données de test
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		panic(err)
	}

	testStore := store.NewStore(db)
	if err := testStore.Migrate(); err != nil {
		panic(err)
	}

	return NewHandlers(testStore)
}

func TestHandlers_GetApps(t *testing.T) {
	handlers := setupTestHandlers()

	req, err := http.NewRequest("GET", "/api/apps", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.GetApps)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Vérifier que la réponse est un JSON valide
	var apps []models.App
	if err := json.Unmarshal(rr.Body.Bytes(), &apps); err != nil {
		t.Errorf("handler returned invalid JSON: %v", err)
	}
}

func TestHandlers_CreateApp(t *testing.T) {
	handlers := setupTestHandlers()

	app := models.CreateAppRequest{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
	}

	jsonData, err := json.Marshal(app)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/api/apps", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.CreateApp)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}

	// Vérifier que la réponse contient l'app créé
	var createdApp models.App
	if err := json.Unmarshal(rr.Body.Bytes(), &createdApp); err != nil {
		t.Errorf("handler returned invalid JSON: %v", err)
	}

	if createdApp.Name != app.Name {
		t.Errorf("handler returned wrong name: got %v want %v", createdApp.Name, app.Name)
	}
}

func TestHandlers_UpdateApp(t *testing.T) {
	handlers := setupTestHandlers()

	// Créer un app d'abord
	app := models.CreateAppRequest{
		Name:       "Test App",
		Protocol:   "https",
		Host:       "example.com",
		Port:       443,
		Path:       "/",
		HealthPath: "/health",
		HealthType: "http",
	}

	// Simuler la création (dans un vrai test, on utiliserait le store)
	// app.ID sera défini par le store lors de la création

	// Modifier l'app
	app.Name = "Updated App"
	app.Host = "updated.example.com"

	jsonData, err := json.Marshal(app)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("PUT", "/api/apps/1", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.UpdateApp)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}

func TestHandlers_DeleteApp(t *testing.T) {
	handlers := setupTestHandlers()

	req, err := http.NewRequest("DELETE", "/api/apps/1", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.DeleteApp)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusNoContent {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusNoContent)
	}
}

func TestHandlers_GetAlerts(t *testing.T) {
	handlers := setupTestHandlers()

	req, err := http.NewRequest("GET", "/api/alerts", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.GetAlerts)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Vérifier que la réponse est un JSON valide
	var alerts []models.Alert
	if err := json.Unmarshal(rr.Body.Bytes(), &alerts); err != nil {
		t.Errorf("handler returned invalid JSON: %v", err)
	}
}

func TestHandlers_CreateAlert(t *testing.T) {
	handlers := setupTestHandlers()

	alert := models.CreateAlertRequest{
		Source:   "test",
		Severity: "high",
		Title:    "Service Down",
		Message:  "Service is down",
	}

	jsonData, err := json.Marshal(alert)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/api/alerts", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.CreateAlert)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}
}

func TestHandlers_GetHealth(t *testing.T) {
	handlers := setupTestHandlers()

	req, err := http.NewRequest("GET", "/api/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.GetHealth)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Vérifier que la réponse contient les informations de santé
	var health map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &health); err != nil {
		t.Errorf("handler returned invalid JSON: %v", err)
	}

	if health["status"] != "ok" {
		t.Errorf("handler returned wrong status: got %v want %v", health["status"], "ok")
	}
}

func TestHandlers_GetHealthHTTP(t *testing.T) {
	handlers := setupTestHandlers()

	req, err := http.NewRequest("GET", "/api/health/http?url=https://example.com", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.GetHealthHTTP)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Vérifier que la réponse contient les résultats du health check
	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Errorf("handler returned invalid JSON: %v", err)
	}
}

func TestHandlers_GetHealthTCP(t *testing.T) {
	handlers := setupTestHandlers()

	req, err := http.NewRequest("GET", "/api/health/tcp?host=example.com&port=80", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.GetHealthTCP)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Vérifier que la réponse contient les résultats du health check TCP
	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Errorf("handler returned invalid JSON: %v", err)
	}
}

func TestHandlers_TestEmail(t *testing.T) {
	handlers := setupTestHandlers()

	emailData := map[string]string{
		"to": "test@example.com",
	}

	jsonData, err := json.Marshal(emailData)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/api/notify/test", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.TestEmail)

	handler.ServeHTTP(rr, req)

	// Le test peut échouer si l'email ne peut pas être envoyé, mais la structure doit être correcte
	if status := rr.Code; status != http.StatusOK && status != http.StatusInternalServerError {
		t.Errorf("handler returned unexpected status code: got %v", status)
	}
}

func TestHandlers_SubscribeNotification(t *testing.T) {
	handlers := setupTestHandlers()

	subscription := models.SubscribeRequest{
		Channel:  "email",
		Endpoint: "test@example.com",
	}

	jsonData, err := json.Marshal(subscription)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/api/notify/subscribe", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.SubscribeNotification)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}
}
