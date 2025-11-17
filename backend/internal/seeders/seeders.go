package seeders

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"nexboard/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// SeedDatabase remplit la base de données avec des données de test (uniquement en dev)
func SeedDatabase(db *sql.DB) error {
	log.Println("🌱 Chargement des seeders pour l'environnement de développement...")

	// Vérifier si les utilisateurs existent déjà
	var userCount int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	if err == nil && userCount > 0 {
		log.Println("⚠️  Des utilisateurs existent déjà. Seuls les seeders manquants seront exécutés.")
	} else {
		// Seeders pour les utilisateurs (seulement si aucun utilisateur n'existe)
		if err := seedUsers(db); err != nil {
			return fmt.Errorf("failed to seed users: %w", err)
		}
	}

	// Seeders pour les applications (toujours vérifier et ajouter si manquantes)
	if err := seedApps(db); err != nil {
		return fmt.Errorf("failed to seed apps: %w", err)
	}

	// Vérifier si les alertes existent déjà
	var alertCount int
	err = db.QueryRow("SELECT COUNT(*) FROM alerts").Scan(&alertCount)
	if err == nil && alertCount == 0 {
		// Seeders pour les alertes (seulement si aucune alerte n'existe)
		if err := seedAlerts(db); err != nil {
			return fmt.Errorf("failed to seed alerts: %w", err)
		}
	} else {
		log.Println("⏭️  Des alertes existent déjà, ignorées")
	}

	// Seeders pour les abonnements de notifications
	if err := seedNotificationSubscriptions(db); err != nil {
		return fmt.Errorf("failed to seed notification subscriptions: %w", err)
	}

	// Seeders pour la queue d'emails (pour tester)
	if err := seedEmailQueue(db); err != nil {
		return fmt.Errorf("failed to seed email queue: %w", err)
	}

	log.Println("✅ Seeders chargés avec succès!")
	return nil
}

// seedUsers crée des utilisateurs de test
func seedUsers(db *sql.DB) error {
	users := []struct {
		username string
		email    string
		password string
		role     string
	}{
		{"admin", "admin@nexboard.local", "admin123", "admin"},
		{"user", "user@nexboard.local", "user123", "user"},
		{"viewer", "viewer@nexboard.local", "viewer123", "viewer"},
		{"ops", "ops@nexboard.local", "ops123", "user"},
		{"guest", "guest@nexboard.local", "guest123", "guest"},
	}

	for _, u := range users {
		// Hasher le mot de passe
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash password for %s: %w", u.username, err)
		}

		// Vérifier si l'utilisateur existe déjà
		var exists int
		err = db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", u.username).Scan(&exists)
		if err == nil && exists > 0 {
			log.Printf("⏭️  Utilisateur %s existe déjà, ignoré", u.username)
			continue
		}

		// Insérer l'utilisateur
		_, err = db.Exec(`
			INSERT INTO users (username, email, password_hash, role, active, created_at, updated_at)
			VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
		`, u.username, u.email, string(hashedPassword), u.role)

		if err != nil {
			return fmt.Errorf("failed to insert user %s: %w", u.username, err)
		}

		log.Printf("✅ Utilisateur créé: %s (%s) - mot de passe: %s", u.username, u.role, u.password)
	}

	return nil
}

