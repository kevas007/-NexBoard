package models

import (
	"time"
)

// UserRole définit les rôles utilisateur
type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleUser   UserRole = "user"
	RoleViewer UserRole = "viewer"
	RoleGuest  UserRole = "guest"
)

// User représente un utilisateur du système
type User struct {
	ID        int        `json:"id" db:"id"`
	Username  string     `json:"username" db:"username"`
	Email     string     `json:"email" db:"email"`
	Password  string     `json:"-" db:"password_hash"` // Ne pas exposer dans JSON
	Role      UserRole   `json:"role" db:"role"`
	Active    bool       `json:"active" db:"active"`
	LastLogin *time.Time `json:"last_login" db:"last_login"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
}

// UserSession représente une session utilisateur
type UserSession struct {
	ID        string    `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Token     string    `json:"token" db:"token"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	IPAddress string    `json:"ip_address" db:"ip_address"`
	UserAgent string    `json:"user_agent" db:"user_agent"`
}

// LoginRequest représente une requête de connexion
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse représente une réponse de connexion
type LoginResponse struct {
	Token     string    `json:"token"`
	User      User      `json:"user"`
	ExpiresAt time.Time `json:"expires_at"`
}

// CreateUserRequest représente une requête de création d'utilisateur
type CreateUserRequest struct {
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Password string   `json:"password"`
	Role     UserRole `json:"role"`
}

// UpdateUserRequest représente une requête de mise à jour d'utilisateur
type UpdateUserRequest struct {
	Username *string   `json:"username,omitempty"`
	Email    *string   `json:"email,omitempty"`
	Password *string   `json:"password,omitempty"`
	Role     *UserRole `json:"role,omitempty"`
	Active   *bool     `json:"active,omitempty"`
}

// ChangePasswordRequest représente une requête de changement de mot de passe
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// Permission représente une permission système
type Permission struct {
	Resource string `json:"resource"` // ex: "apps", "alerts", "users"
	Action   string `json:"action"`   // ex: "read", "write", "delete"
}

// RolePermissions définit les permissions par rôle
var RolePermissions = map[UserRole][]Permission{
	RoleAdmin: {
		// Accès complet à tout
		{Resource: "*", Action: "*"},
	},
	RoleUser: {
		// Gestion des applications et alertes
		{Resource: "apps", Action: "read"},
		{Resource: "apps", Action: "write"},
		{Resource: "alerts", Action: "read"},
		{Resource: "alerts", Action: "write"},
		{Resource: "health", Action: "read"},
		{Resource: "notifications", Action: "read"},
		{Resource: "profile", Action: "read"},
		{Resource: "profile", Action: "write"},
	},
	RoleViewer: {
		// Lecture seule
		{Resource: "apps", Action: "read"},
		{Resource: "alerts", Action: "read"},
		{Resource: "health", Action: "read"},
		{Resource: "profile", Action: "read"},
	},
	RoleGuest: {
		// Accès très limité
		{Resource: "health", Action: "read"},
	},
}

// HasPermission vérifie si un rôle a une permission spécifique
func (r UserRole) HasPermission(resource, action string) bool {
	permissions, exists := RolePermissions[r]
	if !exists {
		return false
	}

	for _, perm := range permissions {
		// Accès complet (admin)
		if perm.Resource == "*" && perm.Action == "*" {
			return true
		}
		// Ressource spécifique avec action wildcard
		if perm.Resource == resource && perm.Action == "*" {
			return true
		}
		// Correspondance exacte
		if perm.Resource == resource && perm.Action == action {
			return true
		}
	}
	return false
}

// IsValid vérifie si le rôle est valide
func (r UserRole) IsValid() bool {
	switch r {
	case RoleAdmin, RoleUser, RoleViewer, RoleGuest:
		return true
	default:
		return false
	}
}

// String retourne la représentation string du rôle
func (r UserRole) String() string {
	return string(r)
}
