package store

import (
	"database/sql"
	"fmt"
	"strings"

	"nexboard/internal/models"

	_ "modernc.org/sqlite"
)

// Store représente la couche d'accès aux données
type Store struct {
	db *sql.DB
}

// NewStore crée une nouvelle instance de Store
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Close ferme la connexion à la base de données
func (s *Store) Close() error {
	return s.db.Close()
}

// Migrate exécute les migrations de base de données
func (s *Store) Migrate() error {
	// Créer la table apps
	appsSQL := `
	CREATE TABLE IF NOT EXISTS apps (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		protocol TEXT NOT NULL,
		host TEXT NOT NULL,
		port INTEGER NOT NULL,
		path TEXT NOT NULL,
		tag TEXT,
		icon TEXT,
		health_path TEXT NOT NULL,
		health_type TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := s.db.Exec(appsSQL); err != nil {
		return fmt.Errorf("failed to create apps table: %w", err)
	}

	// Migration: Ajouter les colonnes de liaison aux ressources (si elles n'existent pas)
	migrationSQL := []string{
		"ALTER TABLE apps ADD COLUMN resource_type TEXT NULL;",
		"ALTER TABLE apps ADD COLUMN resource_id TEXT NULL;",
		"ALTER TABLE apps ADD COLUMN resource_node TEXT NULL;",
	}

	for _, sql := range migrationSQL {
		// SQLite ne supporte pas "IF NOT EXISTS" pour ALTER TABLE ADD COLUMN
		// On ignore les erreurs si la colonne existe déjà
		_, err := s.db.Exec(sql)
		if err != nil {
			// Ignorer l'erreur si la colonne existe déjà (erreur: duplicate column name)
			// C'est acceptable car cela signifie que la migration a déjà été exécutée
			errMsg := err.Error()
			if !strings.Contains(errMsg, "duplicate column") && !strings.Contains(errMsg, "already exists") {
				// Log mais ne pas échouer si c'est juste que la colonne existe déjà
				fmt.Printf("Migration note (peut être ignorée): %v\n", err)
			}
		}
	}

	// Créer la table alerts
	alertsSQL := `
	CREATE TABLE IF NOT EXISTS alerts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		source TEXT NOT NULL,
		severity TEXT NOT NULL,
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		payload TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		acknowledged BOOLEAN NOT NULL DEFAULT FALSE
	);`

	if _, err := s.db.Exec(alertsSQL); err != nil {
		return fmt.Errorf("failed to create alerts table: %w", err)
	}

	// Créer la table notify_subscriptions
	subscriptionsSQL := `
	CREATE TABLE IF NOT EXISTS notify_subscriptions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		channel TEXT NOT NULL,
		endpoint TEXT NOT NULL,
		enabled BOOLEAN NOT NULL DEFAULT TRUE,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := s.db.Exec(subscriptionsSQL); err != nil {
		return fmt.Errorf("failed to create notify_subscriptions table: %w", err)
	}

	// Créer la table email_queue
	emailQueueSQL := `
	CREATE TABLE IF NOT EXISTS email_queue (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		to_addr TEXT NOT NULL,
		subject TEXT NOT NULL,
		body_text TEXT NOT NULL,
		state TEXT NOT NULL DEFAULT 'pending',
		last_error TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		sent_at DATETIME
	);`

	if _, err := s.db.Exec(emailQueueSQL); err != nil {
		return fmt.Errorf("failed to create email_queue table: %w", err)
	}

	// Créer la table users (authentification)
	usersSQL := `
	CREATE TABLE IF NOT EXISTS users (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		username     TEXT UNIQUE NOT NULL,
		email        TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role         TEXT NOT NULL DEFAULT 'user',
		active       INTEGER DEFAULT 1,
		last_login   TEXT NULL,
		created_at   TEXT DEFAULT (datetime('now')),
		updated_at   TEXT DEFAULT (datetime('now'))
	);`

	if _, err := s.db.Exec(usersSQL); err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	// Créer la table user_sessions
	sessionsSQL := `
	CREATE TABLE IF NOT EXISTS user_sessions (
		id         TEXT PRIMARY KEY,
		user_id    INTEGER NOT NULL,
		token      TEXT UNIQUE NOT NULL,
		expires_at TEXT NOT NULL,
		created_at TEXT DEFAULT (datetime('now')),
		ip_address TEXT NULL,
		user_agent TEXT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);`

	if _, err := s.db.Exec(sessionsSQL); err != nil {
		return fmt.Errorf("failed to create user_sessions table: %w", err)
	}

	// Créer les index pour les utilisateurs
	indexesSQL := []string{
		"CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);",
		"CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
		"CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);",
		"CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);",
		"CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);",
		"CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);",
	}

	for _, indexSQL := range indexesSQL {
		if _, err := s.db.Exec(indexSQL); err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	return nil
}