// seedApps crée des applications de test
func seedApps(db *sql.DB) error {
	apps := []models.CreateAppRequest{
		{
			Name:       "Proxmox VE",
			Protocol:   "https",
			Host:       "pve.example.com",
			Port:       8006,
			Path:       "/",
			Tag:        stringPtr("infra"),
			Icon:       stringPtr("server"),
			HealthPath: "/api2/json/version",
			HealthType: "http",
		},
		{
			Name:       "Pi-hole",
			Protocol:   "http",
			Host:       "pihole.local",
			Port:       80,
			Path:       "/admin",
			Tag:        stringPtr("network"),
			Icon:       stringPtr("shield"),
			HealthPath: "/admin/api.php?summary",
			HealthType: "http",
		},
		{
			Name:       "Nginx Proxy Manager",
			Protocol:   "https",
			Host:       "npm.local",
			Port:       443,
			Path:       "/",
			Tag:        stringPtr("network"),
			Icon:       stringPtr("globe"),
			HealthPath: "/api/status",
			HealthType: "http",
		},
		{
			Name:       "pfSense",
			Protocol:   "https",
			Host:       "pfsense.local",
			Port:       443,
			Path:       "/",
			Tag:        stringPtr("network"),
			Icon:       stringPtr("router"),
			HealthPath: "/",
			HealthType: "http",
		},
		{
			Name:       "Plex Media Server",
			Protocol:   "http",
			Host:       "plex.local",
			Port:       32400,
			Path:       "/web",
			Tag:        stringPtr("media"),
			Icon:       stringPtr("play"),
			HealthPath: "/web",
			HealthType: "http",
		},
		{
			Name:       "Home Assistant",
			Protocol:   "https",
			Host:       "homeassistant.local",
			Port:       8123,
			Path:       "/",
			Tag:        stringPtr("iot"),
			Icon:       stringPtr("home"),
			HealthPath: "/api/",
			HealthType: "http",
		},
		{
			Name:       "Grafana",
			Protocol:   "https",
			Host:       "grafana.local",
			Port:       3000,
			Path:       "/",
			Tag:        stringPtr("monitoring"),
			Icon:       stringPtr("chart"),
			HealthPath: "/api/health",
			HealthType: "http",
		},
		{
			Name:       "Prometheus",
			Protocol:   "http",
			Host:       "prometheus.local",
			Port:       9090,
			Path:       "/",
			Tag:        stringPtr("monitoring"),
			Icon:       stringPtr("activity"),
			HealthPath: "/-/healthy",
			HealthType: "http",
		},
		{
			Name:       "Portainer",
			Protocol:   "https",
			Host:       "portainer.local",
			Port:       9443,
			Path:       "/",
			Tag:        stringPtr("infra"),
			Icon:       stringPtr("container"),
			HealthPath: "/api/status",
			HealthType: "http",
		},
		{
			Name:       "qBittorrent",
			Protocol:   "http",
			Host:       "qbittorrent.local",
			Port:       8080,
			Path:       "/",
			Tag:        stringPtr("media"),
			Icon:       stringPtr("download"),
			HealthPath: "/api/v2/app/version",
			HealthType: "http",
		},
		{
			Name:       "Radarr",
			Protocol:   "http",
			Host:       "radarr.local",
			Port:       7878,
			Path:       "/",
			Tag:        stringPtr("media"),
			Icon:       stringPtr("film"),
			HealthPath: "/api/v3/system/status",
			HealthType: "http",
		},
		{
			Name:       "Sonarr",
			Protocol:   "http",
			Host:       "sonarr.local",
			Port:       8989,
			Path:       "/",
			Tag:        stringPtr("media"),
			Icon:       stringPtr("tv"),
			HealthPath: "/api/v3/system/status",
			HealthType: "http",
		},
	}

	for _, appReq := range apps {
		// Vérifier si l'app existe déjà
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM apps WHERE name = ? AND host = ?", appReq.Name, appReq.Host).Scan(&exists)
		if err == nil && exists > 0 {
			log.Printf("⏭️  Application %s existe déjà, ignorée", appReq.Name)
			continue
		}

		// Créer l'app
		app := &models.App{
			Name:       appReq.Name,
			Protocol:   appReq.Protocol,
			Host:       appReq.Host,
			Port:       appReq.Port,
			Path:       appReq.Path,
			Tag:        appReq.Tag,
			Icon:       appReq.Icon,
			HealthPath: appReq.HealthPath,
			HealthType: appReq.HealthType,
			CreatedAt:  time.Now(),
		}

		_, err = db.Exec(`
			INSERT INTO apps (name, protocol, host, port, path, tag, icon, health_path, health_type, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, app.Name, app.Protocol, app.Host, app.Port, app.Path, app.Tag, app.Icon, app.HealthPath, app.HealthType, app.CreatedAt)

		if err != nil {
			return fmt.Errorf("failed to insert app %s: %w", app.Name, err)
		}

		log.Printf("✅ Application créée: %s", app.Name)
	}

	return nil
}

// seedAlerts crée des alertes de test
func seedAlerts(db *sql.DB) error {
	alerts := []models.CreateAlertRequest{
		{
			Source:   "proxmox",
			Severity: "low",
			Title:    "VM démarrée",
			Message:  "La VM web-server-01 a été démarrée avec succès",
		},
		{
			Source:   "proxmox",
			Severity: "medium",
			Title:    "Utilisation CPU élevée",
			Message:  "Le nœud pve-01 a une utilisation CPU de 85%",
		},
		{
			Source:   "proxmox",
			Severity: "critical",
			Title:    "Nœud hors ligne",
			Message:  "Le nœud pve-02 est hors ligne depuis 5 minutes",
		},
		{
			Source:   "backup",
			Severity: "low",
			Title:    "Sauvegarde terminée",
			Message:  "La sauvegarde de la VM db-01 a été complétée avec succès",
		},
		{
			Source:   "storage",
			Severity: "medium",
			Title:    "Espace disque faible",
			Message:  "Le stockage local-lvm est utilisé à 88%",
		},
		{
			Source:   "proxmox",
			Severity: "low",
			Title:    "LXC démarré",
			Message:  "Le conteneur LXC 101 (nginx) a été démarré",
		},
		{
			Source:   "proxmox",
			Severity: "high",
			Title:    "Utilisation mémoire élevée",
			Message:  "Le nœud pve-01 a une utilisation mémoire de 92%",
		},
		{
			Source:   "network",
			Severity: "medium",
			Title:    "Latence réseau élevée",
			Message:  "La latence réseau vers pve-02 est de 150ms (normal: <50ms)",
		},
		{
			Source:   "backup",
			Severity: "critical",
			Title:    "Échec de sauvegarde",
			Message:  "La sauvegarde de la VM app-03 a échoué: espace disque insuffisant",
		},
		{
			Source:   "storage",
			Severity: "critical",
			Title:    "Stockage saturé",
			Message:  "Le stockage nfs-shared est utilisé à 95% - action requise",
		},
		{
			Source:   "proxmox",
			Severity: "low",
			Title:    "Migration VM réussie",
			Message:  "La VM vm-105 a été migrée de pve-01 vers pve-02 avec succès",
		},
		{
			Source:   "monitoring",
			Severity: "medium",
			Title:    "Prometheus indisponible",
			Message:  "Le service Prometheus n'a pas répondu depuis 2 minutes",
		},
	}

	for i, alertReq := range alerts {
		alert := &models.Alert{
			Source:       alertReq.Source,
			Severity:     alertReq.Severity,
			Title:        alertReq.Title,
			Message:      alertReq.Message,
			Payload:      alertReq.Payload,
			CreatedAt:    time.Now().Add(-time.Duration(i) * time.Hour), // Dates variées (0h, 1h, 2h, etc.)
			Acknowledged: false,
		}

		_, err := db.Exec(`
			INSERT INTO alerts (source, severity, title, message, payload, created_at, acknowledged)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, alert.Source, alert.Severity, alert.Title, alert.Message, alert.Payload, alert.CreatedAt, alert.Acknowledged)

		if err != nil {
			return fmt.Errorf("failed to insert alert: %w", err)
		}
	}

	log.Printf("✅ %d alertes de test créées", len(alerts))
	return nil
}

