package backend_test

import (
	"nexboard/internal/models"
	"testing"
)

func TestApp_Validate(t *testing.T) {
	tests := []struct {
		name    string
		app     models.App
		wantErr bool
	}{
		{
			name: "valid app",
			app: models.App{
				Name:       "Test App",
				Protocol:   "https",
				Host:       "example.com",
				Port:       443,
				Path:       "/",
				HealthPath: "/health",
				HealthType: "http",
			},
			wantErr: false,
		},
		{
			name: "empty name",
			app: models.App{
				Name:       "",
				Protocol:   "https",
				Host:       "example.com",
				Port:       443,
				Path:       "/",
				HealthPath: "/health",
				HealthType: "http",
			},
			wantErr: true,
		},
		{
			name: "invalid protocol",
			app: models.App{
				Name:       "Test App",
				Protocol:   "invalid",
				Host:       "example.com",
				Port:       443,
				Path:       "/",
				HealthPath: "/health",
				HealthType: "http",
			},
			wantErr: true,
		},
		{
			name: "empty host",
			app: models.App{
				Name:       "Test App",
				Protocol:   "https",
				Host:       "",
				Port:       443,
				Path:       "/",
				HealthPath: "/health",
				HealthType: "http",
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			app: models.App{
				Name:       "Test App",
				Protocol:   "https",
				Host:       "example.com",
				Port:       -1,
				Path:       "/",
				HealthPath: "/health",
				HealthType: "http",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.app.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("App.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAlert_Validate(t *testing.T) {
	tests := []struct {
		name    string
		alert   models.Alert
		wantErr bool
	}{
		{
			name: "valid alert",
			alert: models.Alert{
				Source:   "test",
				Severity: "high",
				Title:    "Test Alert",
				Message:  "This is a test alert",
			},
			wantErr: false,
		},
		{
			name: "empty title",
			alert: models.Alert{
				Source:   "test",
				Severity: "high",
				Title:    "",
				Message:  "This is a test alert",
			},
			wantErr: true,
		},
		{
			name: "empty message",
			alert: models.Alert{
				Source:   "test",
				Severity: "high",
				Title:    "Test Alert",
				Message:  "",
			},
			wantErr: true,
		},
		{
			name: "invalid severity",
			alert: models.Alert{
				Source:   "test",
				Severity: "invalid",
				Title:    "Test Alert",
				Message:  "This is a test alert",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.alert.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Alert.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNotifySubscription_Validate(t *testing.T) {
	tests := []struct {
		name    string
		sub     models.NotifySubscription
		wantErr bool
	}{
		{
			name: "valid email subscription",
			sub: models.NotifySubscription{
				Channel:  "email",
				Endpoint: "test@example.com",
				Enabled:  true,
			},
			wantErr: false,
		},
		{
			name: "valid webhook subscription",
			sub: models.NotifySubscription{
				Channel:  "webhook",
				Endpoint: "",
				Enabled:  true,
			},
			wantErr: false,
		},
		{
			name: "invalid channel",
			sub: models.NotifySubscription{
				Channel:  "invalid",
				Endpoint: "test@example.com",
				Enabled:  true,
			},
			wantErr: true,
		},
		{
			name: "empty endpoint",
			sub: models.NotifySubscription{
				Channel:  "email",
				Endpoint: "",
				Enabled:  true,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.sub.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("NotifySubscription.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEmailQueue_Validate(t *testing.T) {
	tests := []struct {
		name    string
		email   models.EmailQueue
		wantErr bool
	}{
		{
			name: "valid email",
			email: models.EmailQueue{
				ToAddr:   "test@example.com",
				Subject:  "Test Subject",
				BodyText: "Test Body",
				State:    "pending",
			},
			wantErr: false,
		},
		{
			name: "invalid email address",
			email: models.EmailQueue{
				ToAddr:   "invalid-email",
				Subject:  "Test Subject",
				BodyText: "Test Body",
				State:    "pending",
			},
			wantErr: true,
		},
		{
			name: "empty subject",
			email: models.EmailQueue{
				ToAddr:   "test@example.com",
				Subject:  "",
				BodyText: "Test Body",
				State:    "pending",
			},
			wantErr: true,
		},
		{
			name: "invalid state",
			email: models.EmailQueue{
				ToAddr:   "test@example.com",
				Subject:  "Test Subject",
				BodyText: "Test Body",
				State:    "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.email.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("EmailQueue.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
