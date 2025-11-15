package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"proxmox-dashboard/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// Service gère l'authentification
type Service struct {
	db *sql.DB
}

// NewService crée un nouveau service d'authentification
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Login authentifie un utilisateur
func (s *Service) Login(req models.LoginRequest, ipAddress, userAgent string) (*models.LoginResponse, error) {
	// Récupérer l'utilisateur par nom d'utilisateur
	user, err := s.GetUserByUsername(req.Username)
	if err != nil {
		return nil, fmt.Errorf("utilisateur non trouvé")
	}

	// Vérifier si l'utilisateur est actif
	if !user.Active {
		return nil, fmt.Errorf("compte désactivé")
	}

	// Vérifier le mot de passe
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("mot de passe incorrect")
	}

	// Générer un token de session
	token, err := s.generateToken()
	if err != nil {
		return nil, fmt.Errorf("erreur lors de la génération du token")
	}

	// Créer la session
	sessionID, err := s.generateSessionID()
	if err != nil {
		return nil, fmt.Errorf("erreur lors de la génération de l'ID de session")
	}

	expiresAt := time.Now().Add(24 * time.Hour) // Session valide 24h

	session := models.UserSession{
		ID:        sessionID,
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: expiresAt,
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}

	if err := s.CreateSession(session); err != nil {
		return nil, fmt.Errorf("erreur lors de la création de la session")
	}

	// Mettre à jour la dernière connexion
	now := time.Now()
	user.LastLogin = &now
	s.UpdateLastLogin(user.ID, now)

	// Masquer le mot de passe dans la réponse
	user.Password = ""

	return &models.LoginResponse{
		Token:     token,
		User:      *user,
		ExpiresAt: expiresAt,
	}, nil
}

// ValidateToken valide un token et retourne l'utilisateur associé
func (s *Service) ValidateToken(token string) (*models.User, error) {
	// Récupérer la session par token
	session, err := s.GetSessionByToken(token)
	if err != nil {
		return nil, fmt.Errorf("token invalide")
	}

	// Vérifier l'expiration
	if time.Now().After(session.ExpiresAt) {
		s.DeleteSession(session.ID)
		return nil, fmt.Errorf("token expiré")
	}

	// Récupérer l'utilisateur
	user, err := s.GetUserByID(session.UserID)
	if err != nil {
		return nil, fmt.Errorf("utilisateur non trouvé")
	}

	// Vérifier si l'utilisateur est toujours actif
	if !user.Active {
		s.DeleteSession(session.ID)
		return nil, fmt.Errorf("compte désactivé")
	}

	// Masquer le mot de passe
	user.Password = ""

	return user, nil
}

// Logout déconnecte un utilisateur
func (s *Service) Logout(token string) error {
	session, err := s.GetSessionByToken(token)
	if err != nil {
		return nil // Token déjà invalide
	}

	return s.DeleteSession(session.ID)
}

// CreateUser crée un nouveau utilisateur
func (s *Service) CreateUser(req models.CreateUserRequest) (*models.User, error) {
	// Valider le rôle
	if !req.Role.IsValid() {
		return nil, fmt.Errorf("rôle invalide")
	}

	// Hasher le mot de passe
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("erreur lors du hashage du mot de passe")
	}

	// Insérer l'utilisateur
	result, err := s.db.Exec(`
		INSERT INTO users (username, email, password_hash, role)
		VALUES (?, ?, ?, ?)
	`, req.Username, req.Email, string(hashedPassword), req.Role)

	if err != nil {
		return nil, fmt.Errorf("erreur lors de la création de l'utilisateur: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return s.GetUserByID(int(id))
}

// GetUserByID récupère un utilisateur par ID
func (s *Service) GetUserByID(id int) (*models.User, error) {
	var user models.User
	var lastLogin sql.NullString
	var createdAt, updatedAt string

	err := s.db.QueryRow(`
		SELECT id, username, email, password_hash, role, active, last_login, created_at, updated_at
		FROM users WHERE id = ?
	`, id).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.Role,
		&user.Active, &lastLogin, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	// Convertir les dates
	user.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	user.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAt)

	if lastLogin.Valid {
		t, _ := time.Parse("2006-01-02 15:04:05", lastLogin.String)
		user.LastLogin = &t
	}

	return &user, nil
}