// ClearDatabase vide complètement toutes les tables de la base de données sans recréer de données
func (s *Store) ClearDatabase() error {
	// Liste de toutes les tables à vider
	tables := []string{
		"email_queue",
		"notify_subscriptions",
		"alerts",
		"apps",
		"user_sessions",
		"users",
	}

	// Vider chaque table
	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM %s", table)
		if _, err := s.db.Exec(query); err != nil {
			return fmt.Errorf("failed to clear table %s: %w", table, err)
		}
	}

	// Réinitialiser les séquences AUTOINCREMENT
	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM sqlite_sequence WHERE name='%s'", table)
		if _, err := s.db.Exec(query); err != nil {
			// Ignorer les erreurs pour sqlite_sequence car certaines tables peuvent ne pas avoir de séquence
			continue
		}
	}

	// Ne pas recréer de données - la base reste vide
	return nil
}

// CreateApp crée une nouvelle application
func (s *Store) CreateApp(app *models.App) error {
	query := `INSERT INTO apps (name, protocol, host, port, path, tag, icon, health_path, health_type, resource_type, resource_id, resource_node, created_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := s.db.Exec(query, app.Name, app.Protocol, app.Host, app.Port, app.Path,
		app.Tag, app.Icon, app.HealthPath, app.HealthType, app.ResourceType, app.ResourceID, app.ResourceNode, app.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create app: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert ID: %w", err)
	}

	app.ID = int(id)
	return nil
}

// GetApp récupère une application par ID
func (s *Store) GetApp(id int) (*models.App, error) {
	query := `SELECT id, name, protocol, host, port, path, tag, icon, health_path, health_type, resource_type, resource_id, resource_node, created_at
			  FROM apps WHERE id = ?`

	row := s.db.QueryRow(query, id)

	app := &models.App{}
	err := row.Scan(&app.ID, &app.Name, &app.Protocol, &app.Host, &app.Port, &app.Path,
		&app.Tag, &app.Icon, &app.HealthPath, &app.HealthType, &app.ResourceType, &app.ResourceID, &app.ResourceNode, &app.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get app: %w", err)
	}

	return app, nil
}

// GetApps récupère toutes les applications
func (s *Store) GetApps() ([]*models.App, error) {
	query := `SELECT id, name, protocol, host, port, path, tag, icon, health_path, health_type, resource_type, resource_id, resource_node, created_at
			  FROM apps ORDER BY created_at DESC`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get apps: %w", err)
	}
	defer rows.Close()

	var apps []*models.App
	for rows.Next() {
		app := &models.App{}
		err := rows.Scan(&app.ID, &app.Name, &app.Protocol, &app.Host, &app.Port, &app.Path,
			&app.Tag, &app.Icon, &app.HealthPath, &app.HealthType, &app.ResourceType, &app.ResourceID, &app.ResourceNode, &app.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan app: %w", err)
		}
		apps = append(apps, app)
	}

	return apps, nil
}

// UpdateApp met à jour une application
func (s *Store) UpdateApp(id int, req models.CreateAppRequest) error {
	query := `UPDATE apps SET name = ?, protocol = ?, host = ?, port = ?, path = ?,
			  tag = ?, icon = ?, health_path = ?, health_type = ?, resource_type = ?, resource_id = ?, resource_node = ? WHERE id = ?`

	_, err := s.db.Exec(query, req.Name, req.Protocol, req.Host, req.Port, req.Path,
		req.Tag, req.Icon, req.HealthPath, req.HealthType, req.ResourceType, req.ResourceID, req.ResourceNode, id)
	if err != nil {
		return fmt.Errorf("failed to update app: %w", err)
	}

	return nil
}

// DeleteApp supprime une application
func (s *Store) DeleteApp(id int) error {
	query := `DELETE FROM apps WHERE id = ?`

	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete app: %w", err)
	}

	return nil
}

// CreateAlert crée une nouvelle alerte
func (s *Store) CreateAlert(alert *models.Alert) error {
	query := `INSERT INTO alerts (source, severity, title, message, payload, created_at, acknowledged)
			  VALUES (?, ?, ?, ?, ?, ?, ?)`

	result, err := s.db.Exec(query, alert.Source, alert.Severity, alert.Title, alert.Message,
		alert.Payload, alert.CreatedAt, alert.Acknowledged)
	if err != nil {
		return fmt.Errorf("failed to create alert: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert ID: %w", err)
	}

	alert.ID = int(id)
	return nil
}

// GetAlerts récupère toutes les alertes
func (s *Store) GetAlerts() ([]*models.Alert, error) {
	query := `SELECT id, source, severity, title, message, payload, created_at, acknowledged
			  FROM alerts ORDER BY created_at DESC`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get alerts: %w", err)
	}
	defer rows.Close()

	var alerts []*models.Alert
	for rows.Next() {
		alert := &models.Alert{}
		err := rows.Scan(&alert.ID, &alert.Source, &alert.Severity, &alert.Title, &alert.Message,
			&alert.Payload, &alert.CreatedAt, &alert.Acknowledged)
		if err != nil {
			return nil, fmt.Errorf("failed to scan alert: %w", err)
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// AcknowledgeAlert marque une alerte comme acquittée
func (s *Store) AcknowledgeAlert(id int) error {
	query := `UPDATE alerts SET acknowledged = 1 WHERE id = ?`
	_, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to acknowledge alert: %w", err)
	}
	return nil
}

// AcknowledgeAllAlerts marque toutes les alertes comme acquittées
func (s *Store) AcknowledgeAllAlerts() error {
	query := `UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0`
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to acknowledge all alerts: %w", err)
	}
	return nil
}

// CreateNotificationSubscription crée un nouvel abonnement
func (s *Store) CreateNotificationSubscription(sub *models.NotifySubscription) error {
	query := `INSERT INTO notify_subscriptions (channel, endpoint, enabled, created_at)
			  VALUES (?, ?, ?, ?)`

	result, err := s.db.Exec(query, sub.Channel, sub.Endpoint, sub.Enabled, sub.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create notification subscription: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert ID: %w", err)
	}

	sub.ID = int(id)
	return nil
}

// GetNotificationSubscriptions récupère tous les abonnements
func (s *Store) GetNotificationSubscriptions() ([]*models.NotifySubscription, error) {
	query := `SELECT id, channel, endpoint, enabled, created_at
			  FROM notify_subscriptions ORDER BY created_at DESC`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get notification subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []*models.NotifySubscription
	for rows.Next() {
		sub := &models.NotifySubscription{}
		err := rows.Scan(&sub.ID, &sub.Channel, &sub.Endpoint, &sub.Enabled, &sub.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}
		subs = append(subs, sub)
	}

	return subs, nil
}

// CreateEmailQueue crée un nouvel email en queue
func (s *Store) CreateEmailQueue(email *models.EmailQueue) error {
	query := `INSERT INTO email_queue (to_addr, subject, body_text, state, created_at)
			  VALUES (?, ?, ?, ?, ?)`

	result, err := s.db.Exec(query, email.ToAddr, email.Subject, email.BodyText, email.State, email.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create email queue: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert ID: %w", err)
	}

	email.ID = int(id)
	return nil
}

// GetPendingEmails récupère les emails en attente
func (s *Store) GetPendingEmails() ([]*models.EmailQueue, error) {
	query := `SELECT id, to_addr, subject, body_text, state, last_error, created_at, sent_at
			  FROM email_queue WHERE state = 'pending' ORDER BY created_at ASC`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending emails: %w", err)
	}
	defer rows.Close()

	var emails []*models.EmailQueue
	for rows.Next() {
		email := &models.EmailQueue{}
		err := rows.Scan(&email.ID, &email.ToAddr, &email.Subject, &email.BodyText,
			&email.State, &email.LastError, &email.CreatedAt, &email.SentAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan email: %w", err)
		}
		emails = append(emails, email)
	}

	return emails, nil
}

// UpdateEmailStatus met à jour le statut d'un email
func (s *Store) UpdateEmailStatus(id int, status string) error {
	query := `UPDATE email_queue SET state = ? WHERE id = ?`

	_, err := s.db.Exec(query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update email status: %w", err)
	}

	return nil
}

// GetEmailQueue récupère un email par ID
func (s *Store) GetEmailQueue(id int) (*models.EmailQueue, error) {
	query := `SELECT id, to_addr, subject, body_text, state, last_error, created_at, sent_at
			  FROM email_queue WHERE id = ?`

	row := s.db.QueryRow(query, id)

	email := &models.EmailQueue{}
	err := row.Scan(&email.ID, &email.ToAddr, &email.Subject, &email.BodyText,
		&email.State, &email.LastError, &email.CreatedAt, &email.SentAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get email: %w", err)
	}

	return email, nil
}

// GetQueuedEmails récupère les emails en queue (alias pour GetPendingEmails)
func (s *Store) GetQueuedEmails() ([]*models.EmailQueue, error) {
	return s.GetPendingEmails()
}

// MarkEmailError marque un email comme ayant une erreur
func (s *Store) MarkEmailError(id int, errorMsg string) error {
	query := `UPDATE email_queue SET state = 'error', last_error = ? WHERE id = ?`
	_, err := s.db.Exec(query, errorMsg, id)
	return err
}

// MarkEmailSent marque un email comme envoyé
func (s *Store) MarkEmailSent(id int) error {
	query := `UPDATE email_queue SET state = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := s.db.Exec(query, id)
	return err
}

// EnqueueEmail ajoute un email à la queue (alias pour CreateEmailQueue)
func (s *Store) EnqueueEmail(email *models.EmailQueue) error {
	return s.CreateEmailQueue(email)
}
