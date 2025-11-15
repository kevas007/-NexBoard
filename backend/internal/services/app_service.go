package services

import (
	"fmt"
	"net"
	"net/http"
	"time"

	"proxmox-dashboard/internal/models"
	"proxmox-dashboard/internal/store"
)

// AppService gère la logique métier des applications
type AppService struct {
	store *store.Store
}

// NewAppService crée une nouvelle instance d'AppService
func NewAppService(store *store.Store) *AppService {
	return &AppService{store: store}
}

// CreateApp crée une nouvelle application
func (s *AppService) CreateApp(req models.CreateAppRequest) (*models.App, error) {
	app := &models.App{
		Name:       req.Name,
		Protocol:   req.Protocol,
		Host:       req.Host,
		Port:       req.Port,
		Path:       req.Path,
		Tag:        req.Tag,
		Icon:       req.Icon,
		HealthPath: req.HealthPath,
		HealthType: req.HealthType,
		CreatedAt:  time.Now(),
	}

	if err := app.Validate(); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	if err := s.store.CreateApp(app); err != nil {
		return nil, fmt.Errorf("failed to create app: %w", err)
	}

	return app, nil
}

// GetApp récupère une application par ID
func (s *AppService) GetApp(id int) (*models.App, error) {
	return s.store.GetApp(id)
}

// GetApps récupère toutes les applications
func (s *AppService) GetApps() ([]*models.App, error) {
	return s.store.GetApps()
}

// UpdateApp met à jour une application
func (s *AppService) UpdateApp(id int, req models.CreateAppRequest) error {
	if err := s.store.UpdateApp(id, req); err != nil {
		return fmt.Errorf("failed to update app: %w", err)
	}
	return nil
}

// DeleteApp supprime une application
func (s *AppService) DeleteApp(id int) error {
	if err := s.store.DeleteApp(id); err != nil {
		return fmt.Errorf("failed to delete app: %w", err)
	}
	return nil
}

// CheckHealth vérifie la santé d'une application
func (s *AppService) CheckHealth(app *models.App) (*models.HealthStatus, error) {
	// Faire une vraie vérification de santé selon le type
	startTime := time.Now()
	var status string
	var latency int64
	var statusCode *int
	var errMsg *string

	if app.HealthType == "tcp" {
		// Vérification TCP
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", app.Host, app.Port), 5*time.Second)
		latency = time.Since(startTime).Milliseconds()

		if err != nil {
			status = "offline"
			errorStr := err.Error()
			errMsg = &errorStr
		} else {
			conn.Close()
			status = "online"
		}
	} else {
		// Vérification HTTP
		url := fmt.Sprintf("%s://%s:%d%s", app.Protocol, app.Host, app.Port, app.HealthPath)
		resp, err := http.Get(url)
		latency = time.Since(startTime).Milliseconds()

		if err != nil {
			status = "offline"
			errorStr := err.Error()
			errMsg = &errorStr
		} else {
			defer resp.Body.Close()
			statusCodeVal := resp.StatusCode
			statusCode = &statusCodeVal

			if resp.StatusCode >= 200 && resp.StatusCode < 400 {
				status = "online"
			} else {
				status = "offline"
			}
		}
	}

	statusObj := &models.HealthStatus{
		AppID:     app.ID,
		Status:    status,
		Latency:   &latency,
		LastCheck: time.Now(),
		Error:     errMsg,
	}

	if statusCode != nil {
		statusObj.StatusCode = statusCode
	}

	return statusObj, nil
}