// seedNotificationSubscriptions crée des abonnements de notifications de test
func seedNotificationSubscriptions(db *sql.DB) error {
	subscriptions := []struct {
		channel  string
		endpoint string
		enabled  bool
	}{
		{
			channel:  "email",
			endpoint: "admin@nexboard.local",
			enabled:  true,
		},
		{
			channel:  "email",
			endpoint: "alerts@nexboard.local",
			enabled:  true,
		},
		{
			channel:  "webhook",
			endpoint: "https://example.com/webhook/placeholder-slack",
			enabled:  false,
		},
		{
			channel:  "webhook",
			endpoint: "https://example.com/webhook/placeholder-discord",
			enabled:  false,
		},
	}

	for _, sub := range subscriptions {
		// Vérifier si l'abonnement existe déjà
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM notify_subscriptions WHERE channel = ? AND endpoint = ?", sub.channel, sub.endpoint).Scan(&exists)
		if err == nil && exists > 0 {
			log.Printf("⏭️  Abonnement %s:%s existe déjà, ignoré", sub.channel, sub.endpoint)
			continue
		}

		// Insérer l'abonnement
		_, err = db.Exec(`
			INSERT INTO notify_subscriptions (channel, endpoint, enabled, created_at)
			VALUES (?, ?, ?, datetime('now'))
		`, sub.channel, sub.endpoint, sub.enabled)

		if err != nil {
			return fmt.Errorf("failed to insert notification subscription: %w", err)
		}

		log.Printf("✅ Abonnement créé: %s -> %s (enabled: %v)", sub.channel, sub.endpoint, sub.enabled)
	}

	log.Printf("✅ %d abonnements de notifications créés", len(subscriptions))
	return nil
}

