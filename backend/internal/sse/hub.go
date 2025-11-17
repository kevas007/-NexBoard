package sse

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"nexboard/internal/models"
)

// Client représente une connexion SSE
type Client struct {
	ID      string
	Channel chan models.SSEEvent
	Request *http.Request
	Writer  http.ResponseWriter
	Done    chan bool
}

// Hub gère toutes les connexions SSE
type Hub struct {
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan models.SSEEvent
	mu         sync.RWMutex
}

// NewHub crée un nouveau hub SSE
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan models.SSEEvent, 100),
	}
}

// Start démarre le hub SSE
func (h *Hub) Start() {
	go h.run()
	go h.pingClients()
}

// run gère les événements du hub
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("SSE client connected: %s", client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Channel)
			}
			h.mu.Unlock()
			log.Printf("SSE client disconnected: %s", client.ID)

		case event := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.Channel <- event:
				default:
					// Client ne peut pas recevoir, le déconnecter
					close(client.Channel)
					delete(h.clients, client.ID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// pingClients envoie un ping périodique pour maintenir les connexions
func (h *Hub) pingClients() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.Broadcast(models.SSEEvent{
				Type: "ping",
				Data: map[string]interface{}{
					"timestamp": time.Now().Unix(),
				},
			})
		}
	}
}

// RegisterClient enregistre un nouveau client SSE
func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

// UnregisterClient désenregistre un client SSE
func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

// Broadcast diffuse un événement à tous les clients
func (h *Hub) Broadcast(event models.SSEEvent) {
	select {
	case h.broadcast <- event:
	default:
		log.Println("SSE broadcast channel full, dropping event")
	}
}

// BroadcastAlert diffuse une nouvelle alerte
func (h *Hub) BroadcastAlert(alert *models.Alert) {
	h.Broadcast(models.SSEEvent{
		Type: "alert",
		Data: alert,
	})
}

// BroadcastAck diffuse un accusé de réception d'alerte
func (h *Hub) BroadcastAck(alertID int) {
	h.Broadcast(models.SSEEvent{
		Type: "ack",
		Data: map[string]interface{}{
			"alert_id": alertID,
		},
	})
}

// ServeSSE gère une connexion SSE
func (h *Hub) ServeSSE(w http.ResponseWriter, r *http.Request) {
	// Configuration des headers SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Cache-Control")

	// Créer un nouveau client
	clientID := fmt.Sprintf("client_%d", time.Now().UnixNano())
	client := &Client{
		ID:      clientID,
		Channel: make(chan models.SSEEvent, 10),
		Request: r,
		Writer:  w,
		Done:    make(chan bool),
	}

	// Enregistrer le client
	h.RegisterClient(client)

	// Envoyer un événement de connexion
	h.sendEvent(w, models.SSEEvent{
		Type: "connected",
		Data: map[string]interface{}{
			"client_id": clientID,
			"timestamp": time.Now().Unix(),
		},
	})

	// Flusher pour envoyer immédiatement
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// Écouter les événements
	go func() {
		defer h.UnregisterClient(client)

		for {
			select {
			case event := <-client.Channel:
				if err := h.sendEvent(w, event); err != nil {
					log.Printf("Error sending SSE event: %v", err)
					return
				}

				if flusher, ok := w.(http.Flusher); ok {
					flusher.Flush()
				}

			case <-r.Context().Done():
				return
			}
		}
	}()

	// Attendre la déconnexion
	<-r.Context().Done()
}

// sendEvent envoie un événement SSE
func (h *Hub) sendEvent(w http.ResponseWriter, event models.SSEEvent) error {
	data, err := json.Marshal(event.Data)
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
	return err
}

// GetClientCount retourne le nombre de clients connectés
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ServeHTTP implémente http.Handler pour le hub SSE
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.ServeSSE(w, r)
}