// GetUserByUsername récupère un utilisateur par nom d'utilisateur
func (s *Service) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	var lastLogin sql.NullString
	var createdAt, updatedAt string

	err := s.db.QueryRow(`
		SELECT id, username, email, password_hash, role, active, last_login, created_at, updated_at
		FROM users WHERE username = ?
	`, username).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.Role,
		&user.Active, &lastLogin, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	// Convertir les dates
	user.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	user.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAt)

	if lastLogin.Valid {
		t, _ := time.Parse("2006-01-02 15:04:05", lastLogin.String)
		user.LastLogin = &t
	}

	return &user, nil
}

// ListUsers liste tous les utilisateurs
func (s *Service) ListUsers() ([]models.User, error) {
	rows, err := s.db.Query(`
		SELECT id, username, email, role, active, last_login, created_at, updated_at
		FROM users ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var lastLogin sql.NullString
		var createdAt, updatedAt string

		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role,
			&user.Active, &lastLogin, &createdAt, &updatedAt)
		if err != nil {
			return nil, err
		}

		// Convertir les dates
		user.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
		user.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAt)

		if lastLogin.Valid {
			t, _ := time.Parse("2006-01-02 15:04:05", lastLogin.String)
			user.LastLogin = &t
		}

		users = append(users, user)
	}

	return users, rows.Err()
}

// CreateSession crée une nouvelle session
func (s *Service) CreateSession(session models.UserSession) error {
	_, err := s.db.Exec(`
		INSERT INTO user_sessions (id, user_id, token, expires_at, ip_address, user_agent)
		VALUES (?, ?, ?, ?, ?, ?)
	`, session.ID, session.UserID, session.Token, session.ExpiresAt.Format("2006-01-02 15:04:05"),
		session.IPAddress, session.UserAgent)

	return err
}

// GetSessionByToken récupère une session par token
func (s *Service) GetSessionByToken(token string) (*models.UserSession, error) {
	var session models.UserSession
	var createdAt, expiresAt string

	err := s.db.QueryRow(`
		SELECT id, user_id, token, expires_at, created_at, ip_address, user_agent
		FROM user_sessions WHERE token = ?
	`, token).Scan(&session.ID, &session.UserID, &session.Token, &expiresAt,
		&createdAt, &session.IPAddress, &session.UserAgent)

	if err != nil {
		return nil, err
	}

	// Convertir les dates
	session.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	session.ExpiresAt, _ = time.Parse("2006-01-02 15:04:05", expiresAt)

	return &session, nil
}

// DeleteSession supprime une session
func (s *Service) DeleteSession(sessionID string) error {
	_, err := s.db.Exec("DELETE FROM user_sessions WHERE id = ?", sessionID)
	return err
}

// UpdateLastLogin met à jour la dernière connexion
func (s *Service) UpdateLastLogin(userID int, lastLogin time.Time) error {
	_, err := s.db.Exec(`
		UPDATE users SET last_login = ?, updated_at = datetime('now') WHERE id = ?
	`, lastLogin.Format("2006-01-02 15:04:05"), userID)
	return err
}

// CleanExpiredSessions supprime les sessions expirées
func (s *Service) CleanExpiredSessions() error {
	_, err := s.db.Exec(`
		DELETE FROM user_sessions WHERE expires_at < datetime('now')
	`)
	return err
}

// generateToken génère un token aléatoire
func (s *Service) generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// generateSessionID génère un ID de session aléatoire
func (s *Service) generateSessionID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GetClientIP récupère l'IP réelle du client
func GetClientIP(r *http.Request) string {
	// Vérifier les headers de proxy
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return forwarded
	}

	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	return r.RemoteAddr
}
