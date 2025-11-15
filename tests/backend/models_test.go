package models

import (
	"testing"
)

func TestApp_Validate(t *testing.T) {
	tests := []struct {
		name    string
		app     App
		wantErr bool
	}{
		{
			name: "valid app",
			app: App{
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
			app: App{
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
			app: App{
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
			app: App{
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
			app: App{
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
		alert   Alert
		wantErr bool
	}{
		{
			name: "valid alert",
			alert: Alert{
				Source:   "test",
				Severity: "high",
				Title:    "Test Alert",
				Message:  "This is a test alert",
			},
			wantErr: false,
		},
		{
			name: "empty title",
			alert: Alert{
				Source:   "test",
				Severity: "high",
				Title:    "",
				Message:  "This is a test alert",
			},
			wantErr: true,
		},
		{
			name: "empty message",
			alert: Alert{
				Source:   "test",
				Severity: "high",
				Title:    "Test Alert",
				Message:  "",
			},
			wantErr: true,
		},
		{
			name: "invalid severity",
			alert: Alert{
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
		sub     NotifySubscription
		wantErr bool
	}{
		{
			name: "valid email subscription",
			sub: NotifySubscription{
				Channel:  "email",
				Endpoint: "test@example.com",
				Enabled:  true,
			},
			wantErr: false,
		},
		{
			name: "valid webhook subscription",
			sub: NotifySubscription{
				Channel:  "webhook",
				Endpoint: "",
				Enabled:  true,
			},
			wantErr: false,
		},
		{
			name: "invalid channel",
			sub: NotifySubscription{
				Channel:  "invalid",
				Endpoint: "test@example.com",
				Enabled:  true,
			},
			wantErr: true,
		},
		{
			name: "empty endpoint",
			sub: NotifySubscription{
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
		email   EmailQueue
		wantErr bool
	}{
		{
			name: "valid email",
			email: EmailQueue{
				ToAddr:   "test@example.com",
				Subject:  "Test Subject",
				BodyText: "Test Body",
				State:    "pending",
			},
			wantErr: false,
		},
		{
			name: "invalid email address",
			email: EmailQueue{
				ToAddr:   "invalid-email",
				Subject:  "Test Subject",
				BodyText: "Test Body",
				State:    "pending",
			},
			wantErr: true,
		},
		{
			name: "empty subject",
			email: EmailQueue{
				ToAddr:   "test@example.com",
				Subject:  "",
				BodyText: "Test Body",
				State:    "pending",
			},
			wantErr: true,
		},
		{
			name: "invalid state",
			email: EmailQueue{
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
