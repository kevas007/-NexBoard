package email

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"

	"proxmox-dashboard/internal/models"
	"proxmox-dashboard/internal/store"
)

// Config contient la configuration SMTP
type Config struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	TLS      bool
}

// Worker gère l'envoi d'emails
type Worker struct {
	config *Config
	store  *store.Store
	quit   chan bool
}

// NewWorker crée un nouveau worker email
func NewWorker(store *store.Store) *Worker {
	config := &Config{
		Host:     getEnv("SMTP_HOST", "localhost"),
		Port:     getEnvInt("SMTP_PORT", 587),
		Username: getEnv("SMTP_USERNAME", ""),
		Password: getEnv("SMTP_PASSWORD", ""),
		From:     getEnv("SMTP_FROM", "noreply@example.com"),
		TLS:      getEnvBool("SMTP_TLS", true),
	}

	return &Worker{
		config: config,
		store:  store,
		quit:   make(chan bool),
	}
}

// Start démarre le worker email
func (w *Worker) Start() {
	log.Println("Starting email worker...")
	go w.run()
}

// Stop arrête le worker email
func (w *Worker) Stop() {
	w.quit <- true
}

// run est la boucle principale du worker
func (w *Worker) run() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.processQueue()
		case <-w.quit:
			log.Println("Email worker stopped")
			return
		}
	}
}

// processQueue traite la file d'attente des emails
func (w *Worker) processQueue() {
	emails, err := w.store.GetQueuedEmails()
	if err != nil {
		log.Printf("Error getting queued emails: %v", err)
		return
	}

	for _, email := range emails {
		if err := w.sendEmail(*email); err != nil {
			log.Printf("Error sending email %d: %v", email.ID, err)
			w.store.MarkEmailError(email.ID, err.Error())
		} else {
			log.Printf("Email %d sent successfully to %s", email.ID, email.ToAddr)
			w.store.MarkEmailSent(email.ID)
		}
	}
}

// sendEmail envoie un email
func (w *Worker) sendEmail(email models.EmailQueue) error {
	// Construire l'adresse du serveur
	addr := fmt.Sprintf("%s:%d", w.config.Host, w.config.Port)

	// Préparer le message
	msg := w.buildMessage(email.ToAddr, email.Subject, email.BodyText)

	// Authentification si nécessaire
	var auth smtp.Auth
	if w.config.Username != "" && w.config.Password != "" {
		auth = smtp.PlainAuth("", w.config.Username, w.config.Password, w.config.Host)
	}

	// Envoyer l'email
	err := smtp.SendMail(addr, auth, w.config.From, []string{email.ToAddr}, []byte(msg))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// buildMessage construit le message email
func (w *Worker) buildMessage(to, subject, body string) string {
	msg := fmt.Sprintf("From: %s\r\n", w.config.From)
	msg += fmt.Sprintf("To: %s\r\n", to)
	msg += fmt.Sprintf("Subject: %s\r\n", subject)
	msg += "Content-Type: text/plain; charset=UTF-8\r\n"
	msg += "\r\n"
	msg += body
	return msg
}

// SendTestEmail envoie un email de test
func (w *Worker) SendTestEmail(to string) error {
	subject := "Test de notification - ProxmoxDash"
	body := fmt.Sprintf(`Bonjour,

Ceci est un email de test envoyé depuis ProxmoxDash.

Si vous recevez ce message, la configuration SMTP fonctionne correctement.

Détails:
- Serveur SMTP: %s:%d
- Envoyé le: %s
- Destinataire: %s

Cordialement,
L'équipe ProxmoxDash
`, w.config.Host, w.config.Port, time.Now().Format("2006-01-02 15:04:05"), to)

	email := &models.EmailQueue{
		ToAddr:    to,
		Subject:   subject,
		BodyText:  body,
		State:     "pending",
		CreatedAt: time.Now(),
	}
	return w.store.EnqueueEmail(email)
}

// SendAlertEmail envoie un email d'alerte
func (w *Worker) SendAlertEmail(to string, alert *models.Alert) error {
	subject := fmt.Sprintf("[%s] %s", strings.ToUpper(alert.Severity), alert.Title)

	body := fmt.Sprintf(`Nouvelle alerte ProxmoxDash

Titre: %s
Sévérité: %s
Source: %s
Message: %s

Détails:
- ID de l'alerte: %d
- Créée le: %s

Pour accuser réception de cette alerte, connectez-vous au dashboard ProxmoxDash.

Cordialement,
Système de monitoring ProxmoxDash
`, alert.Title, alert.Severity, alert.Source, alert.Message,
		alert.ID, alert.CreatedAt.Format("2006-01-02 15:04:05"))

	email := &models.EmailQueue{
		ToAddr:    to,
		Subject:   subject,
		BodyText:  body,
		State:     "pending",
		CreatedAt: time.Now(),
	}
	return w.store.EnqueueEmail(email)
}

// Fonctions utilitaires pour les variables d'environnement

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
