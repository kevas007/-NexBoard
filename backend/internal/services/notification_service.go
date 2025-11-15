package services

import (
	"fmt"
	"time"

	"proxmox-dashboard/internal/models"
	"proxmox-dashboard/internal/store"
)

// NotificationService gère la logique métier des notifications
type NotificationService struct {
	store *store.Store
}

// NewNotificationService crée une nouvelle instance de NotificationService
func NewNotificationService(store *store.Store) *NotificationService {
	return &NotificationService{store: store}
}

// Subscribe crée un nouvel abonnement aux notifications
func (s *NotificationService) Subscribe(req models.SubscribeRequest) (*models.NotifySubscription, error) {
	sub := &models.NotifySubscription{
		Channel:   req.Channel,
		Endpoint:  req.Endpoint,
		Enabled:   true,
		CreatedAt: time.Now(),
	}

	if err := sub.Validate(); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	if err := s.store.CreateNotificationSubscription(sub); err != nil {
		return nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	return sub, nil
}

// GetSubscriptions récupère tous les abonnements
func (s *NotificationService) GetSubscriptions() ([]*models.NotifySubscription, error) {
	return s.store.GetNotificationSubscriptions()
}

// SendTestEmail envoie un email de test
func (s *NotificationService) SendTestEmail(req models.NotifyTestRequest) error {
	email := &models.EmailQueue{
		ToAddr:    req.To,
		Subject:   "Test Email from ProxmoxDash",
		BodyText:  "This is a test email to verify your notification settings.",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := s.store.CreateEmailQueue(email); err != nil {
		return fmt.Errorf("failed to create test email: %w", err)
	}

	return nil
}

// GetPendingEmails récupère les emails en attente
func (s *NotificationService) GetPendingEmails() ([]*models.EmailQueue, error) {
	return s.store.GetPendingEmails()
}

// UpdateEmailStatus met à jour le statut d'un email
func (s *NotificationService) UpdateEmailStatus(id int, status string) error {
	return s.store.UpdateEmailStatus(id, status)
}