// seedEmailQueue crée des emails de test dans la queue (pour tester le système d'email)
func seedEmailQueue(db *sql.DB) error {
	emails := []struct {
		toAddr   string
		subject  string
		bodyText string
		state    string
	}{
		{
			toAddr:   "admin@nexboard.local",
			subject:  "Bienvenue sur ProxmoxDash",
			bodyText: "Bienvenue sur ProxmoxDash! Votre dashboard est maintenant configuré.",
			state:    "sent",
		},
		{
			toAddr:   "alerts@nexboard.local",
			subject:  "Alerte: Nœud hors ligne",
			bodyText: "Le nœud pve-02 est hors ligne depuis 5 minutes. Veuillez vérifier.",
			state:    "pending",
		},
		{
			toAddr:   "admin@nexboard.local",
			subject:  "Rapport quotidien - Cluster Proxmox",
			bodyText: "Rapport quotidien du cluster Proxmox:\n- 3 nœuds en ligne\n- 12 VMs actives\n- 8 LXC en cours d'exécution",
			state:    "pending",
		},
	}

	for _, email := range emails {
		// Vérifier si l'email existe déjà
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM email_queue WHERE to_addr = ? AND subject = ?", email.toAddr, email.subject).Scan(&exists)
		if err == nil && exists > 0 {
			log.Printf("⏭️  Email %s existe déjà, ignoré", email.subject)
			continue
		}

		var sentAt interface{}
		if email.state == "sent" {
			sentAt = time.Now().Add(-time.Hour).Format("2006-01-02 15:04:05")
		} else {
			sentAt = nil
		}

		// Insérer l'email
		_, err = db.Exec(`
			INSERT INTO email_queue (to_addr, subject, body_text, state, created_at, sent_at)
			VALUES (?, ?, ?, ?, datetime('now'), ?)
		`, email.toAddr, email.subject, email.bodyText, email.state, sentAt)

		if err != nil {
			return fmt.Errorf("failed to insert email: %w", err)
		}
	}

	log.Printf("✅ %d emails de test créés dans la queue", len(emails))
	return nil
}

// stringPtr retourne un pointeur vers une string
func stringPtr(s string) *string {
	return &s
}
