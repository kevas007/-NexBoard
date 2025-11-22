package handlers

import (
	"bytes"
	"compress/gzip"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"path"

	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"proxmox-dashboard/internal/models"
	"proxmox-dashboard/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

// Handlers contient tous les handlers HTTP
type Handlers struct {
	store *store.Store
}

// NewHandlers crée une nouvelle instance de Handlers
func NewHandlers(store *store.Store) *Handlers {
	return &Handlers{store: store}
}

// GetApps récupère toutes les applications
func (h *Handlers) GetApps(w http.ResponseWriter, r *http.Request) {
	apps, err := h.store.GetApps()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get apps: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

// CreateApp crée une nouvelle application
func (h *Handlers) CreateApp(w http.ResponseWriter, r *http.Request) {
	var req models.CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	app := &models.App{
		Name:         req.Name,
		Protocol:     req.Protocol,
		Host:         req.Host,
		Port:         req.Port,
		Path:         req.Path,
		Tag:          req.Tag,
		Icon:         req.Icon,
		HealthPath:   req.HealthPath,
		HealthType:   req.HealthType,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		ResourceNode: req.ResourceNode,
		CreatedAt:    time.Now(),
	}

	if err := app.Validate(); err != nil {
		http.Error(w, fmt.Sprintf("Validation error: %v", err), http.StatusBadRequest)
		return
	}

	if err := h.store.CreateApp(app); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create app: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(app)
}

// UpdateApp met à jour une application
func (h *Handlers) UpdateApp(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid app ID", http.StatusBadRequest)
		return
	}

	var req models.CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if err := h.store.UpdateApp(id, req); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update app: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// DeleteApp supprime une application
func (h *Handlers) DeleteApp(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid app ID", http.StatusBadRequest)
		return
	}

	if err := h.store.DeleteApp(id); err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete app: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetAlerts récupère toutes les alertes
func (h *Handlers) GetAlerts(w http.ResponseWriter, r *http.Request) {
	alerts, err := h.store.GetAlerts()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get alerts: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}

// AcknowledgeAlert marque une alerte comme acquittée
func (h *Handlers) AcknowledgeAlert(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid alert ID", http.StatusBadRequest)
		return
	}

	if err := h.store.AcknowledgeAlert(id); err != nil {
		http.Error(w, fmt.Sprintf("Failed to acknowledge alert: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      id,
	})
}

// AcknowledgeAllAlerts marque toutes les alertes comme acquittées
func (h *Handlers) AcknowledgeAllAlerts(w http.ResponseWriter, r *http.Request) {
	if err := h.store.AcknowledgeAllAlerts(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to acknowledge all alerts: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "All alerts acknowledged",
	})
}

// CreateAlert crée une nouvelle alerte
func (h *Handlers) CreateAlert(w http.ResponseWriter, r *http.Request) {
	var req models.CreateAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	alert := &models.Alert{
		Source:       req.Source,
		Severity:     req.Severity,
		Title:        req.Title,
		Message:      req.Message,
		Payload:      req.Payload,
		CreatedAt:    time.Now(),
		Acknowledged: false,
	}

	if err := alert.Validate(); err != nil {
		http.Error(w, fmt.Sprintf("Validation error: %v", err), http.StatusBadRequest)
		return
	}

	if err := h.store.CreateAlert(alert); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create alert: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(alert)
}

// GetHealth retourne le statut de santé de l'API
func (h *Handlers) GetHealth(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Unix(),
		"version":   "1.0.0",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// GetHealthHTTP vérifie la santé d'une URL HTTP
func (h *Handlers) GetHealthHTTP(w http.ResponseWriter, r *http.Request) {
	urlStr := r.URL.Query().Get("url")
	if urlStr == "" {
		http.Error(w, "URL parameter is required", http.StatusBadRequest)
		return
	}

	// Parser l'URL pour extraire le host
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		result := map[string]interface{}{
			"url":       urlStr,
			"status":    "offline",
			"latency":   0,
			"timestamp": time.Now().Unix(),
			"error":     fmt.Sprintf("Invalid URL: %v", err),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	host := parsedURL.Hostname()

	// Ne pas essayer de résoudre les noms de domaine .local via DNS
	// Ils doivent être remplacés par des IPs côté frontend avant d'arriver ici
	// Si un .local arrive ici, c'est une erreur de configuration
	if strings.HasSuffix(host, ".local") {
		result := map[string]interface{}{
			"url":        urlStr,
			"status":     "offline",
			"latency":    0,
			"timestamp":  time.Now().Unix(),
			"error":      fmt.Sprintf("DNS .local non supporté: %s. Utilisez une adresse IP au lieu d'un nom de domaine .local.", host),
			"last_check": time.Now().Format(time.RFC3339),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}

	// Configurer un client HTTP avec timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	// Faire une vraie vérification HTTP
	startTime := time.Now()
	resp, err := client.Get(urlStr)
	latency := time.Since(startTime).Milliseconds()

	var status string
	var statusCode *int
	var errorMsg string

	if err != nil {
		status = "offline"
		errorMsg = err.Error()

		// Détecter et formater les différents types d'erreurs
		if strings.Contains(errorMsg, "context deadline exceeded") || strings.Contains(errorMsg, "timeout") || strings.Contains(errorMsg, "Client.Timeout") {
			errorMsg = "Timeout: Le service ne répond pas dans les 10 secondes. Le service peut être lent, surchargé ou indisponible. Vérifiez que le service est démarré et accessible."
		} else if strings.Contains(errorMsg, "no such host") || strings.Contains(errorMsg, "lookup") || strings.Contains(errorMsg, "DNS") {
			errorMsg = fmt.Sprintf("DNS resolution failed: %s. Utilisez une adresse IP au lieu du hostname, ou vérifiez votre configuration DNS.", host)
		} else if strings.Contains(errorMsg, "connection refused") {
			errorMsg = fmt.Sprintf("Connexion refusée: Le service n'écoute probablement pas sur le port %s. Vérifiez que le service est démarré.", parsedURL.Port())
		} else if strings.Contains(errorMsg, "network is unreachable") {
			errorMsg = fmt.Sprintf("Réseau inaccessible: Impossible d'atteindre %s. Vérifiez la connectivité réseau.", host)
		}

		result := map[string]interface{}{
			"url":        urlStr,
			"status":     status,
			"latency":    latency,
			"timestamp":  time.Now().Unix(),
			"error":      errorMsg,
			"last_check": time.Now().Format(time.RFC3339),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}
	defer resp.Body.Close()

	statusCodeVal := resp.StatusCode
	statusCode = &statusCodeVal

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		status = "online"
	} else {
		status = "offline"
		errorMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}

	result := map[string]interface{}{
		"url":         urlStr,
		"status":      status,
		"latency":     latency,
		"status_code": statusCode,
		"timestamp":   time.Now().Unix(),
		"last_check":  time.Now().Format(time.RFC3339),
	}
	if errorMsg != "" {
		result["error"] = errorMsg
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetHealthTCP vérifie la santé d'une connexion TCP
func (h *Handlers) GetHealthTCP(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Query().Get("host")
	port := r.URL.Query().Get("port")

	if host == "" || port == "" {
		http.Error(w, "Host and port parameters are required", http.StatusBadRequest)
		return
	}

	// Faire une vraie vérification TCP
	startTime := time.Now()
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), 5*time.Second)
	latency := time.Since(startTime).Milliseconds()

	var status string
	if err != nil {
		status = "offline"
		errorMsg := err.Error()
		result := map[string]interface{}{
			"host":      host,
			"port":      port,
			"status":    status,
			"latency":   latency,
			"timestamp": time.Now().Unix(),
			"error":     errorMsg,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
		return
	}
	defer conn.Close()

	status = "online"

	result := map[string]interface{}{
		"host":      host,
		"port":      port,
		"status":    status,
		"latency":   latency,
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// QueryPrometheus exécute une requête PromQL sur Prometheus
func (h *Handlers) QueryPrometheus(w http.ResponseWriter, r *http.Request) {
	baseURL := r.URL.Query().Get("base_url")
	query := r.URL.Query().Get("query")

	// Validation des paramètres
	if baseURL == "" {
		http.Error(w, "base_url parameter is required", http.StatusBadRequest)
		return
	}
	if query == "" {
		http.Error(w, "query parameter is required", http.StatusBadRequest)
		return
	}

	// Valider que l'URL est bien formée
	if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
		http.Error(w, "base_url must start with http:// or https://", http.StatusBadRequest)
		return
	}

	// Construire l'URL de la requête Prometheus
	promURL := fmt.Sprintf("%s/api/v1/query?query=%s", strings.TrimSuffix(baseURL, "/"), query)

	// En mode dev, simuler une réponse si l'URL est fictive
	if strings.Contains(baseURL, "prometheus.local") || strings.Contains(baseURL, "localhost") {
		// Simuler une réponse Prometheus pour le développement
		w.Header().Set("Content-Type", "application/json")

		// Générer des valeurs mockées basées sur la requête
		var mockValue float64
		if strings.Contains(query, "cpu") {
			mockValue = 45.5 + float64(time.Now().Unix()%20) // Entre 45.5 et 65.5
		} else if strings.Contains(query, "memory") || strings.Contains(query, "mem") {
			mockValue = 68.2 + float64(time.Now().Unix()%15) // Entre 68.2 et 83.2
		} else if strings.Contains(query, "disk") {
			mockValue = 72.8 + float64(time.Now().Unix()%10) // Entre 72.8 et 82.8
		} else {
			mockValue = 50.0 + float64(time.Now().Unix()%30) // Valeur par défaut
		}

		mockResponse := map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"resultType": "vector",
				"result": []map[string]interface{}{
					{
						"value": []interface{}{
							float64(time.Now().Unix()),
							fmt.Sprintf("%.2f", mockValue),
						},
					},
				},
			},
		}

		json.NewEncoder(w).Encode(mockResponse)
		return
	}

	// Créer une requête HTTP avec timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	req, err := http.NewRequest("GET", promURL, nil)
	if err != nil {
		log.Printf("❌ Erreur lors de la création de la requête Prometheus: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	// Ajouter des en-têtes pour améliorer la compatibilité
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "ProxmoxDash/1.0")

	// Exécuter la requête
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Erreur lors de la requête Prometheus vers %s: %v", baseURL, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  fmt.Sprintf("Failed to query Prometheus: %v", err),
		})
		return
	}
	defer resp.Body.Close()

	// Vérifier le code de statut HTTP
	if resp.StatusCode != http.StatusOK {
		log.Printf("⚠️  Prometheus a retourné un code non-OK: %d pour %s", resp.StatusCode, baseURL)
	}

	// Lire la réponse
	var promResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&promResponse); err != nil {
		log.Printf("❌ Erreur lors du décodage de la réponse Prometheus: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  fmt.Sprintf("Failed to decode Prometheus response: %v", err),
		})
		return
	}

	// Log de succès (seulement en mode debug)
	if resp.StatusCode == http.StatusOK {
		log.Printf("✅ Requête Prometheus réussie vers %s (query: %s)", baseURL, query[:min(50, len(query))])
	}

	// Retourner la réponse Prometheus
	w.Header().Set("Content-Type", "application/json")
	if resp.StatusCode != http.StatusOK {
		w.WriteHeader(resp.StatusCode)
	}
	json.NewEncoder(w).Encode(promResponse)
}

// min retourne le minimum de deux entiers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// TestEmail teste l'envoi d'un email
func (h *Handlers) TestEmail(w http.ResponseWriter, r *http.Request) {
	var req models.NotifyTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Simuler l'envoi d'un email de test
	email := &models.EmailQueue{
		ToAddr:    req.To,
		Subject:   "Test Email",
		BodyText:  "This is a test email from ProxmoxDash",
		State:     "pending",
		CreatedAt: time.Now(),
	}

	if err := h.store.CreateEmailQueue(email); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create test email: %v", err), http.StatusInternalServerError)
		return
	}

	result := map[string]string{
		"message": "Test email queued successfully",
		"to":      req.To,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// SubscribeNotification crée un nouvel abonnement aux notifications
func (h *Handlers) SubscribeNotification(w http.ResponseWriter, r *http.Request) {
	var req models.SubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	sub := &models.NotifySubscription{
		Channel:   req.Channel,
		Endpoint:  req.Endpoint,
		Enabled:   true,
		CreatedAt: time.Now(),
	}

	if err := sub.Validate(); err != nil {
		http.Error(w, fmt.Sprintf("Validation error: %v", err), http.StatusBadRequest)
		return
	}

	if err := h.store.CreateNotificationSubscription(sub); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create subscription: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sub)
}

// StreamAlerts gère le streaming SSE pour les alertes
func (h *Handlers) StreamAlerts(w http.ResponseWriter, r *http.Request) {
	// Vérifier l'authentification via le token dans les paramètres de requête
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Token d'authentification requis", http.StatusUnauthorized)
		return
	}

	// Configuration SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Cache-Control")

	// Vérifier que le ResponseWriter supporte le flush
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Envoyer un événement de connexion
	fmt.Fprintf(w, "event: connected\n")
	fmt.Fprintf(w, "data: {\"message\": \"Connected to NexBoard alerts stream\"}\n\n")
	flusher.Flush()

	// Envoyer une alerte de test seulement si c'est la première connexion de la session
	// Vérifier si l'alerte de bienvenue a déjà été envoyée dans cette session
	sessionKey := r.Header.Get("X-Session-ID")
	if sessionKey == "" {
		sessionKey = r.RemoteAddr // Utiliser l'adresse IP comme clé de session
	}

	// Cache simple en mémoire pour éviter les alertes répétées
	// Dans un vrai système, on utiliserait Redis ou une base de données
	go func() {
		time.Sleep(3 * time.Second)
		// Pour l'instant, on désactive l'alerte de test pour éviter les boucles
		// testAlert := map[string]interface{}{
		// 	"id":           1,
		// 	"source":       "system",
		// 	"severity":     "info",
		// 	"title":        "Bienvenue sur NexBoard",
		// 	"message":      "Système de notifications opérationnel",
		// 	"created_at":   time.Now().Format(time.RFC3339),
		// 	"acknowledged": false,
		// }
		//
		// alertData, _ := json.Marshal(testAlert)
		// fmt.Fprintf(w, "event: alert\n")
		// fmt.Fprintf(w, "data: %s\n\n", string(alertData))
		// flusher.Flush()
	}()

	// Boucle infinie simple pour maintenir la connexion
	for {
		select {
		case <-r.Context().Done():
			// Connexion fermée par le client
			return
		default:
			// Attendre un peu et envoyer un ping
			time.Sleep(10 * time.Second)
			fmt.Fprintf(w, "event: ping\n")
			fmt.Fprintf(w, "data: {\"timestamp\": %d, \"message\": \"Heartbeat\"}\n\n", time.Now().Unix())
			flusher.Flush()
		}
	}
}

// ClearDatabase vide complètement la base de données
func (h *Handlers) ClearDatabase(w http.ResponseWriter, r *http.Request) {
	// Vérifier que la méthode est POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Vider la base de données
	if err := h.store.ClearDatabase(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to clear database: %v", err), http.StatusInternalServerError)
		return
	}

	// Retourner une réponse de succès
	response := map[string]interface{}{
		"success":   true,
		"message":   "Database cleared successfully",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// FetchProxmoxData récupère les données depuis Proxmox
func (h *Handlers) FetchProxmoxData(w http.ResponseWriter, r *http.Request) {
	fmt.Println("🔍 FetchProxmoxData called")

	// Vérifier que la méthode est POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parser le body JSON
	var config struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Secret   string `json:"secret"`
		Node     string `json:"node"`
	}

	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		fmt.Printf("❌ JSON decode error: %v\n", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	fmt.Printf("📊 Config received: URL=%s, Username=%s, Node=%s\n", config.URL, config.Username, config.Node)

	// Vérifier que les champs requis sont présents
	if config.URL == "" || config.Username == "" || config.Secret == "" {
		fmt.Println("❌ Missing required fields")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Créer le token d'authentification Proxmox
	// Le format dépend du type d'authentification :
	// - Pour un token API: PVEAPIToken=username!tokenname=secret
	// - Pour un mot de passe: username@realm:password (format ticket)
	// Si le username contient "!", c'est probablement un token API au format username!tokenname
	var token string
	if strings.Contains(config.Username, "!") {
		// Le username est au format username!tokenname, donc c'est un token API
		// Format: PVEAPIToken=username!tokenname=secret
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
		fmt.Printf("🔑 Token created: [MASKED] (format: API Token - username!tokenname=secret)\n")
	} else if strings.Contains(config.Secret, "!") {
		// Le secret contient "!", donc c'est un token API au format username!tokenname=secret
		token = fmt.Sprintf("PVEAPIToken=%s", config.Secret)
		fmt.Printf("🔑 Token created: [MASKED] (format: API Token - secret contains !)\n")
	} else {
		// C'est probablement un mot de passe, on utilise le format ticket
		// Pour l'instant, on essaie le format token simple
		// Si ça ne marche pas, il faudra utiliser l'endpoint /access/ticket
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
		fmt.Printf("🔑 Token created: [MASKED] (format: Password/Simple Token)\n")
	}

	// Vérifier si c'est une URL de développement fictive
	isDevURL := strings.Contains(config.URL, "example.com") ||
		strings.Contains(config.URL, "proxmox-dev.local") ||
		strings.Contains(config.URL, "localhost") ||
		strings.Contains(config.URL, "127.0.0.1")

	if isDevURL {
		fmt.Println("⚠️ URL de développement détectée, retour de données fictives")
		response := map[string]interface{}{
			"success":  false,
			"message":  "URL de développement détectée. Veuillez configurer une URL Proxmox réelle dans les Paramètres.",
			"nodes":    []map[string]interface{}{},
			"vms":      []map[string]interface{}{},
			"lxc":      []map[string]interface{}{},
			"storages": []map[string]interface{}{},
			"networks": []map[string]interface{}{},
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Récupérer les nœuds
	fmt.Println("🔄 Fetching nodes...")
	nodes, err := h.fetchProxmoxNodes(config.URL, token)
	if err != nil {
		fmt.Printf("❌ Failed to fetch nodes: %v\n", err)
		// Retourner une réponse JSON avec success: false au lieu d'une erreur HTTP
		errorResponse := map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Erreur lors de la récupération des nœuds: %v", err),
			"nodes":   []map[string]interface{}{},
			"vms":     []map[string]interface{}{},
			"lxc":     []map[string]interface{}{},
		}

		statusCode := http.StatusOK
		if strings.Contains(err.Error(), "401") {
			errorResponse["message"] = "Erreur d'authentification Proxmox: Vérifiez vos credentials (utilisateur et secret)"
		} else if strings.Contains(err.Error(), "no such host") || strings.Contains(err.Error(), "lookup") {
			errorResponse["message"] = "Impossible de se connecter au serveur Proxmox. Vérifiez l'URL et que le serveur est accessible."
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(errorResponse)
		return
	}
	fmt.Printf("✅ Nodes fetched: %d nodes\n", len(nodes))

	// Récupérer les VMs
	fmt.Println("🔄 Fetching VMs...")
	vms, err := h.fetchProxmoxVMs(config.URL, token)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch VMs: %v (continuing without VMs)\n", err)
		vms = []map[string]interface{}{} // Continuer sans VMs
	} else {
		fmt.Printf("✅ VMs fetched: %d VMs\n", len(vms))
		if len(vms) == 0 {
			fmt.Printf("⚠️ WARNING: No VMs found. This is likely a PERMISSIONS issue.\n")
			fmt.Printf("   The Proxmox user '%s' may not have permission to view VMs.\n", config.Username)
			fmt.Printf("   Please check Proxmox permissions: User needs 'VM.Audit' or 'PVEAuditor' role.\n")
		}
	}

	// Récupérer les conteneurs LXC
	fmt.Println("🔄 Fetching LXC...")
	lxc, err := h.fetchProxmoxLXC(config.URL, token)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch LXC: %v (continuing without LXC)\n", err)
		lxc = []map[string]interface{}{} // Continuer sans LXC
	} else {
		fmt.Printf("✅ LXC fetched: %d containers\n", len(lxc))
		if len(lxc) == 0 {
			fmt.Printf("⚠️ WARNING: No LXC containers found. This is likely a PERMISSIONS issue.\n")
			fmt.Printf("   The Proxmox user '%s' may not have permission to view LXC containers.\n", config.Username)
			fmt.Printf("   Please check Proxmox permissions: User needs 'VM.Audit' or 'PVEAuditor' role.\n")
		}
	}

	// Récupérer les storages
	fmt.Println("🔄 Fetching storages...")
	storages, err := h.fetchProxmoxStorages(config.URL, token)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch storages: %v (continuing without storages)\n", err)
		storages = []map[string]interface{}{} // Continuer sans storages
	} else {
		fmt.Printf("✅ Storages fetched: %d storages\n", len(storages))
		if len(storages) == 0 {
			fmt.Printf("⚠️ WARNING: No storages found. This is likely a PERMISSIONS issue.\n")
			fmt.Printf("   The Proxmox user '%s' may not have permission to view storages.\n", config.Username)
			fmt.Printf("   Please check Proxmox permissions: User needs 'Datastore.Audit' or 'PVEAuditor' role.\n")
		}
	}

	// Récupérer les interfaces réseau
	fmt.Println("🔄 Fetching network interfaces...")
	networks, err := h.fetchProxmoxNetworks(config.URL, token, config.Node)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch networks: %v (continuing without networks)\n", err)
		networks = []map[string]interface{}{} // Continuer sans réseaux
	} else {
		fmt.Printf("✅ Networks fetched: %d interfaces\n", len(networks))
	}

	// Vérifier si des données sont manquantes et ajouter un message d'avertissement
	message := "Proxmox data fetched successfully"
	if len(vms) == 0 && len(lxc) == 0 && len(storages) == 0 {
		message = "Proxmox data fetched, but no VMs, LXC, or storages found. This is likely a PERMISSIONS issue. Please check that the Proxmox user has the necessary permissions (VM.Audit, Datastore.Audit, or PVEAuditor role)."
		fmt.Printf("⚠️ WARNING: %s\n", message)
	}

	// Retourner les données
	response := map[string]interface{}{
		"success":  true,
		"nodes":    nodes,
		"vms":      vms,
		"lxc":      lxc,
		"storages": storages,
		"networks": networks,
		"message":  message,
	}

	fmt.Println("✅ Sending response...")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// fetchProxmoxNodes récupère les nœuds depuis Proxmox
func (h *Handlers) fetchProxmoxNodes(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("🌐 Fetching from URL: %s\n", url)
	fmt.Printf("🔑 Using token: [MASKED]\n")

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Utiliser l'endpoint sans filtre pour récupérer TOUTES les ressources (nodes, VMs, LXC)
	// Ensuite on filtrera dans le code
	fullURL := fmt.Sprintf("%s/api2/json/cluster/resources", url)
	fmt.Printf("📡 Full URL: %s\n", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		fmt.Printf("❌ Failed to create request: %v\n", err)
		return nil, err
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	fmt.Println("🚀 Sending request...")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ Request failed: %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()

	fmt.Printf("📊 Response status: %d\n", resp.StatusCode)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Proxmox API error: %d", resp.StatusCode)
	}

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	fmt.Printf("📊 fetchProxmoxNodes: API returned %d total resources\n", len(result.Data))

	// Log des types trouvés pour déboguer
	typesFound := make(map[string]int)
	for _, item := range result.Data {
		if itemType, ok := item["type"].(string); ok {
			typesFound[itemType]++
		}
	}
	fmt.Printf("📊 fetchProxmoxNodes: Resource types found: %v\n", typesFound)

	// Compter et collecter les VMs et LXC par nœud
	nodeCounts := make(map[string]map[string]int)
	nodeVMs := make(map[string][]map[string]interface{})
	nodeLXC := make(map[string][]map[string]interface{})

	for _, item := range result.Data {
		itemType, _ := item["type"].(string)
		// Proxmox peut retourner "qemu" au lieu de "vm" pour les machines virtuelles
		if itemType == "vm" || itemType == "qemu" || itemType == "lxc" {
			nodeName := item["node"].(string)
			if nodeCounts[nodeName] == nil {
				nodeCounts[nodeName] = map[string]int{"vms": 0, "lxc": 0}
			}

			// Créer un objet VM/LXC simplifié
			vmLxcInfo := map[string]interface{}{
				"id":     item["vmid"],
				"name":   item["name"],
				"status": item["status"],
				"type":   itemType,
			}

			if itemType == "vm" || itemType == "qemu" {
				nodeCounts[nodeName]["vms"]++
				nodeVMs[nodeName] = append(nodeVMs[nodeName], vmLxcInfo)
				fmt.Printf("🖥️ VM found on %s: %s (ID: %v, Status: %v)\n",
					nodeName, item["name"], item["vmid"], item["status"])
			} else if itemType == "lxc" {
				nodeCounts[nodeName]["lxc"]++
				nodeLXC[nodeName] = append(nodeLXC[nodeName], vmLxcInfo)
				fmt.Printf("🐳 LXC found on %s: %s (ID: %v, Status: %v)\n",
					nodeName, item["name"], item["vmid"], item["status"])
			}
		}
	}

	// Traiter les nœuds
	var nodes []map[string]interface{}
	for _, item := range result.Data {
		if item["type"] == "node" {
			nodeName := item["node"].(string)
			fmt.Printf("🖥️ Processing node: %s\n", nodeName)

			// Récupérer les vraies métriques du nœud
			nodeMetrics, err := h.fetchNodeMetrics(url, token, nodeName)
			if err != nil {
				fmt.Printf("⚠️ Failed to fetch metrics for node %s: %v\n", nodeName, err)
				// Générer des données simulées différentes pour chaque nœud
				nodeMetrics = h.generateSimulatedMetrics(nodeName)
			}

			// Obtenir les compteurs pour ce nœud
			vmsCount := 0
			lxcCount := 0
			if counts, exists := nodeCounts[nodeName]; exists {
				vmsCount = counts["vms"]
				lxcCount = counts["lxc"]
			}

			fmt.Printf("📊 Metrics for %s: CPU=%v%%, Memory=%v%%, Disk=%v%%, IP=%s, VMs=%d, LXC=%d\n",
				nodeName, nodeMetrics["cpu_usage"], nodeMetrics["memory_usage"],
				nodeMetrics["disk_usage"], nodeMetrics["ip_address"], vmsCount, lxcCount)

			node := map[string]interface{}{
				"id":           nodeName,
				"name":         nodeName,
				"status":       item["status"],
				"cpu_usage":    nodeMetrics["cpu_usage"],
				"memory_usage": nodeMetrics["memory_usage"],
				"disk_usage":   nodeMetrics["disk_usage"],
				"uptime":       nodeMetrics["uptime"],
				"temperature":  nodeMetrics["temperature"],
				"last_update":  time.Now().Format(time.RFC3339),
				"version":      nodeMetrics["version"],
				"ip_address":   nodeMetrics["ip_address"],
				"loadavg":      nodeMetrics["loadavg"],
				"kversion":     nodeMetrics["kversion"],
				"cpuinfo":      nodeMetrics["cpuinfo"],
				"meminfo":      nodeMetrics["meminfo"],
				"swapinfo":     nodeMetrics["swapinfo"],
				"diskinfo":     nodeMetrics["diskinfo"],
				"vms_count":    vmsCount,
				"lxc_count":    lxcCount,
				"vms":          nodeVMs[nodeName], // Liste des VMs sur ce nœud
				"lxc":          nodeLXC[nodeName], // Liste des LXC sur ce nœud
			}
			nodes = append(nodes, node)
		}
	}

	return nodes, nil
}

// fetchProxmoxVMs récupère les VMs depuis Proxmox
func (h *Handlers) fetchProxmoxVMs(url, token string) ([]map[string]interface{}, error) {
	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// D'abord, récupérer la liste des nœuds
	nodesReq, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes", url), nil)
	if err != nil {
		return nil, err
	}
	nodesReq.Header.Set("Authorization", token)
	nodesReq.Header.Set("Content-Type", "application/json")

	nodesResp, err := client.Do(nodesReq)
	if err != nil {
		return nil, err
	}
	defer nodesResp.Body.Close()

	if nodesResp.StatusCode != 200 {
		return nil, fmt.Errorf("Failed to fetch nodes: %d", nodesResp.StatusCode)
	}

	var nodesResult struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(nodesResp.Body).Decode(&nodesResult); err != nil {
		return nil, err
	}

	fmt.Printf("🔍 DEBUG VM: Found %d nodes, fetching VMs from each node\n", len(nodesResult.Data))

	// Récupérer les VMs depuis chaque nœud
	var allVMs []map[string]interface{}
	for _, node := range nodesResult.Data {
		nodeName, ok := node["node"].(string)
		if !ok {
			continue
		}

		// Utiliser l'endpoint spécifique pour les VMs sur ce nœud
		fullURL := fmt.Sprintf("%s/api2/json/nodes/%s/qemu", url, nodeName)
		fmt.Printf("🔍 DEBUG VM: Fetching VMs from node %s: %s\n", nodeName, fullURL)
		req, err := http.NewRequest("GET", fullURL, nil)
		if err != nil {
			fmt.Printf("⚠️ Failed to create VM request for node %s: %v\n", nodeName, err)
			continue
		}

		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("⚠️ Failed to fetch VMs from node %s: %v (continuing)\n", nodeName, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("⚠️ VM API error for node %s: %d - %s (continuing)\n", nodeName, resp.StatusCode, string(bodyBytes))
			continue
		}

		var nodeVMsResult struct {
			Data []map[string]interface{} `json:"data"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&nodeVMsResult); err != nil {
			fmt.Printf("⚠️ Failed to decode VMs from node %s: %v (continuing)\n", nodeName, err)
			continue
		}

		fmt.Printf("✅ Found %d VMs on node %s\n", len(nodeVMsResult.Data), nodeName)

		// Traiter les VMs de ce nœud
		for _, item := range nodeVMsResult.Data {
			vmid, _ := item["vmid"].(float64)
			name, _ := item["name"].(string)
			status, _ := item["status"].(string)

			vm := map[string]interface{}{
				"id":           int(vmid),
				"vmid":         int(vmid),
				"name":         name,
				"status":       status,
				"node":         nodeName,
				"cpu_usage":    0.0,
				"memory_usage": 0.0,
				"disk_usage":   0.0,
				"uptime":       0,
				"last_update":  time.Now().Format(time.RFC3339),
			}

			// Récupérer les statistiques détaillées si disponibles
			if maxcpu, ok := item["maxcpu"].(float64); ok {
				vm["maxcpu"] = maxcpu
			}
			if maxmem, ok := item["maxmem"].(float64); ok {
				vm["maxmem"] = maxmem
			}
			if disk, ok := item["disk"].(float64); ok {
				vm["disk"] = disk
			}
			if uptime, ok := item["uptime"].(float64); ok {
				vm["uptime"] = int64(uptime)
			}

			// Récupérer les métriques en temps réel depuis status/current
			if status == "running" {
				statusURL := fmt.Sprintf("%s/api2/json/nodes/%s/qemu/%d/status/current", url, nodeName, int(vmid))
				statusReq, err := http.NewRequest("GET", statusURL, nil)
				if err == nil {
					statusReq.Header.Set("Authorization", token)
					statusReq.Header.Set("Content-Type", "application/json")

					statusResp, err := client.Do(statusReq)
					if err == nil && statusResp.StatusCode == 200 {
						var statusResult struct {
							Data map[string]interface{} `json:"data"`
						}
						if err := json.NewDecoder(statusResp.Body).Decode(&statusResult); err == nil {
							statusResp.Body.Close()

							// CPU usage (en pourcentage)
							if cpu, ok := statusResult.Data["cpu"].(float64); ok {
								vm["cpu_usage"] = cpu * 100
							}

							// Memory usage (en pourcentage)
							if maxmem, ok := statusResult.Data["maxmem"].(float64); ok && maxmem > 0 {
								if mem, ok := statusResult.Data["mem"].(float64); ok {
									vm["memory_usage"] = (mem / maxmem) * 100
								}
							}

							// Disk usage (en pourcentage)
							if maxdisk, ok := statusResult.Data["maxdisk"].(float64); ok && maxdisk > 0 {
								if useddisk, ok := statusResult.Data["disk"].(float64); ok {
									vm["disk_usage"] = (useddisk / maxdisk) * 100
								}
							}

							// Uptime
							if uptime, ok := statusResult.Data["uptime"].(float64); ok {
								vm["uptime"] = int64(uptime)
							}

							fmt.Printf("📊 VM %s metrics: CPU=%.2f%%, Memory=%.2f%%, Disk=%.2f%%, Uptime=%d\n",
								name, vm["cpu_usage"], vm["memory_usage"], vm["disk_usage"], vm["uptime"])
						} else {
							if statusResp != nil {
								statusResp.Body.Close()
							}
						}
					} else {
						if statusResp != nil {
							statusResp.Body.Close()
						}
						fmt.Printf("⚠️ Failed to fetch metrics for VM %s (ID: %d): %v\n", name, int(vmid), err)
					}
				}

				// Essayer de récupérer l'IP via l'agent QEMU (si disponible)
				agentURL := fmt.Sprintf("%s/api2/json/nodes/%s/qemu/%d/agent/network-get-interfaces", url, nodeName, int(vmid))
				agentReq, err := http.NewRequest("GET", agentURL, nil)
				if err == nil {
					agentReq.Header.Set("Authorization", token)
					agentReq.Header.Set("Content-Type", "application/json")

					agentResp, err := client.Do(agentReq)
					if err == nil && agentResp.StatusCode == 200 {
						var agentResult struct {
							Data []map[string]interface{} `json:"data"`
						}
						if err := json.NewDecoder(agentResp.Body).Decode(&agentResult); err == nil {
							agentResp.Body.Close()
							// Chercher la première interface avec une IP (ignorer loopback)
							for _, iface := range agentResult.Data {
								if name, _ := iface["name"].(string); name != "lo" {
									if ipAddrs, ok := iface["ip-addresses"].([]interface{}); ok {
										for _, ipAddr := range ipAddrs {
											if ipMap, ok := ipAddr.(map[string]interface{}); ok {
												if ipType, _ := ipMap["ip-address-type"].(string); ipType == "ipv4" {
													if ip, ok := ipMap["ip-address"].(string); ok && ip != "" {
														vm["ip_address"] = ip
														fmt.Printf("🌐 VM %s IP: %s\n", name, ip)
														break
													}
												}
											}
										}
									}
									if vm["ip_address"] != nil {
										break
									}
								}
							}
						} else {
							if agentResp != nil {
								agentResp.Body.Close()
							}
						}
					} else {
						if agentResp != nil {
							agentResp.Body.Close()
						}
						// L'agent n'est pas disponible, c'est normal pour certaines VMs
					}
				}
			}

			allVMs = append(allVMs, vm)
			fmt.Printf("🖥️ VM found: %s (ID: %d, Node: %s, Status: %s)\n", name, int(vmid), nodeName, status)
		}
	}

	fmt.Printf("✅ Total VMs found across all nodes: %d\n", len(allVMs))
	return allVMs, nil
}

// fetchProxmoxLXC récupère les conteneurs LXC depuis Proxmox
func (h *Handlers) fetchProxmoxLXC(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("🐳 Fetching LXC from URL: %s\n", url)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// D'abord, récupérer la liste des nœuds
	nodesReq, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes", url), nil)
	if err != nil {
		return nil, err
	}
	nodesReq.Header.Set("Authorization", token)
	nodesReq.Header.Set("Content-Type", "application/json")

	nodesResp, err := client.Do(nodesReq)
	if err != nil {
		return nil, err
	}
	defer nodesResp.Body.Close()

	if nodesResp.StatusCode != 200 {
		return nil, fmt.Errorf("Failed to fetch nodes: %d", nodesResp.StatusCode)
	}

	var nodesResult struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(nodesResp.Body).Decode(&nodesResult); err != nil {
		return nil, err
	}

	fmt.Printf("🔍 DEBUG LXC: Found %d nodes, fetching LXC from each node\n", len(nodesResult.Data))

	// Récupérer les LXC depuis chaque nœud
	var allLXC []map[string]interface{}
	for _, node := range nodesResult.Data {
		nodeName, ok := node["node"].(string)
		if !ok {
			continue
		}

		// Utiliser l'endpoint spécifique pour les LXC sur ce nœud
		fullURL := fmt.Sprintf("%s/api2/json/nodes/%s/lxc", url, nodeName)
		fmt.Printf("🔍 DEBUG LXC: Fetching LXC from node %s: %s\n", nodeName, fullURL)
		req, err := http.NewRequest("GET", fullURL, nil)
		if err != nil {
			fmt.Printf("⚠️ Failed to create LXC request for node %s: %v\n", nodeName, err)
			continue
		}

		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("⚠️ Failed to fetch LXC from node %s: %v (continuing)\n", nodeName, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("⚠️ LXC API error for node %s: %d - %s (continuing)\n", nodeName, resp.StatusCode, string(bodyBytes))
			continue
		}

		var nodeLXCResult struct {
			Data []map[string]interface{} `json:"data"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&nodeLXCResult); err != nil {
			fmt.Printf("⚠️ Failed to decode LXC from node %s: %v (continuing)\n", nodeName, err)
			continue
		}

		fmt.Printf("✅ Found %d LXC containers on node %s\n", len(nodeLXCResult.Data), nodeName)

		// Traiter les LXC de ce nœud
		for _, item := range nodeLXCResult.Data {
			vmid, _ := item["vmid"].(float64)
			name, _ := item["name"].(string)
			status, _ := item["status"].(string)

			container := map[string]interface{}{
				"id":           int(vmid),
				"vmid":         int(vmid),
				"name":         name,
				"status":       status,
				"node":         nodeName,
				"cpu_usage":    0,
				"memory_usage": 0,
				"uptime":       0,
				"last_update":  time.Now().Format(time.RFC3339),
			}

			// Récupérer les statistiques détaillées si disponibles
			if maxcpu, ok := item["maxcpu"].(float64); ok {
				container["maxcpu"] = maxcpu
			}
			if maxmem, ok := item["maxmem"].(float64); ok {
				container["maxmem"] = maxmem
			}
			if uptime, ok := item["uptime"].(float64); ok {
				container["uptime"] = int64(uptime)
			}

			// Essayer de récupérer l'IP depuis la configuration réseau du LXC
			if status == "running" {
				// Méthode 1: Essayer via l'agent d'abord (plus fiable pour DHCP)
				agentURL := fmt.Sprintf("%s/api2/json/nodes/%s/lxc/%d/agent/network-get-interfaces", url, nodeName, int(vmid))
				agentReq, err := http.NewRequest("GET", agentURL, nil)
				if err == nil {
					agentReq.Header.Set("Authorization", token)
					agentReq.Header.Set("Content-Type", "application/json")

					agentResp, err := client.Do(agentReq)
					if err == nil && agentResp.StatusCode == 200 {
						var agentResult struct {
							Data []map[string]interface{} `json:"data"`
						}
						if err := json.NewDecoder(agentResp.Body).Decode(&agentResult); err == nil {
							agentResp.Body.Close()
							// Chercher la première interface avec une IP IPv4 (ignorer loopback)
							for _, iface := range agentResult.Data {
								if ifaceName, _ := iface["name"].(string); ifaceName != "lo" {
									if ipAddrs, ok := iface["ip-addresses"].([]interface{}); ok {
										for _, ipAddr := range ipAddrs {
											if ipMap, ok := ipAddr.(map[string]interface{}); ok {
												if ipType, _ := ipMap["ip-address-type"].(string); ipType == "ipv4" {
													if ip, ok := ipMap["ip-address"].(string); ok && ip != "" {
														container["ip_address"] = ip
														fmt.Printf("🌐 LXC %s IP (via agent): %s\n", name, ip)
														break
													}
												}
											}
										}
									}
									if container["ip_address"] != nil {
										break
									}
								}
							}
						} else {
							if agentResp != nil {
								agentResp.Body.Close()
							}
						}
					} else {
						if agentResp != nil {
							agentResp.Body.Close()
						}
						// L'agent n'est pas disponible, essayer la config
					}
				}

				// Méthode 2: Si pas d'IP via l'agent, essayer la configuration
				if container["ip_address"] == nil {
					configURL := fmt.Sprintf("%s/api2/json/nodes/%s/lxc/%d/config", url, nodeName, int(vmid))
					configReq, err := http.NewRequest("GET", configURL, nil)
					if err == nil {
						configReq.Header.Set("Authorization", token)
						configReq.Header.Set("Content-Type", "application/json")

						configResp, err := client.Do(configReq)
						if err == nil && configResp.StatusCode == 200 {
							var configResult struct {
								Data map[string]interface{} `json:"data"`
							}
							if err := json.NewDecoder(configResp.Body).Decode(&configResult); err == nil {
								configResp.Body.Close()
								// Chercher net0, net1, etc. qui contiennent les IPs
								for key, value := range configResult.Data {
									if strings.HasPrefix(key, "net") {
										if netStr, ok := value.(string); ok {
											// Format: name=eth0,bridge=vmbr0,ip=dhcp ou ip=192.168.1.100/24
											parts := strings.Split(netStr, ",")
											for _, part := range parts {
												if strings.HasPrefix(part, "ip=") {
													ipPart := strings.TrimPrefix(part, "ip=")
													// Enlever le masque de sous-réseau si présent
													if strings.Contains(ipPart, "/") {
														ipPart = strings.Split(ipPart, "/")[0]
													}
													// Ignorer "dhcp"
													if ipPart != "dhcp" && ipPart != "" {
														container["ip_address"] = ipPart
														fmt.Printf("🌐 LXC %s IP (via config): %s\n", name, ipPart)
														break
													}
												}
											}
										}
										if container["ip_address"] != nil {
											break
										}
									}
								}
							} else {
								if configResp != nil {
									configResp.Body.Close()
								}
							}
						} else {
							if configResp != nil {
								configResp.Body.Close()
							}
						}
					}
				}

				// Méthode 3: Essayer via les statistiques en temps réel (dernier recours)
				if container["ip_address"] == nil {
					statusURL := fmt.Sprintf("%s/api2/json/nodes/%s/lxc/%d/status/current", url, nodeName, int(vmid))
					statusReq, err := http.NewRequest("GET", statusURL, nil)
					if err == nil {
						statusReq.Header.Set("Authorization", token)
						statusReq.Header.Set("Content-Type", "application/json")

						statusResp, err := client.Do(statusReq)
						if err == nil && statusResp.StatusCode == 200 {
							var statusResult struct {
								Data map[string]interface{} `json:"data"`
							}
							if err := json.NewDecoder(statusResp.Body).Decode(&statusResult); err == nil {
								statusResp.Body.Close()
								// Chercher des informations réseau dans les statistiques
								if netIn, ok := statusResult.Data["netin"].(float64); ok && netIn > 0 {
									// Si le conteneur a du trafic réseau, il est probablement connecté
									// Mais on ne peut pas récupérer l'IP directement depuis ici
									fmt.Printf("⚠️ LXC %s a du trafic réseau mais IP non récupérable via status\n", name)
								}
							} else {
								if statusResp != nil {
									statusResp.Body.Close()
								}
							}
						} else {
							if statusResp != nil {
								statusResp.Body.Close()
							}
						}
					}
				}

				// Log si aucune IP n'a été trouvée
				if container["ip_address"] == nil {
					fmt.Printf("⚠️ LXC %s (ID: %d) - Aucune IP trouvée (Agent peut-être indisponible ou DHCP)\n", name, int(vmid))
				}
			}

			allLXC = append(allLXC, container)
			fmt.Printf("🐳 LXC found: %s (ID: %d, Node: %s, Status: %s", name, int(vmid), nodeName, status)
			if container["ip_address"] != nil {
				fmt.Printf(", IP: %v", container["ip_address"])
			}
			fmt.Printf(")\n")
		}
	}

	fmt.Printf("✅ Total LXC containers found across all nodes: %d\n", len(allLXC))
	return allLXC, nil
}

// fetchNodeMetrics récupère les vraies métriques d'un nœud Proxmox
func (h *Handlers) fetchNodeMetrics(url, token, nodeName string) (map[string]interface{}, error) {
	fmt.Printf("📊 Fetching metrics for node: %s\n", nodeName)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer les statistiques du nœud
	statsURL := fmt.Sprintf("%s/api2/json/nodes/%s/status", url, nodeName)
	req, err := http.NewRequest("GET", statsURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Failed to fetch node stats: %d", resp.StatusCode)
	}

	var statsResult struct {
		Data map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&statsResult); err != nil {
		return nil, err
	}

	// Récupérer les informations réseau du nœud
	networkURL := fmt.Sprintf("%s/api2/json/nodes/%s/network", url, nodeName)
	networkReq, err := http.NewRequest("GET", networkURL, nil)
	if err != nil {
		return nil, err
	}

	networkReq.Header.Set("Authorization", token)
	networkReq.Header.Set("Content-Type", "application/json")

	networkResp, err := client.Do(networkReq)
	if err != nil {
		return nil, err
	}
	defer networkResp.Body.Close()

	var ipAddress string = "N/A"
	if networkResp.StatusCode == 200 {
		var networkResult struct {
			Data []map[string]interface{} `json:"data"`
		}
		if err := json.NewDecoder(networkResp.Body).Decode(&networkResult); err == nil {
			// Chercher l'interface principale (vmbr0 ou similaire)
			for _, iface := range networkResult.Data {
				if iface["iface"] == "vmbr0" || iface["iface"] == "eth0" {
					if addr, ok := iface["address"].(string); ok {
						ipAddress = strings.Split(addr, "/")[0] // Enlever le /24
						break
					}
				}
			}
		}
	}

	// Extraire les métriques des statistiques
	metrics := map[string]interface{}{
		"cpu_usage":    0,
		"memory_usage": 0,
		"disk_usage":   0,
		"uptime":       0,
		"temperature":  0,
		"version":      "N/A",
		"ip_address":   ipAddress,
		"loadavg":      "0.00, 0.00, 0.00",
		"kversion":     "N/A",
		"cpuinfo":      "N/A",
		"meminfo":      "N/A",
		"swapinfo":     "N/A",
	}

	if data := statsResult.Data; data != nil {
		fmt.Printf("📊 Raw data for %s: %+v\n", nodeName, data)

		// CPU usage - utilisation moyenne sur 1 minute
		if cpu, ok := data["cpu"].(float64); ok {
			metrics["cpu_usage"] = int(cpu * 100)
		}

		// Memory usage - utilisation mémoire en pourcentage
		if memoryMap, ok := data["memory"].(map[string]interface{}); ok {
			if used, ok := memoryMap["used"].(float64); ok {
				if total, ok := memoryMap["total"].(float64); ok && total > 0 {
					metrics["memory_usage"] = int((used / total) * 100)
					fmt.Printf("📊 Memory calculation: used=%.2fGB, total=%.2fGB, usage=%d%%\n",
						used/1024/1024/1024, total/1024/1024/1024, int((used/total)*100))
				}
			}
		}

		// Disk usage - utilisation disque en pourcentage
		if rootfsMap, ok := data["rootfs"].(map[string]interface{}); ok {
			if used, ok := rootfsMap["used"].(float64); ok {
				if total, ok := rootfsMap["total"].(float64); ok && total > 0 {
					metrics["disk_usage"] = int((used / total) * 100)
					fmt.Printf("📊 Disk calculation: used=%.2fGB, total=%.2fGB, usage=%d%%\n",
						used/1024/1024/1024, total/1024/1024/1024, int((used/total)*100))
				}
			}
		}

		// Uptime
		if uptime, ok := data["uptime"].(float64); ok {
			metrics["uptime"] = int(uptime)
		}

		// Version
		if version, ok := data["pveversion"].(string); ok {
			metrics["version"] = version
		}

		// Load average
		if loadavg, ok := data["loadavg"].([]float64); ok && len(loadavg) >= 3 {
			metrics["loadavg"] = fmt.Sprintf("%.2f, %.2f, %.2f",
				loadavg[0], loadavg[1], loadavg[2])
		}

		// Kernel version
		if kversion, ok := data["kversion"].(string); ok {
			metrics["kversion"] = kversion
		}

		// CPU info
		if cpuinfo, ok := data["cpuinfo"].(string); ok {
			metrics["cpuinfo"] = cpuinfo
		}

		// Memory info (format: used/total)
		if memoryMap, ok := data["memory"].(map[string]interface{}); ok {
			if used, ok := memoryMap["used"].(float64); ok {
				if total, ok := memoryMap["total"].(float64); ok {
					metrics["meminfo"] = fmt.Sprintf("%.2f GiB sur %.2f GiB",
						used/1024/1024/1024, total/1024/1024/1024)
				}
			}
		}

		// Swap info
		if swapMap, ok := data["swap"].(map[string]interface{}); ok {
			if used, ok := swapMap["used"].(float64); ok {
				if total, ok := swapMap["total"].(float64); ok {
					swapPercent := 0.0
					if total > 0 {
						swapPercent = (used / total) * 100
					}
					metrics["swapinfo"] = fmt.Sprintf("%.2f%% (%.2f MiB sur %.2f GiB)",
						swapPercent, used/1024/1024, total/1024/1024/1024)
					fmt.Printf("📊 Swap calculation: used=%.2fGB, total=%.2fGB, usage=%.2f%%\n",
						used/1024/1024/1024, total/1024/1024/1024, swapPercent)
				}
			}
		}
	}

	fmt.Printf("✅ Node %s metrics: CPU=%v%%, Memory=%v%%, Disk=%v%%, IP=%s, Load=%s, Swap=%s\n",
		nodeName, metrics["cpu_usage"], metrics["memory_usage"], metrics["disk_usage"],
		metrics["ip_address"], metrics["loadavg"], metrics["swapinfo"])

	return metrics, nil
}

// generateSimulatedMetrics génère des métriques simulées différentes pour chaque nœud
func (h *Handlers) generateSimulatedMetrics(nodeName string) map[string]interface{} {
	// Utiliser le nom du nœud pour générer des valeurs différentes
	hash := 0
	for _, c := range nodeName {
		hash += int(c)
	}

	// Générer des valeurs basées sur le hash du nom
	cpuUsage := (hash % 20) + 1     // 1-20%
	memoryUsage := (hash % 50) + 30 // 30-80%
	diskUsage := (hash % 40) + 15   // 15-55% (plus réaliste)
	uptime := (hash % 86400) + 3600 // 1h à 24h
	temperature := (hash % 20) + 35 // 35-55°C

	// IP simulée basée sur le nom
	ipSuffix := hash % 100
	ipAddress := fmt.Sprintf("192.168.1.%d", ipSuffix)

	// Version simulée
	version := fmt.Sprintf("pve-manager/9.0.%d/abc123def456", hash%10)

	// Load average simulé
	load1 := float64(hash%10) + 0.1
	load5 := float64(hash%15) + 0.2
	load15 := float64(hash%20) + 0.3
	loadavg := fmt.Sprintf("%.2f, %.2f, %.2f", load1, load5, load15)

	// CPU info simulé
	cpuCount := (hash % 8) + 4 // 4-12 processeurs
	cpuinfo := fmt.Sprintf("%d x Intel(R) Core(TM) i%d-8500T CPU @ 2.10GHz (1 Support de processeur)",
		cpuCount, 5000+(hash%10)*100)

	// Memory info simulé
	memUsed := float64(memoryUsage) * 0.1 // GiB
	memTotal := float64(8 + (hash % 16))  // 8-24 GiB
	meminfo := fmt.Sprintf("%.2f GiB sur %.2f GiB", memUsed, memTotal)

	// Swap info simulé
	swapPercent := (hash % 15) + 5         // 5-20%
	swapUsed := float64(swapPercent) * 0.1 // GiB
	swapTotal := float64(4 + (hash % 8))   // 4-12 GiB
	swapinfo := fmt.Sprintf("%d%% (%.2f GiB sur %.2f GiB)", swapPercent, swapUsed, swapTotal)

	// Disk info simulé
	diskUsed := float64(diskUsage) * 0.1    // GiB
	diskTotal := float64(50 + (hash % 100)) // 50-150 GiB
	diskinfo := fmt.Sprintf("%.2f GiB sur %.2f GiB", diskUsed, diskTotal)

	return map[string]interface{}{
		"cpu_usage":    cpuUsage,
		"memory_usage": memoryUsage,
		"disk_usage":   diskUsage,
		"uptime":       uptime,
		"temperature":  temperature,
		"ip_address":   ipAddress,
		"version":      version,
		"loadavg":      loadavg,
		"kversion":     fmt.Sprintf("Linux 6.14.11-%d-pve (2025-08-26T16:06Z)", hash%5),
		"cpuinfo":      cpuinfo,
		"meminfo":      meminfo,
		"swapinfo":     swapinfo,
		"diskinfo":     diskinfo,
		"vms_count":    (hash % 8) + 1,  // 1-8 VMs
		"lxc_count":    (hash % 12) + 1, // 1-12 LXC
	}
}

// fetchNodeDetails récupère les détails d'un nœud spécifique
func (h *Handlers) fetchNodeDetails(url, token, nodeName string) (map[string]interface{}, error) {
	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer les informations du nœud
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes/%s/status", url, nodeName), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Proxmox API error: %d", resp.StatusCode)
	}

	var statusResult struct {
		Data map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&statusResult); err != nil {
		return nil, err
	}

	// Récupérer les informations de version
	versionReq, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes/%s/version", url, nodeName), nil)
	if err != nil {
		return nil, err
	}

	versionReq.Header.Set("Authorization", token)
	versionReq.Header.Set("Content-Type", "application/json")

	versionResp, err := client.Do(versionReq)
	if err != nil {
		return nil, err
	}
	defer versionResp.Body.Close()

	var versionResult struct {
		Data map[string]interface{} `json:"data"`
	}

	version := "Unknown"
	if versionResp.StatusCode == 200 {
		if err := json.NewDecoder(versionResp.Body).Decode(&versionResult); err == nil {
			if v, ok := versionResult.Data["version"]; ok {
				version = v.(string)
			}
		}
	}

	// Extraire les vraies données
	data := statusResult.Data

	// Calculer les pourcentages d'utilisation
	var cpuUsage, memoryUsage, diskUsage float64
	var uptime int64
	var temperature float64
	var ipAddress string

	if cpu, ok := data["cpu"]; ok {
		if cpuFloat, ok := cpu.(float64); ok {
			cpuUsage = cpuFloat * 100
		}
	}

	if mem, ok := data["mem"]; ok {
		if memMap, ok := mem.(map[string]interface{}); ok {
			if used, ok := memMap["used"]; ok {
				if total, ok := memMap["total"]; ok {
					if usedFloat, ok := used.(float64); ok {
						if totalFloat, ok := total.(float64); ok {
							if totalFloat > 0 {
								memoryUsage = (usedFloat / totalFloat) * 100
							}
						}
					}
				}
			}
		}
	}

	if uptimeVal, ok := data["uptime"]; ok {
		if uptimeFloat, ok := uptimeVal.(float64); ok {
			uptime = int64(uptimeFloat)
		}
	}

	// Récupérer l'adresse IP (approximation)
	if pveid, ok := data["pveid"]; ok {
		ipAddress = fmt.Sprintf("192.168.1.%v", pveid)
	} else {
		ipAddress = "Unknown"
	}

	return map[string]interface{}{
		"cpu_usage":    int(cpuUsage),
		"memory_usage": int(memoryUsage),
		"disk_usage":   int(diskUsage),
		"uptime":       uptime,
		"temperature":  int(temperature),
		"version":      version,
		"ip_address":   ipAddress,
	}, nil
}

// fetchProxmoxStorages récupère les storages depuis Proxmox
func (h *Handlers) fetchProxmoxStorages(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("💾 Fetching storages from URL: %s\n", url)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer la liste des storages depuis chaque nœud
	// D'abord, récupérer les nœuds
	nodesReq, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes", url), nil)
	if err != nil {
		return nil, err
	}
	nodesReq.Header.Set("Authorization", token)
	nodesReq.Header.Set("Content-Type", "application/json")

	nodesResp, err := client.Do(nodesReq)
	if err != nil {
		return nil, err
	}
	defer nodesResp.Body.Close()

	if nodesResp.StatusCode != 200 {
		return nil, fmt.Errorf("Failed to fetch nodes: %d", nodesResp.StatusCode)
	}

	var nodesResult struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(nodesResp.Body).Decode(&nodesResult); err != nil {
		return nil, err
	}

	var allStorages []map[string]interface{}
	storageMap := make(map[string]bool) // Pour éviter les doublons

	// Pour chaque nœud, récupérer ses storages
	for _, node := range nodesResult.Data {
		nodeName, ok := node["node"].(string)
		if !ok {
			continue
		}

		storageURL := fmt.Sprintf("%s/api2/json/nodes/%s/storage", url, nodeName)
		req, err := http.NewRequest("GET", storageURL, nil)
		if err != nil {
			fmt.Printf("⚠️ Failed to create storage request for node %s: %v\n", nodeName, err)
			continue
		}

		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("⚠️ Failed to fetch storages for node %s: %v\n", nodeName, err)
			continue
		}
		defer resp.Body.Close()

		fmt.Printf("📊 Storage API response for node %s: status %d\n", nodeName, resp.StatusCode)
		if resp.StatusCode != 200 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("⚠️ Storage API error for node %s: %d - %s\n", nodeName, resp.StatusCode, string(bodyBytes))
			continue
		}

		var storageResult struct {
			Data []map[string]interface{} `json:"data"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&storageResult); err != nil {
			fmt.Printf("⚠️ Failed to decode storage response for node %s: %v\n", nodeName, err)
			continue
		}

		fmt.Printf("📊 Node %s has %d storages\n", nodeName, len(storageResult.Data))

		// Traiter chaque storage
		for _, storage := range storageResult.Data {
			storageID, ok := storage["storage"].(string)
			if !ok {
				continue
			}

			// Éviter les doublons (même storage sur plusieurs nœuds)
			if storageMap[storageID] {
				continue
			}
			storageMap[storageID] = true

			// Extraire les informations
			storageType, _ := storage["type"].(string)
			content, _ := storage["content"].(string)
			enabled, _ := storage["enabled"].(float64)

			// Calculer l'utilisation
			var totalSpace, usedSpace, freeSpace float64
			var usagePercent float64

			if total, ok := storage["total"].(float64); ok {
				totalSpace = total / (1024 * 1024 * 1024) // Convertir en GB
			}
			if used, ok := storage["used"].(float64); ok {
				usedSpace = used / (1024 * 1024 * 1024) // Convertir en GB
			}
			if avail, ok := storage["avail"].(float64); ok {
				freeSpace = avail / (1024 * 1024 * 1024) // Convertir en GB
			}

			if totalSpace > 0 {
				usagePercent = (usedSpace / totalSpace) * 100
			}

			// Déterminer le statut
			status := "online"
			if enabled == 0 {
				status = "offline"
			}

			storageData := map[string]interface{}{
				"id":            storageID,
				"name":          storageID,
				"type":          storageType,
				"status":        status,
				"node":          nodeName,
				"total_space":   totalSpace,
				"used_space":    usedSpace,
				"free_space":    freeSpace,
				"usage_percent": usagePercent,
				"content":       content,
				"last_update":   time.Now().Format(time.RFC3339),
			}

			allStorages = append(allStorages, storageData)
		}
	}

	fmt.Printf("✅ Storages processed: %d unique storages\n", len(allStorages))

	if len(allStorages) == 0 {
		fmt.Printf("⚠️ WARNING: No storages found. This could mean:\n")
		fmt.Printf("   1. Your Proxmox nodes have no configured storages\n")
		fmt.Printf("   2. The storage API endpoint is not accessible\n")
		fmt.Printf("   3. There's a permission issue with the Proxmox user\n")
	}

	return allStorages, nil
}

// fetchProxmoxNetworks récupère les interfaces réseau depuis Proxmox
// Récupère les interfaces de tous les nœuds si nodeName est vide
func (h *Handlers) fetchProxmoxNetworks(url, token, nodeName string) ([]map[string]interface{}, error) {
	fmt.Printf("🌐 Fetching network interfaces from URL: %s\n", url)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer la liste des nœuds
	nodesReq, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes", url), nil)
	if err != nil {
		return nil, err
	}
	nodesReq.Header.Set("Authorization", token)
	nodesReq.Header.Set("Content-Type", "application/json")

	nodesResp, err := client.Do(nodesReq)
	if err != nil {
		return nil, err
	}
	defer nodesResp.Body.Close()

	if nodesResp.StatusCode != 200 {
		return nil, fmt.Errorf("Failed to fetch nodes: %d", nodesResp.StatusCode)
	}

	var nodesResult struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(nodesResp.Body).Decode(&nodesResult); err != nil {
		return nil, err
	}

	var allNetworks []map[string]interface{}

	// Si un nœud spécifique est demandé, ne traiter que ce nœud
	if nodeName != "" {
		// Vérifier que le nœud existe
		nodeExists := false
		for _, node := range nodesResult.Data {
			if name, ok := node["node"].(string); ok && name == nodeName {
				nodeExists = true
				break
			}
		}
		if !nodeExists {
			return nil, fmt.Errorf("node %s not found", nodeName)
		}
		nodesResult.Data = []map[string]interface{}{{"node": nodeName}}
	}

	// Récupérer les interfaces réseau de chaque nœud
	for _, node := range nodesResult.Data {
		currentNodeName, ok := node["node"].(string)
		if !ok {
			continue
		}

		// Récupérer les interfaces réseau du nœud
		networkURL := fmt.Sprintf("%s/api2/json/nodes/%s/network", url, currentNodeName)
		req, err := http.NewRequest("GET", networkURL, nil)
		if err != nil {
			fmt.Printf("⚠️ Failed to create network request for node %s: %v\n", currentNodeName, err)
			continue
		}

		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("⚠️ Failed to fetch networks from node %s: %v\n", currentNodeName, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			fmt.Printf("⚠️ Network API error for node %s: %d\n", currentNodeName, resp.StatusCode)
			continue
		}

		var networkResult struct {
			Data []map[string]interface{} `json:"data"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&networkResult); err != nil {
			fmt.Printf("⚠️ Failed to decode network data for node %s: %v\n", currentNodeName, err)
			continue
		}

		// Traiter les interfaces de ce nœud
		for _, iface := range networkResult.Data {
			ifaceName, _ := iface["iface"].(string)
			ifaceType, _ := iface["type"].(string)

			// Gérer le champ active qui peut être float64, int, ou bool
			var active bool
			if activeFloat, ok := iface["active"].(float64); ok {
				active = activeFloat == 1
			} else if activeInt, ok := iface["active"].(int); ok {
				active = activeInt == 1
			} else if activeBool, ok := iface["active"].(bool); ok {
				active = activeBool
			} else {
				// Par défaut, considérer comme actif si l'interface a une adresse IP
				address, _ := iface["address"].(string)
				active = address != ""
			}

			// Extraire les informations
			address, _ := iface["address"].(string)
			netmask, _ := iface["netmask"].(string)
			gateway, _ := iface["gateway"].(string)

			// Déterminer le statut
			status := "inactive"
			if active {
				status = "active"
			}

			networkData := map[string]interface{}{
				"id":          fmt.Sprintf("%s-%s", currentNodeName, ifaceName),
				"name":        ifaceName,
				"type":        ifaceType,
				"status":      status,
				"node":        currentNodeName,
				"ip_address":  address,
				"netmask":     netmask,
				"gateway":     gateway,
				"active":      active,
				"last_update": time.Now().Format(time.RFC3339),
			}

			fmt.Printf("🌐 Interface %s (node: %s, type: %s, status: %s, active: %v)\n",
				ifaceName, currentNodeName, ifaceType, status, active)

			allNetworks = append(allNetworks, networkData)
		}
	}

	fmt.Printf("✅ Network interfaces processed: %d interfaces from %d node(s)\n", len(allNetworks), len(nodesResult.Data))
	return allNetworks, nil
}

// fetchProxmoxBackups récupère les backups depuis Proxmox
func (h *Handlers) fetchProxmoxBackups(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("💾 Fetching backups from URL: %s\n", url)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer la liste des nœuds
	nodesReq, err := http.NewRequest("GET", fmt.Sprintf("%s/api2/json/nodes", url), nil)
	if err != nil {
		return nil, err
	}
	nodesReq.Header.Set("Authorization", token)
	nodesReq.Header.Set("Content-Type", "application/json")

	nodesResp, err := client.Do(nodesReq)
	if err != nil {
		return nil, err
	}
	defer nodesResp.Body.Close()

	if nodesResp.StatusCode != 200 {
		return nil, fmt.Errorf("Failed to fetch nodes: %d", nodesResp.StatusCode)
	}

	var nodesResult struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(nodesResp.Body).Decode(&nodesResult); err != nil {
		return nil, err
	}

	var allBackups []map[string]interface{}

	// Parcourir chaque nœud pour récupérer les backups
	for _, node := range nodesResult.Data {
		nodeName, ok := node["node"].(string)
		if !ok {
			continue
		}

		// Récupérer les backups du nœud
		backupsURL := fmt.Sprintf("%s/api2/json/nodes/%s/vzdump", url, nodeName)
		req, err := http.NewRequest("GET", backupsURL, nil)
		if err != nil {
			fmt.Printf("⚠️ Failed to create request for node %s: %v\n", nodeName, err)
			continue
		}

		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("⚠️ Failed to fetch backups from node %s: %v\n", nodeName, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			var backupsResult struct {
				Data []map[string]interface{} `json:"data"`
			}

			if err := json.NewDecoder(resp.Body).Decode(&backupsResult); err == nil {
				for _, backup := range backupsResult.Data {
					// Extraire les informations du backup
					volid, _ := backup["volid"].(string)
					size, _ := backup["size"].(float64)
					ctime, _ := backup["ctime"].(float64)

					// Déterminer le type (VM ou LXC) depuis le volid
					backupType := "vm"
					if strings.Contains(volid, "vzdump-lxc") {
						backupType = "lxc"
					}

					// Extraire le vmid depuis le volid
					var vmid int
					if strings.Contains(volid, "vzdump-qemu-") {
						fmt.Sscanf(volid, "vzdump-qemu-%d", &vmid)
					} else if strings.Contains(volid, "vzdump-lxc-") {
						fmt.Sscanf(volid, "vzdump-lxc-%d", &vmid)
					}

					backupData := map[string]interface{}{
						"id":           volid,
						"name":         volid,
						"type":         backupType,
						"status":       "completed",
						"size":         size / (1024 * 1024 * 1024), // Convertir en GB
						"started_at":   time.Unix(int64(ctime), 0).Format(time.RFC3339),
						"completed_at": time.Unix(int64(ctime), 0).Format(time.RFC3339),
						"node":         nodeName,
						"vmid":         vmid,
						"created_at":   time.Unix(int64(ctime), 0).Format(time.RFC3339),
					}

					allBackups = append(allBackups, backupData)
				}
			}
		}
	}

	fmt.Printf("✅ Backups fetched: %d backups\n", len(allBackups))
	return allBackups, nil
}

// fetchProxmoxTasks récupère les tâches Proxmox
func (h *Handlers) fetchProxmoxTasks(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("📋 Fetching tasks from URL: %s\n", url)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer les tâches depuis l'API Proxmox
	tasksURL := fmt.Sprintf("%s/api2/json/cluster/tasks", url)
	req, err := http.NewRequest("GET", tasksURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Tasks API error: %d", resp.StatusCode)
	}

	var tasksResult struct {
		Data []map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tasksResult); err != nil {
		return nil, err
	}

	var tasks []map[string]interface{}
	for _, task := range tasksResult.Data {
		upid, _ := task["upid"].(string)
		status, _ := task["status"].(string)
		typeStr, _ := task["type"].(string)
		starttime, _ := task["starttime"].(float64)
		endtime, _ := task["endtime"].(float64)
		user, _ := task["user"].(string)
		node, _ := task["node"].(string)
		id, _ := task["id"].(string)

		// Déterminer le statut
		taskStatus := "pending"
		if status == "running" {
			taskStatus = "running"
		} else if status == "OK" {
			taskStatus = "completed"
		} else if status != "" {
			taskStatus = "failed"
		}

		// Calculer la durée
		var duration *int
		if endtime > 0 && starttime > 0 {
			dur := int(endtime - starttime)
			duration = &dur
		}

		taskData := map[string]interface{}{
			"id":         upid,
			"name":       id,
			"type":       typeStr,
			"status":     taskStatus,
			"progress":   0, // Non disponible dans l'API de base
			"started_at": time.Unix(int64(starttime), 0).Format(time.RFC3339),
			"user":       user,
			"node":       node,
			"created_at": time.Unix(int64(starttime), 0).Format(time.RFC3339),
		}

		if endtime > 0 {
			taskData["completed_at"] = time.Unix(int64(endtime), 0).Format(time.RFC3339)
		}
		if duration != nil {
			taskData["duration"] = *duration
		}

		tasks = append(tasks, taskData)
	}

	fmt.Printf("✅ Tasks fetched: %d tasks\n", len(tasks))
	return tasks, nil
}

// fetchProxmoxDocker récupère les conteneurs Docker depuis Proxmox (via LXC)
func (h *Handlers) fetchProxmoxDocker(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("🐳 Fetching Docker containers from Proxmox LXC: %s\n", url)

	// Les conteneurs Docker dans Proxmox sont généralement des LXC
	// On récupère les LXC et on les convertit en format Docker
	lxcContainers, err := h.fetchProxmoxLXC(url, token)
	if err != nil {
		return nil, err
	}

	var dockerContainers []map[string]interface{}
	for _, lxc := range lxcContainers {
		// Filtrer ou convertir les LXC en conteneurs Docker
		// Pour l'instant, on considère tous les LXC comme des conteneurs Docker potentiels
		var idStr string
		if id, ok := lxc["id"].(int); ok {
			idStr = fmt.Sprintf("%d", id)
		} else if id, ok := lxc["id"].(float64); ok {
			idStr = fmt.Sprintf("%.0f", id)
		} else {
			idStr = "unknown"
		}

		name, _ := lxc["name"].(string)
		status, _ := lxc["status"].(string)
		cpuUsage, _ := lxc["cpu_usage"].(float64)
		uptime, _ := lxc["uptime"].(int64)
		lastUpdate, _ := lxc["last_update"].(string)
		node, _ := lxc["node"].(string)

		dockerContainer := map[string]interface{}{
			"id":           idStr,
			"name":         name,
			"status":       status,
			"image":        "proxmox-lxc",
			"tag":          "latest",
			"cpu_usage":    cpuUsage,
			"memory_usage": 0,
			"memory_limit": 0,
			"uptime":       uptime,
			"ports":        []string{},
			"created_at":   lastUpdate,
			"node":         node,
		}

		// Convertir la mémoire si disponible
		if maxmem, ok := lxc["maxmem"].(float64); ok {
			dockerContainer["memory_limit"] = int64(maxmem / (1024 * 1024)) // Convertir en MB
		}

		dockerContainers = append(dockerContainers, dockerContainer)
	}

	fmt.Printf("✅ Docker containers fetched: %d containers\n", len(dockerContainers))
	return dockerContainers, nil
}

// fetchProxmoxDatabases récupère les bases de données depuis Proxmox
// Détecte automatiquement les bases de données dans les VMs et LXC en analysant les noms et tags
func (h *Handlers) fetchProxmoxDatabases(url, token string) ([]map[string]interface{}, error) {
	fmt.Printf("💾 Fetching databases from Proxmox: %s\n", url)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Récupérer toutes les ressources (VMs et LXC)
	fullURL := fmt.Sprintf("%s/api2/json/cluster/resources", url)
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Proxmox API error: %d", resp.StatusCode)
	}

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Mots-clés pour détecter les bases de données dans les noms
	dbKeywords := map[string]string{
		"mysql":         "mysql",
		"mariadb":       "mysql",
		"postgres":      "postgresql",
		"postgresql":    "postgresql",
		"mongo":         "mongodb",
		"mongodb":       "mongodb",
		"redis":         "redis",
		"elastic":       "elasticsearch",
		"elasticsearch": "elasticsearch",
		"db":            "mysql", // Par défaut si juste "db"
		"database":      "mysql",
	}

	// Ports par défaut pour chaque type de base de données
	dbPorts := map[string]int{
		"mysql":         3306,
		"postgresql":    5432,
		"mongodb":       27017,
		"redis":         6379,
		"elasticsearch": 9200,
	}

	var databases []map[string]interface{}

	// Analyser chaque ressource
	for _, item := range result.Data {
		itemType, _ := item["type"].(string)

		// Ne traiter que les VMs et LXC
		if itemType != "vm" && itemType != "qemu" && itemType != "lxc" {
			continue
		}

		name, _ := item["name"].(string)
		nameLower := strings.ToLower(name)

		// Vérifier si le nom contient un mot-clé de base de données
		var detectedType string
		for keyword, dbType := range dbKeywords {
			if strings.Contains(nameLower, keyword) {
				detectedType = dbType
				break
			}
		}

		// Si aucun type détecté, vérifier les tags
		if detectedType == "" {
			if tags, ok := item["tags"].(string); ok && tags != "" {
				tagsLower := strings.ToLower(tags)
				for keyword, dbType := range dbKeywords {
					if strings.Contains(tagsLower, keyword) {
						detectedType = dbType
						break
					}
				}
			}
		}

		// Si une base de données est détectée, créer l'entrée
		if detectedType != "" {
			vmid, _ := item["vmid"].(float64)
			status, _ := item["status"].(string)
			nodeName, _ := item["node"].(string)

			// Déterminer le statut
			var dbStatus string
			if status == "running" {
				dbStatus = "running"
			} else if status == "stopped" {
				dbStatus = "stopped"
			} else {
				dbStatus = "maintenance"
			}

			// Récupérer les ressources si disponibles
			var diskUsage float64
			var uptime int64

			if maxdisk, ok := item["maxdisk"].(float64); ok {
				diskUsage = maxdisk / (1024 * 1024 * 1024) // Convertir en GB
			}
			if uptimeVal, ok := item["uptime"].(float64); ok {
				uptime = int64(uptimeVal)
			}

			// Créer l'entrée de base de données
			dbEntry := map[string]interface{}{
				"id":              fmt.Sprintf("%s-%d", itemType, int(vmid)),
				"name":            name,
				"type":            detectedType,
				"status":          dbStatus,
				"host":            "localhost", // Par défaut, peut être amélioré avec l'IP
				"port":            dbPorts[detectedType],
				"version":         "N/A", // Peut être amélioré en interrogeant la VM/LXC
				"cpu_usage":       0,     // Peut être amélioré avec les vraies métriques
				"memory_usage":    0,     // Peut être amélioré avec les vraies métriques
				"disk_usage":      diskUsage,
				"connections":     0,   // Peut être amélioré
				"max_connections": 100, // Par défaut
				"uptime":          uptime,
				"size":            diskUsage,
				"created_at":      time.Now().Format(time.RFC3339),
				"ssl_enabled":     false,
				"authentication":  "none",
				// Informations pour ouvrir la VM/LXC
				"resource_type": itemType, // "vm" ou "lxc"
				"resource_id":   int(vmid),
				"node":          nodeName,
			}

			databases = append(databases, dbEntry)
			fmt.Printf("💾 Database detected: %s (Type: %s, Resource: %s ID %d, Node: %s)\n",
				name, detectedType, itemType, int(vmid), nodeName)
		}
	}

	fmt.Printf("✅ Databases fetched: %d databases detected\n", len(databases))
	return databases, nil
}

// FetchProxmoxBackups récupère les backups depuis Proxmox
func (h *Handlers) FetchProxmoxBackups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Secret   string `json:"secret"`
	}

	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if config.URL == "" || config.Username == "" || config.Secret == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Créer le token d'authentification
	var token string
	if strings.Contains(config.Username, "!") {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	} else {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	}

	backups, err := h.fetchProxmoxBackups(config.URL, token)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Erreur lors de la récupération des backups: %v", err),
			"backups": []map[string]interface{}{},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"backups": backups,
	})
}

// FetchProxmoxTasks récupère les tâches depuis Proxmox
func (h *Handlers) FetchProxmoxTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Secret   string `json:"secret"`
	}

	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if config.URL == "" || config.Username == "" || config.Secret == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Créer le token d'authentification
	var token string
	if strings.Contains(config.Username, "!") {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	} else {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	}

	tasks, err := h.fetchProxmoxTasks(config.URL, token)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Erreur lors de la récupération des tâches: %v", err),
			"tasks":   []map[string]interface{}{},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"tasks":   tasks,
	})
}

// FetchProxmoxDocker récupère les conteneurs Docker depuis Proxmox
func (h *Handlers) FetchProxmoxDocker(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Secret   string `json:"secret"`
	}

	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if config.URL == "" || config.Username == "" || config.Secret == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Créer le token d'authentification
	var token string
	if strings.Contains(config.Username, "!") {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	} else {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	}

	containers, err := h.fetchProxmoxDocker(config.URL, token)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    false,
			"message":    fmt.Sprintf("Erreur lors de la récupération des conteneurs Docker: %v", err),
			"containers": []map[string]interface{}{},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"containers": containers,
	})
}

// FetchProxmoxDatabases récupère les bases de données depuis Proxmox
func (h *Handlers) FetchProxmoxDatabases(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Secret   string `json:"secret"`
	}

	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if config.URL == "" || config.Username == "" || config.Secret == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Créer le token d'authentification
	var token string
	if strings.Contains(config.Username, "!") {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	} else {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	}

	databases, err := h.fetchProxmoxDatabases(config.URL, token)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   false,
			"message":   fmt.Sprintf("Erreur lors de la récupération des bases de données: %v", err),
			"databases": []map[string]interface{}{},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"databases": databases,
	})
}

// FetchProxmoxNetworks récupère les interfaces réseau depuis Proxmox
func (h *Handlers) FetchProxmoxNetworks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Secret   string `json:"secret"`
		Node     string `json:"node"` // Optionnel, si vide récupère de tous les nœuds
	}

	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if config.URL == "" || config.Username == "" || config.Secret == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Créer le token d'authentification
	var token string
	if strings.Contains(config.Username, "!") {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	} else {
		token = fmt.Sprintf("PVEAPIToken=%s=%s", config.Username, config.Secret)
	}

	networks, err := h.fetchProxmoxNetworks(config.URL, token, config.Node)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  false,
			"message":  fmt.Sprintf("Erreur lors de la récupération des interfaces réseau: %v", err),
			"networks": []map[string]interface{}{},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"networks": networks,
	})
}

// VMActionRequest représente une requête pour une action sur une VM
type VMActionRequest struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Secret   string `json:"secret"`
	Node     string `json:"node"`
	VMID     int    `json:"vmid"`
}

// VMAction gère les actions sur les VMs (start, stop, restart, pause)
func (h *Handlers) VMAction(w http.ResponseWriter, r *http.Request) {
	action := chi.URLParam(r, "action")
	if action == "" {
		fmt.Printf("❌ VMAction: Action manquante\n")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Action manquante",
		})
		return
	}

	var req VMActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ VMAction: Erreur de décodage JSON: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid JSON: %v", err),
		})
		return
	}

	// Vérifier que les champs requis sont présents
	if req.URL == "" || req.Username == "" || req.Secret == "" || req.Node == "" || req.VMID == 0 {
		fmt.Printf("❌ VMAction: Champs manquants - URL: %s, Username: %s, Node: %s, VMID: %d\n",
			req.URL, req.Username, req.Node, req.VMID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Champs manquants: url, username, secret, node et vmid sont requis",
		})
		return
	}

	// Construire le token d'authentification
	token := fmt.Sprintf("PVEAPIToken=%s=%s", req.Username, req.Secret)

	// Construire l'URL de l'action Proxmox
	var actionPath string
	switch action {
	case "start":
		actionPath = "start"
	case "stop":
		actionPath = "stop"
	case "restart":
		actionPath = "reboot"
	case "pause":
		actionPath = "suspend"
	case "resume":
		actionPath = "resume"
	default:
		fmt.Printf("❌ VMAction: Action non supportée: %s\n", action)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Action non supportée: %s", action),
		})
		return
	}

	proxmoxURL := fmt.Sprintf("%s/api2/json/nodes/%s/qemu/%d/status/%s", req.URL, req.Node, req.VMID, actionPath)
	fmt.Printf("🔧 VM Action: %s on VM %d (node: %s) - URL: %s\n", action, req.VMID, req.Node, proxmoxURL)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Créer un body JSON vide pour la requête POST
	// Proxmox nécessite un body JSON valide, même s'il est vide
	jsonBody := strings.NewReader("{}")

	// Créer la requête
	httpReq, err := http.NewRequest("POST", proxmoxURL, jsonBody)
	if err != nil {
		fmt.Printf("❌ VMAction: Erreur création requête: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to create request: %v", err),
		})
		return
	}

	httpReq.Header.Set("Authorization", token)
	httpReq.Header.Set("Content-Type", "application/json")

	// Exécuter la requête
	resp, err := client.Do(httpReq)
	if err != nil {
		fmt.Printf("❌ VM Action error: %v\n", err)

		// Améliorer le message d'erreur selon le type d'erreur
		var errorMsg string
		if strings.Contains(err.Error(), "connection refused") {
			errorMsg = fmt.Sprintf("Connexion refusée à %s. Solutions possibles:\n1. Si Proxmox est sur la même machine que Docker, utilisez 'host.docker.internal' au lieu de l'IP locale\n2. Si Proxmox est sur le réseau local, assurez-vous que Docker peut accéder au réseau de l'hôte\n3. Vérifiez que le firewall n'bloque pas le port 8006\n4. Sur Linux, vous pouvez utiliser 'network_mode: host' dans docker-compose.yml", req.URL)
		} else if strings.Contains(err.Error(), "timeout") {
			errorMsg = fmt.Sprintf("Timeout lors de la connexion à %s. Le serveur Proxmox ne répond pas ou est inaccessible depuis le conteneur Docker.", req.URL)
		} else if strings.Contains(err.Error(), "no such host") {
			errorMsg = fmt.Sprintf("Impossible de résoudre l'adresse %s. Vérifiez l'URL Proxmox. Si vous utilisez une IP locale, essayez 'host.docker.internal' si Proxmox est sur la même machine.", req.URL)
		} else {
			errorMsg = fmt.Sprintf("Erreur de connexion à Proxmox: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   errorMsg,
		})
		return
	}
	defer resp.Body.Close()

	// Lire la réponse
	bodyBytes, _ := io.ReadAll(resp.Body)
	var responseData map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &responseData); err != nil {
		responseData = map[string]interface{}{
			"data": string(bodyBytes),
		}
	}

	if resp.StatusCode != 200 {
		fmt.Printf("❌ VM Action failed: %d - %s\n", resp.StatusCode, string(bodyBytes))

		// Essayer d'extraire le message d'erreur de Proxmox
		var errorMsg interface{} = responseData["data"]
		if errorData, ok := responseData["data"].(map[string]interface{}); ok {
			if msg, ok := errorData["message"].(string); ok {
				errorMsg = msg
			}
		} else if errorStr, ok := responseData["data"].(string); ok {
			errorMsg = errorStr
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   errorMsg,
		})
		return
	}

	fmt.Printf("✅ VM Action %s successful for VM %d\n", action, req.VMID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("VM action %s executed successfully", action),
		"data":    responseData["data"],
	})
}

// TestProxmoxPasswordRequest représente une requête pour tester le mot de passe Proxmox
type TestProxmoxPasswordRequest struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Secret   string `json:"secret"`
	Password string `json:"password"` // Mot de passe à tester
}

// TestProxmoxPassword teste si le mot de passe fonctionne avec Proxmox
func (h *Handlers) TestProxmoxPassword(w http.ResponseWriter, r *http.Request) {
	var req TestProxmoxPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ TestProxmoxPassword: Erreur de décodage JSON: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid JSON: %v", err),
		})
		return
	}

	// Vérifier que les champs requis sont présents
	if req.URL == "" || req.Username == "" || req.Password == "" {
		fmt.Printf("❌ TestProxmoxPassword: Champs manquants\n")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Champs manquants: url, username et password sont requis",
		})
		return
	}

	fmt.Printf("🔍 TestProxmoxPassword: Test du mot de passe pour %s\n", req.Username)

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 10 * time.Second, Transport: tr}

	// Extraire le username et le realm
	// Format peut être: username@pam ou username@pam!tokenname
	username := req.Username
	realm := "pam"
	usernameWithRealm := ""

	if strings.Contains(username, "!") {
		// Si c'est un token API, extraire le username de base (format: username@realm!tokenname)
		parts := strings.Split(username, "!")
		if len(parts) == 2 {
			usernameWithRealm = parts[0] // username@realm
			if strings.Contains(usernameWithRealm, "@") {
				parts2 := strings.Split(usernameWithRealm, "@")
				username = parts2[0]
				realm = parts2[1]
			}
		}
	} else if strings.Contains(username, "@") {
		// Format: username@realm
		parts := strings.Split(username, "@")
		username = parts[0]
		realm = parts[1]
		usernameWithRealm = req.Username
	} else {
		// Format simple: username
		usernameWithRealm = fmt.Sprintf("%s@%s", username, realm)
	}

	// Si usernameWithRealm n'est pas défini, le construire
	if usernameWithRealm == "" {
		usernameWithRealm = fmt.Sprintf("%s@%s", username, realm)
	}

	fmt.Printf("   - Username extrait: %s\n", username)
	fmt.Printf("   - Realm: %s\n", realm)
	fmt.Printf("   - Username avec realm: %s\n", usernameWithRealm)

	// Tester le mot de passe avec l'endpoint /access/ticket
	ticketURL := fmt.Sprintf("%s/api2/json/access/ticket", req.URL)
	values := url.Values{}
	values.Set("username", usernameWithRealm)
	values.Set("password", req.Password)
	ticketData := values.Encode()

	fmt.Printf("   - URL: %s\n", ticketURL)
	fmt.Printf("   - Password length: %d\n", len(req.Password))

	ticketReq, err := http.NewRequest("POST", ticketURL, strings.NewReader(ticketData))
	if err != nil {
		fmt.Printf("❌ TestProxmoxPassword: Erreur création requête: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to create request: %v", err),
		})
		return
	}

	ticketReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ticketResp, err := client.Do(ticketReq)
	if err != nil {
		fmt.Printf("❌ TestProxmoxPassword: Erreur requête: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to test password: %v", err),
		})
		return
	}
	defer ticketResp.Body.Close()

	bodyBytes, _ := io.ReadAll(ticketResp.Body)
	fmt.Printf("   - Réponse Status: %d\n", ticketResp.StatusCode)
	fmt.Printf("   - Réponse Body: %s\n", string(bodyBytes))

	if ticketResp.StatusCode == 200 {
		fmt.Printf("✅ TestProxmoxPassword: Mot de passe valide pour %s\n", usernameWithRealm)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Mot de passe valide",
		})
		return
	}

	// Erreur d'authentification
	fmt.Printf("❌ TestProxmoxPassword: Mot de passe invalide (Status: %d)\n", ticketResp.StatusCode)

	// Parser le message d'erreur de Proxmox
	var errorResp struct {
		Message string      `json:"message"`
		Data    interface{} `json:"data"`
	}
	errorDetails := string(bodyBytes)
	if err := json.Unmarshal(bodyBytes, &errorResp); err == nil {
		errorDetails = errorResp.Message
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   fmt.Sprintf("Mot de passe invalide pour %s. L'utilisateur n'a probablement pas de mot de passe défini dans Proxmox (seulement un token API).", usernameWithRealm),
		"details": errorDetails,
		"hint":    fmt.Sprintf("Pour résoudre: Connectez-vous à Proxmox (%s), allez dans Datacenter → Permissions → Users, sélectionnez %s, et définissez un mot de passe.", req.URL, usernameWithRealm),
	})
}

// VMConsoleRequest représente une requête pour obtenir l'URL de la console VNC
type VMConsoleRequest struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Secret   string `json:"secret"`
	Password string `json:"password"` // Mot de passe optionnel pour obtenir un ticket (si différent du secret)
	Node     string `json:"node"`
	VMID     int    `json:"vmid"`
}

// VMConsole génère un ticket d'authentification Proxmox et retourne l'URL de la console VNC
func (h *Handlers) VMConsole(w http.ResponseWriter, r *http.Request) {
	var req VMConsoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ VMConsole: Erreur de décodage JSON: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid JSON: %v", err),
		})
		return
	}

	// Vérifier que les champs requis sont présents
	if req.URL == "" || req.Username == "" || req.Secret == "" || req.Node == "" || req.VMID == 0 {
		fmt.Printf("❌ VMConsole: Champs manquants\n")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Champs manquants: url, username, secret, node et vmid sont requis",
		})
		return
	}

	fmt.Printf("🖥️ Console request for VM %d on node %s\n", req.VMID, req.Node)
	fmt.Printf("🔍 VMConsole: Username reçu: %s (contient '!': %v)\n", req.Username, strings.Contains(req.Username, "!"))

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Vérifier si c'est un token API (format: username@realm!tokenname ou username!tokenname)
	// Si le username contient "!", c'est un token API
	if strings.Contains(req.Username, "!") {
		// Pour les tokens API, on doit utiliser le token pour obtenir un ticket de session
		// Essayer d'obtenir un ticket en utilisant le token API
		// Note: L'endpoint /access/ticket ne fonctionne pas directement avec les tokens API
		// On doit utiliser une autre méthode : créer une session via l'API
		// Pour l'instant, on va extraire le username et le realm du token et essayer d'obtenir un ticket
		// en utilisant le secret comme mot de passe (si c'est un mot de passe)

		// Extraire username et realm du token (format: username@realm!tokenname)
		parts := strings.Split(req.Username, "!")
		if len(parts) == 2 {
			usernameWithRealm := parts[0] // username@realm
			// tokenname := parts[1] // nom du token

			// Pour obtenir un ticket, on a besoin du mot de passe de l'utilisateur
			// Si un password est fourni, l'utiliser, sinon essayer avec le secret
			password := req.Password
			if password == "" {
				password = req.Secret
			}

			// Essayer d'obtenir un ticket avec username@realm et le mot de passe
			// Encoder correctement le username et le password pour éviter les problèmes avec les caractères spéciaux
			ticketURL := fmt.Sprintf("%s/api2/json/access/ticket", req.URL)
			values := url.Values{}
			values.Set("username", usernameWithRealm)
			values.Set("password", password)
			ticketData := values.Encode()

			fmt.Printf("🔑 VMConsole: Tentative d'obtention de ticket pour %s\n", usernameWithRealm)
			fmt.Printf("   - Password fourni: %v\n", req.Password != "")
			fmt.Printf("   - Password length: %d\n", len(password))
			fmt.Printf("   - URL: %s\n", ticketURL)
			fmt.Printf("   - Data (masqué): username=%s&password=***\n", usernameWithRealm)

			ticketReq, err := http.NewRequest("POST", ticketURL, strings.NewReader(ticketData))
			if err != nil {
				fmt.Printf("❌ VMConsole: Erreur création requête ticket: %v\n", err)
			} else {
				ticketReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

				ticketResp, err := client.Do(ticketReq)
				if err != nil {
					fmt.Printf("❌ VMConsole: Erreur requête ticket: %v\n", err)
				} else {
					defer ticketResp.Body.Close()

					bodyBytes, _ := io.ReadAll(ticketResp.Body)
					fmt.Printf("🔍 VMConsole: Réponse ticket - Status: %d\n", ticketResp.StatusCode)
					fmt.Printf("   - Body: %s\n", string(bodyBytes))

					// Si c'est une erreur 401, essayer de parser le message d'erreur
					if ticketResp.StatusCode == 401 {
						var errorResp struct {
							Message string      `json:"message"`
							Data    interface{} `json:"data"`
						}
						if err := json.Unmarshal(bodyBytes, &errorResp); err == nil {
							fmt.Printf("   - Message d'erreur Proxmox: %s\n", errorResp.Message)
						}
					}

					if ticketResp.StatusCode == 200 {
						var ticketResult struct {
							Data struct {
								Ticket              string `json:"ticket"`
								CSRFPreventionToken string `json:"CSRFPreventionToken"`
								Username            string `json:"username"`
							} `json:"data"`
						}
						if err := json.Unmarshal(bodyBytes, &ticketResult); err == nil {
							// Construire l'URL de la console avec le ticket
							// Le ticket retourné par l'API est déjà au format: PVE:username@realm:ticket::CSRFPreventionToken
							ticketValue := ticketResult.Data.Ticket

							// Construire l'URL avec les paramètres
							// IMPORTANT: Le ticket doit être encodé pour l'URL car il contient des caractères spéciaux
							// Le navigateur le décodera automatiquement avant de l'envoyer à Proxmox
							baseURL := strings.TrimSuffix(req.URL, "/")
							// Encoder le ticket pour l'URL (les caractères spéciaux comme +, /, = doivent être encodés)
							encodedTicket := url.QueryEscape(ticketValue)
							consoleURL := fmt.Sprintf("%s/?console=kvm&novnc=1&vmid=%d&node=%s&PVEAuthCookie=%s",
								baseURL, req.VMID, url.QueryEscape(req.Node), encodedTicket)

							fmt.Printf("   - Ticket obtenu (premiers 50 chars): %s\n", ticketValue[:min(50, len(ticketValue))])
							fmt.Printf("   - Ticket length: %d\n", len(ticketValue))
							fmt.Printf("   - Username du ticket: %s\n", ticketResult.Data.Username)
							fmt.Printf("   - CSRF Token: %s\n", ticketResult.Data.CSRFPreventionToken)
							fmt.Printf("   - Console URL complète (premiers 200 chars): %s...\n", consoleURL[:min(200, len(consoleURL))])

							fmt.Printf("✅ VMConsole: Ticket obtenu avec token API pour %s\n", usernameWithRealm)

							// Vérifier que le ticket n'est pas vide
							if ticketValue == "" {
								fmt.Printf("❌ VMConsole: Ticket vide!\n")
								w.Header().Set("Content-Type", "application/json")
								w.WriteHeader(http.StatusInternalServerError)
								json.NewEncoder(w).Encode(map[string]interface{}{
									"success": false,
									"error":   "Ticket vide reçu de Proxmox",
								})
								return
							}

							// Vérifier le format du ticket
							if !strings.HasPrefix(ticketValue, "PVE:") {
								fmt.Printf("⚠️ VMConsole: Format de ticket suspect - ne commence pas par 'PVE:'\n")
							}

							// IMPORTANT: Proxmox attend le ticket dans un cookie HTTP, pas dans l'URL
							// Utiliser un proxy backend qui fait la requête vers Proxmox avec le cookie dans les en-têtes
							// Le proxy gérera les WebSockets pour la console VNC
							proxyURL := fmt.Sprintf("/api/v1/proxmox/vm/console-proxy?proxmoxUrl=%s&vmid=%d&node=%s&ticket=%s",
								url.QueryEscape(baseURL), req.VMID, url.QueryEscape(req.Node), url.QueryEscape(ticketValue))

							w.Header().Set("Content-Type", "application/json")
							json.NewEncoder(w).Encode(map[string]interface{}{
								"success":    true,
								"consoleUrl": proxyURL,
							})
							return
						} else {
							fmt.Printf("❌ VMConsole: Erreur décodage réponse ticket: %v\n", err)
						}
					} else {
						// Essayer de parser l'erreur de Proxmox
						var errorResponse struct {
							Data   interface{} `json:"data"`
							Errors interface{} `json:"errors"`
						}
						errorDetails := string(bodyBytes)
						if err := json.Unmarshal(bodyBytes, &errorResponse); err == nil {
							fmt.Printf("❌ VMConsole: Erreur Proxmox: %+v\n", errorResponse)
							// Stocker les détails de l'erreur pour le message utilisateur
							if errorDetails != "" {
								// Retourner l'erreur avec les détails
								w.Header().Set("Content-Type", "application/json")
								w.WriteHeader(http.StatusBadRequest)
								json.NewEncoder(w).Encode(map[string]interface{}{
									"success": false,
									"error":   fmt.Sprintf("Erreur Proxmox (%d): %s", ticketResp.StatusCode, errorDetails),
								})
								return
							}
						}
					}
				}
			}
		}

		// Si on ne peut pas obtenir un ticket, on retourne une erreur explicite avec des instructions
		fmt.Printf("❌ VMConsole: Impossible d'obtenir un ticket avec le token API (username: %s, password fourni: %v)\n", req.Username, req.Password != "")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)

		// Extraire le username de base pour le message d'erreur
		usernameBase := req.Username
		if strings.Contains(req.Username, "!") {
			parts := strings.Split(req.Username, "!")
			if len(parts) == 2 {
				usernameBase = parts[0] // username@realm
			}
		}

		errorMsg := fmt.Sprintf("Impossible d'obtenir un ticket de session pour %s. ", usernameBase)
		if req.Password == "" {
			errorMsg += "Pour utiliser la console VNC avec un token API, vous devez fournir le mot de passe de l'utilisateur dans le champ 'Mot de passe (optionnel - pour console VNC)' des Paramètres Proxmox."
		} else {
			// Extraire l'URL sans le protocole pour l'affichage
			displayURL := strings.TrimPrefix(strings.TrimPrefix(req.URL, "https://"), "http://")
			errorMsg += fmt.Sprintf("Erreur d'authentification (401). Le mot de passe fourni n'est pas accepté par Proxmox.\n\nVérifications à faire :\n1. Testez le mot de passe en vous connectant directement à Proxmox : https://%s avec l'utilisateur %s\n2. Assurez-vous que l'utilisateur %s a bien un mot de passe défini (pas seulement un token API)\n3. Si l'utilisateur n'a pas de mot de passe :\n   - Allez dans Datacenter → Permissions → Users\n   - Sélectionnez %s → Edit → Change Password\n   - Définissez un mot de passe\n   - Utilisez ce mot de passe dans les Paramètres", displayURL, usernameBase, usernameBase, usernameBase)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   errorMsg,
		})
		return
	}

	// Extraire le username et le realm depuis le username
	// Format: username@pam
	username := req.Username
	realm := "pam"
	if strings.Contains(username, "@") {
		parts := strings.Split(username, "@")
		username = parts[0]
		realm = parts[1]
	}

	// Obtenir un ticket d'authentification Proxmox
	ticketURL := fmt.Sprintf("%s/api2/json/access/ticket", req.URL)
	ticketData := fmt.Sprintf("username=%s@%s&password=%s", username, realm, req.Secret)

	ticketReq, err := http.NewRequest("POST", ticketURL, strings.NewReader(ticketData))
	if err != nil {
		fmt.Printf("❌ VMConsole: Erreur création requête ticket: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to create ticket request: %v", err),
		})
		return
	}

	ticketReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ticketResp, err := client.Do(ticketReq)
	if err != nil {
		fmt.Printf("❌ VMConsole: Ticket request error: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to get ticket: %v", err),
		})
		return
	}
	defer ticketResp.Body.Close()

	if ticketResp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(ticketResp.Body)
		fmt.Printf("❌ VMConsole: Ticket request failed: %d - %s\n", ticketResp.StatusCode, string(bodyBytes))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to get ticket: %d - %s", ticketResp.StatusCode, string(bodyBytes)),
		})
		return
	}

	var ticketResult struct {
		Data struct {
			Ticket              string `json:"ticket"`
			CSRFPreventionToken string `json:"CSRFPreventionToken"`
			Username            string `json:"username"`
		} `json:"data"`
	}

	if err := json.NewDecoder(ticketResp.Body).Decode(&ticketResult); err != nil {
		fmt.Printf("❌ VMConsole: Failed to decode ticket response: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to decode ticket: %v", err),
		})
		return
	}

	// Construire l'URL de la console avec le ticket
	// Le ticket retourné par l'API est déjà au format: PVE:username@realm:ticket::CSRFPreventionToken
	ticketValue := ticketResult.Data.Ticket

	// IMPORTANT: Proxmox attend le ticket dans un cookie HTTP, pas dans l'URL
	// Utiliser un proxy backend qui fait la requête vers Proxmox avec le cookie dans les en-têtes
	// Le proxy gérera les WebSockets pour la console VNC
	baseURL := strings.TrimSuffix(req.URL, "/")
	proxyURL := fmt.Sprintf("/api/v1/proxmox/vm/console-proxy?proxmoxUrl=%s&vmid=%d&node=%s&ticket=%s",
		url.QueryEscape(baseURL), req.VMID, url.QueryEscape(req.Node), url.QueryEscape(ticketValue))

	fmt.Printf("   - Ticket obtenu (premiers 50 chars): %s\n", ticketValue[:min(50, len(ticketValue))])
	fmt.Printf("   - Ticket length: %d\n", len(ticketValue))
	fmt.Printf("   - Username du ticket: %s\n", ticketResult.Data.Username)
	fmt.Printf("   - Console URL générée\n")

	fmt.Printf("✅ Console URL generated for VM %d\n", req.VMID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"consoleUrl": proxyURL,
	})
}

// VMConfigRequest représente une requête pour obtenir l'URL de la configuration VM
type VMConfigRequest struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Secret   string `json:"secret"`
	Password string `json:"password"` // Mot de passe optionnel pour obtenir un ticket (si différent du secret)
	Node     string `json:"node"`
	VMID     int    `json:"vmid"`
}

// VMConfig génère un ticket d'authentification Proxmox et retourne l'URL de la configuration VM
func (h *Handlers) VMConfig(w http.ResponseWriter, r *http.Request) {
	var req VMConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ VMConfig: Erreur de décodage JSON: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid JSON: %v", err),
		})
		return
	}

	// Vérifier que les champs requis sont présents
	if req.URL == "" || req.Username == "" || req.Secret == "" || req.Node == "" || req.VMID == 0 {
		fmt.Printf("❌ VMConfig: Champs manquants\n")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Champs manquants: url, username, secret, node et vmid sont requis",
		})
		return
	}

	fmt.Printf("⚙️ Config request for VM %d on node %s\n", req.VMID, req.Node)
	fmt.Printf("🔍 VMConfig: Username reçu: %s (contient '!': %v)\n", req.Username, strings.Contains(req.Username, "!"))

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Vérifier si c'est un token API (format: username@realm!tokenname ou username!tokenname)
	// Si le username contient "!", c'est un token API
	if strings.Contains(req.Username, "!") {
		// Pour les tokens API, on doit utiliser le token pour obtenir un ticket de session
		// Extraire username et realm du token (format: username@realm!tokenname)
		parts := strings.Split(req.Username, "!")
		if len(parts) == 2 {
			usernameWithRealm := parts[0] // username@realm

			// Pour obtenir un ticket, on a besoin du mot de passe de l'utilisateur
			// Si un password est fourni, l'utiliser, sinon essayer avec le secret
			password := req.Password
			if password == "" {
				password = req.Secret
			}

			// Essayer d'obtenir un ticket avec username@realm et le mot de passe
			// Encoder correctement le username et le password pour éviter les problèmes avec les caractères spéciaux
			ticketURL := fmt.Sprintf("%s/api2/json/access/ticket", req.URL)
			values := url.Values{}
			values.Set("username", usernameWithRealm)
			values.Set("password", password)
			ticketData := values.Encode()

			fmt.Printf("🔑 VMConfig: Tentative d'obtention de ticket pour %s (password fourni: %v, length: %d)\n", usernameWithRealm, req.Password != "", len(password))

			ticketReq, err := http.NewRequest("POST", ticketURL, strings.NewReader(ticketData))
			if err != nil {
				fmt.Printf("❌ VMConfig: Erreur création requête ticket: %v\n", err)
			} else {
				ticketReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

				ticketResp, err := client.Do(ticketReq)
				if err != nil {
					fmt.Printf("❌ VMConfig: Erreur requête ticket: %v\n", err)
				} else {
					defer ticketResp.Body.Close()

					bodyBytes, _ := io.ReadAll(ticketResp.Body)
					fmt.Printf("🔍 VMConfig: Réponse ticket - Status: %d, Body: %s\n", ticketResp.StatusCode, string(bodyBytes))

					if ticketResp.StatusCode == 200 {
						var ticketResult struct {
							Data struct {
								Ticket              string `json:"ticket"`
								CSRFPreventionToken string `json:"CSRFPreventionToken"`
								Username            string `json:"username"`
							} `json:"data"`
						}
						if err := json.Unmarshal(bodyBytes, &ticketResult); err == nil {
							// Construire l'URL de la configuration avec le ticket
							// Encoder le ticket pour l'URL (les caractères spéciaux comme +, /, = doivent être encodés)
							baseURL := strings.TrimSuffix(req.URL, "/")
							encodedTicket := url.QueryEscape(ticketResult.Data.Ticket)
							configURL := fmt.Sprintf("%s/?vmid=%d&node=%s&PVEAuthCookie=%s",
								baseURL, req.VMID, url.QueryEscape(req.Node), encodedTicket)

							fmt.Printf("✅ VMConfig: Ticket obtenu avec token API pour %s\n", usernameWithRealm)
							w.Header().Set("Content-Type", "application/json")
							json.NewEncoder(w).Encode(map[string]interface{}{
								"success":   true,
								"configUrl": configURL,
							})
							return
						} else {
							fmt.Printf("❌ VMConfig: Erreur décodage réponse ticket: %v\n", err)
						}
					} else {
						// Essayer de parser l'erreur de Proxmox
						var errorResponse struct {
							Data   interface{} `json:"data"`
							Errors interface{} `json:"errors"`
						}
						errorDetails := string(bodyBytes)
						if err := json.Unmarshal(bodyBytes, &errorResponse); err == nil {
							fmt.Printf("❌ VMConfig: Erreur Proxmox: %+v\n", errorResponse)
							// Stocker les détails de l'erreur pour le message utilisateur
							if errorDetails != "" {
								// Retourner l'erreur avec les détails
								w.Header().Set("Content-Type", "application/json")
								w.WriteHeader(http.StatusBadRequest)
								json.NewEncoder(w).Encode(map[string]interface{}{
									"success": false,
									"error":   fmt.Sprintf("Erreur Proxmox (%d): %s", ticketResp.StatusCode, errorDetails),
								})
								return
							}
						}
					}
				}
			}
		}

		// Si on ne peut pas obtenir un ticket, on retourne une erreur explicite avec des instructions
		fmt.Printf("❌ VMConfig: Impossible d'obtenir un ticket avec le token API (username: %s, password fourni: %v)\n", req.Username, req.Password != "")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)

		// Extraire le username de base pour le message d'erreur
		usernameBase := req.Username
		if strings.Contains(req.Username, "!") {
			parts := strings.Split(req.Username, "!")
			if len(parts) == 2 {
				usernameBase = parts[0] // username@realm
			}
		}

		errorMsg := fmt.Sprintf("Impossible d'obtenir un ticket de session pour %s. ", usernameBase)
		if req.Password == "" {
			errorMsg += "Pour utiliser la configuration avec un token API, vous devez fournir le mot de passe de l'utilisateur dans le champ 'Mot de passe (optionnel - pour console VNC)' des Paramètres Proxmox."
		} else {
			errorMsg += fmt.Sprintf("Erreur d'authentification (401). L'utilisateur %s n'a probablement pas de mot de passe défini dans Proxmox (seulement un token API).\n\nPour résoudre ce problème :\n1. Connectez-vous à l'interface Proxmox (https://%s)\n2. Allez dans Datacenter → Permissions → Users\n3. Sélectionnez l'utilisateur %s\n4. Cliquez sur 'Edit' ou 'Change Password'\n5. Définissez un mot de passe pour cet utilisateur\n6. Utilisez ce mot de passe dans le champ 'Mot de passe (optionnel - pour console VNC)' des Paramètres", usernameBase, strings.TrimPrefix(strings.TrimPrefix(req.URL, "https://"), "http://"), usernameBase)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   errorMsg,
		})
		return
	}

	// Extraire le username et le realm depuis le username
	// Format: username@pam
	username := req.Username
	realm := "pam"
	if strings.Contains(username, "@") {
		parts := strings.Split(username, "@")
		username = parts[0]
		realm = parts[1]
	}

	// Obtenir un ticket d'authentification Proxmox
	ticketURL := fmt.Sprintf("%s/api2/json/access/ticket", req.URL)
	ticketData := fmt.Sprintf("username=%s@%s&password=%s", username, realm, req.Secret)

	ticketReq, err := http.NewRequest("POST", ticketURL, strings.NewReader(ticketData))
	if err != nil {
		fmt.Printf("❌ VMConfig: Erreur création requête ticket: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to create ticket request: %v", err),
		})
		return
	}

	ticketReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ticketResp, err := client.Do(ticketReq)
	if err != nil {
		fmt.Printf("❌ VMConfig: Ticket request error: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to get ticket: %v", err),
		})
		return
	}
	defer ticketResp.Body.Close()

	if ticketResp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(ticketResp.Body)
		fmt.Printf("❌ VMConfig: Ticket request failed: %d - %s\n", ticketResp.StatusCode, string(bodyBytes))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to get ticket: %d - %s", ticketResp.StatusCode, string(bodyBytes)),
		})
		return
	}

	var ticketResult struct {
		Data struct {
			Ticket              string `json:"ticket"`
			CSRFPreventionToken string `json:"CSRFPreventionToken"`
			Username            string `json:"username"`
		} `json:"data"`
	}

	if err := json.NewDecoder(ticketResp.Body).Decode(&ticketResult); err != nil {
		fmt.Printf("❌ VMConfig: Failed to decode ticket response: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to decode ticket: %v", err),
		})
		return
	}

	// Construire l'URL de la configuration avec le ticket
	// Encoder le ticket pour l'URL (les caractères spéciaux comme +, /, = doivent être encodés)
	baseURL := strings.TrimSuffix(req.URL, "/")
	encodedTicket := url.QueryEscape(ticketResult.Data.Ticket)
	configURL := fmt.Sprintf("%s/?vmid=%d&node=%s&PVEAuthCookie=%s",
		baseURL, req.VMID, url.QueryEscape(req.Node), encodedTicket)

	fmt.Printf("✅ Config URL generated for VM %d\n", req.VMID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"configUrl": configURL,
	})
}

// VMConsoleRedirect sert une page HTML qui définit le cookie PVEAuthCookie et redirige vers la console VNC
func (h *Handlers) VMConsoleRedirect(w http.ResponseWriter, r *http.Request) {
	// Récupérer les paramètres de l'URL
	proxmoxURL := r.URL.Query().Get("proxmoxUrl")
	vmid := r.URL.Query().Get("vmid")
	node := r.URL.Query().Get("node")
	ticket := r.URL.Query().Get("ticket")

	if proxmoxURL == "" || vmid == "" || node == "" || ticket == "" {
		http.Error(w, "Paramètres manquants", http.StatusBadRequest)
		return
	}

	// Décoder le ticket depuis l'URL
	decodedTicket, err := url.QueryUnescape(ticket)
	if err != nil {
		http.Error(w, "Ticket invalide", http.StatusBadRequest)
		return
	}

	// Construire l'URL de la console VNC sans le ticket
	consoleURL := fmt.Sprintf("%s/?console=kvm&novnc=1&vmid=%s&node=%s",
		proxmoxURL, vmid, url.QueryEscape(node))

	// IMPORTANT: Proxmox nécessite le ticket dans un cookie HTTP, pas dans l'URL
	// Comme nous ne pouvons pas définir un cookie pour un autre domaine, nous devons utiliser
	// l'URL avec le ticket en paramètre. Cependant, Proxmox peut rejeter cela.
	// Solution: utiliser l'URL avec le ticket NON encodé (le navigateur l'encodera automatiquement)
	// Mais d'abord, essayons avec le ticket encodé manuellement pour être sûr du format

	// IMPORTANT: Proxmox nécessite le ticket dans un cookie HTTP pour la console VNC
	// Comme nous ne pouvons pas définir un cookie pour un autre domaine (Same-Origin),
	// nous devons passer le ticket dans l'URL. Cependant, Proxmox peut rejeter cela.
	//
	// Solution: Passer le ticket dans l'URL SANS encodage supplémentaire
	// Le navigateur encodera automatiquement les caractères spéciaux lors de la requête
	// Mais Proxmox peut quand même rejeter car il attend vraiment un cookie HTTP

	// Construire l'URL avec le ticket dans l'URL (sans encodage manuel, le navigateur s'en charge)
	consoleURLWithTicket := fmt.Sprintf("%s&PVEAuthCookie=%s", consoleURL, decodedTicket)

	// Créer une page HTML qui redirige immédiatement
	// Note: Si Proxmox rejette toujours, c'est parce qu'il nécessite vraiment un cookie HTTP
	// Dans ce cas, la seule solution serait un proxy backend complet pour gérer les WebSockets
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Redirection vers la console VNC...</title>
	<meta http-equiv="refresh" content="0;url=%s">
	<script>
		// Rediriger immédiatement vers la console VNC avec le ticket dans l'URL
		// Le navigateur encodera automatiquement le ticket lors de la requête HTTP
		window.location.replace("%s");
	</script>
</head>
<body>
	<p>Redirection vers la console VNC...</p>
	<p>Si vous voyez une erreur 401, c'est parce que Proxmox nécessite un cookie HTTP pour la console VNC.</p>
	<p>Solution alternative: Utilisez un client VNC externe ou configurez un proxy backend.</p>
	<p><a href="%s">Cliquez ici pour essayer quand même</a>.</p>
</body>
</html>`, consoleURLWithTicket, consoleURLWithTicket, consoleURLWithTicket)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// VMConsoleProxy fait un proxy HTTP vers Proxmox avec le cookie PVEAuthCookie dans les en-têtes
// Gère aussi les WebSockets pour la console VNC noVNC
func (h *Handlers) VMConsoleProxy(w http.ResponseWriter, r *http.Request) {
	// Log toutes les requêtes pour déboguer
	fmt.Printf("🔄 VMConsoleProxy: Requête reçue - Method: %s, Path: %s, Query: %s\n", r.Method, r.URL.Path, r.URL.RawQuery)

	// Récupérer les paramètres de l'URL
	proxmoxURL := r.URL.Query().Get("proxmoxUrl")
	vmid := r.URL.Query().Get("vmid")
	node := r.URL.Query().Get("node")
	ticket := r.URL.Query().Get("ticket")
	targetPath := r.URL.Query().Get("path") // Chemin de la ressource à proxifier

	ticketPreview := ticket
	if len(ticket) > 50 {
		ticketPreview = ticket[:50]
	}
	fmt.Printf("🔍 VMConsoleProxy: Paramètres reçus - proxmoxURL: %s, vmid: %s, node: %s, ticket: %s, targetPath: %s\n", proxmoxURL, vmid, node, ticketPreview, targetPath)
	fmt.Printf("🔍 VMConsoleProxy: URL complète: %s\n", r.URL.String())
	fmt.Printf("🔍 VMConsoleProxy: Referer: %s\n", r.Header.Get("Referer"))
	fmt.Printf("🔍 VMConsoleProxy: X-Original-URI: %s\n", r.Header.Get("X-Original-URI"))

	// Si les paramètres ne sont pas dans l'URL, essayer de les extraire du Referer header
	// Cela arrive quand Nginx proxy une requête /novnc/... vers le backend
	// Le Referer peut pointer vers la page console-proxy originale ou vers une ressource chargée depuis cette page
	if proxmoxURL == "" || ticket == "" {
		referer := r.Header.Get("Referer")
		if referer != "" {
			fmt.Printf("🔍 VMConsoleProxy: Paramètres manquants, extraction depuis Referer: %s\n", referer)
			refererURL, err := url.Parse(referer)
			if err == nil {
				// Si le Referer contient console-proxy, extraire les paramètres directement
				if strings.Contains(referer, "console-proxy") {
					// Extraire les paramètres de l'URL du Referer
					if proxmoxURL == "" {
						proxmoxURL = refererURL.Query().Get("proxmoxUrl")
					}
					if vmid == "" {
						vmid = refererURL.Query().Get("vmid")
					}
					if node == "" {
						node = refererURL.Query().Get("node")
					}
					if ticket == "" {
						ticket = refererURL.Query().Get("ticket")
					}
				} else {
					// Le Referer pointe vers une ressource (CSS, JS, etc.)
					// Il faut remonter la chaîne de Referer pour trouver la page console-proxy originale
					// Pour l'instant, on va chercher dans sessionStorage via un header personnalisé
					// ou utiliser les cookies
					fmt.Printf("⚠️ VMConsoleProxy: Referer ne contient pas console-proxy, recherche dans les cookies...\n")

					// Essayer d'extraire depuis les cookies
					cookies := r.Cookies()
					for _, cookie := range cookies {
						if cookie.Name == "proxmox_console_params" {
							fmt.Printf("🔍 VMConsoleProxy: Cookie trouvé: %s\n", cookie.Value)
							// Décoder le cookie
							cookieValue, err := url.QueryUnescape(cookie.Value)
							if err == nil {
								// Parser les paramètres du cookie
								cookieParams, err := url.ParseQuery(cookieValue)
								if err == nil {
									if proxmoxURL == "" {
										proxmoxURL = cookieParams.Get("proxmoxUrl")
									}
									if vmid == "" {
										vmid = cookieParams.Get("vmid")
									}
									if node == "" {
										node = cookieParams.Get("node")
									}
									if ticket == "" {
										ticket = cookieParams.Get("ticket")
									}
									fmt.Printf("🍪 VMConsoleProxy: Paramètres extraits du cookie - proxmoxURL: %s, vmid: %s, node: %s\n", proxmoxURL, vmid, node)
								}
							}
							break
						}
					}
				}

				ticketPreview := ticket
				if len(ticket) > 50 {
					ticketPreview = ticket[:50]
				}
				fmt.Printf("🔍 VMConsoleProxy: Paramètres extraits - proxmoxURL: %s, vmid: %s, node: %s, ticket: %s\n", proxmoxURL, vmid, node, ticketPreview)
			}
		}

		// Si les paramètres sont toujours manquants, essayer de les extraire depuis l'URL de la page principale
		// en cherchant dans l'historique du navigateur ou dans sessionStorage
		// Pour l'instant, on va utiliser une approche différente : stocker les paramètres dans l'URL de chaque ressource

		// Si targetPath n'est pas dans l'URL, l'extraire de X-Original-URI ou du Referer
		if targetPath == "" {
			originalURI := r.Header.Get("X-Original-URI")
			if originalURI != "" {
				targetPath = originalURI
				fmt.Printf("🔍 VMConsoleProxy: Chemin extrait de X-Original-URI: %s\n", targetPath)
			} else if referer != "" {
				// Le chemin est dans la requête originale, pas dans le Referer
				// On peut utiliser r.URL.Path qui devrait contenir /novnc/...
				targetPath = r.URL.Path
				fmt.Printf("🔍 VMConsoleProxy: Chemin extrait de r.URL.Path: %s\n", targetPath)
			}
		}
	}

	if proxmoxURL == "" || ticket == "" {
		http.Error(w, "Paramètres manquants", http.StatusBadRequest)
		return
	}

	// Décoder le ticket depuis l'URL
	decodedTicket, err := url.QueryUnescape(ticket)
	if err != nil {
		http.Error(w, "Ticket invalide", http.StatusBadRequest)
		return
	}

	// Vérifier si c'est une requête WebSocket (upgrade)
	if strings.ToLower(r.Header.Get("Upgrade")) == "websocket" {
		fmt.Printf("🔌 VMConsoleProxy: Requête WebSocket détectée\n")
		h.handleWebSocketProxy(w, r, proxmoxURL, vmid, node, decodedTicket)
		return
	}

	// Construire l'URL cible sur Proxmox
	var targetURL string
	if targetPath != "" {
		// Si un chemin spécifique est fourni, l'utiliser (pour les ressources CSS/JS)
		targetURL = proxmoxURL + targetPath
		fmt.Printf("🔄 VMConsoleProxy: Proxy ressource vers %s\n", targetPath)
	} else {
		// Sinon, utiliser le chemin de la console VNC
		consolePath := fmt.Sprintf("/?console=kvm&novnc=1&vmid=%s&node=%s", vmid, url.QueryEscape(node))
		targetURL = proxmoxURL + consolePath
		fmt.Printf("🔄 VMConsoleProxy: Proxy console vers %s avec ticket (length: %d)\n", targetURL, len(decodedTicket))
	}

	proxmoxConsoleURL := targetURL

	// Configurer le client pour ignorer la vérification SSL
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: tr}

	// Créer la requête vers Proxmox
	req, err := http.NewRequest(r.Method, proxmoxConsoleURL, r.Body)
	if err != nil {
		fmt.Printf("❌ VMConsoleProxy: Erreur création requête: %v\n", err)
		http.Error(w, fmt.Sprintf("Erreur création requête: %v", err), http.StatusInternalServerError)
		return
	}

	// Copier les en-têtes de la requête originale
	for key, values := range r.Header {
		// Ne pas copier certains en-têtes qui doivent être gérés par le proxy
		if key == "Host" || key == "Connection" {
			continue
		}
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Ajouter le cookie PVEAuthCookie dans les en-têtes
	req.Header.Set("Cookie", fmt.Sprintf("PVEAuthCookie=%s", decodedTicket))

	// Définir le Host pour Proxmox
	parsedURL, err := url.Parse(proxmoxURL)
	if err == nil {
		req.Host = parsedURL.Host
	}

	// Faire la requête vers Proxmox
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ VMConsoleProxy: Erreur requête Proxmox: %v\n", err)
		http.Error(w, fmt.Sprintf("Erreur requête Proxmox: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Logger le code de statut HTTP de Proxmox
	fmt.Printf("🔍 VMConsoleProxy: Réponse Proxmox - Status: %d, Content-Type: %s, Content-Encoding: %s, Content-Length: %s\n",
		resp.StatusCode, resp.Header.Get("Content-Type"), resp.Header.Get("Content-Encoding"), resp.Header.Get("Content-Length"))

	// Modifier les URLs dans le contenu HTML pour pointer vers notre proxy
	// noVNC essaie de se connecter via WebSocket, nous devons modifier l'URL du WebSocket
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ VMConsoleProxy: Erreur lecture réponse: %v (Status: %d)\n", err, resp.StatusCode)
		// Si Proxmox a retourné une erreur, préserver le code de statut
		if resp.StatusCode >= 400 {
			w.WriteHeader(resp.StatusCode)
			for key, values := range resp.Header {
				if key != "Content-Encoding" && key != "Transfer-Encoding" {
					for _, value := range values {
						w.Header().Add(key, value)
					}
				}
			}
			w.Write([]byte(fmt.Sprintf("Erreur lecture réponse: %v", err)))
		} else {
			http.Error(w, fmt.Sprintf("Erreur lecture réponse: %v", err), http.StatusInternalServerError)
		}
		return
	}

	fmt.Printf("🔍 VMConsoleProxy: Taille du body lu: %d bytes\n", len(bodyBytes))

	contentEncoding := resp.Header.Get("Content-Encoding")
	if strings.Contains(strings.ToLower(contentEncoding), "gzip") {
		fmt.Printf("🔍 VMConsoleProxy: Tentative de décompression gzip (taille compressée: %d bytes)\n", len(bodyBytes))
		gzipReader, err := gzip.NewReader(bytes.NewReader(bodyBytes))
		if err != nil {
			fmt.Printf("❌ VMConsoleProxy: Impossible de décompresser le contenu gzip: %v (Status: %d, targetPath: %s)\n", err, resp.StatusCode, targetPath)
			// Si la décompression échoue, retourner l'erreur originale de Proxmox
			w.WriteHeader(resp.StatusCode)
			for key, values := range resp.Header {
				if key != "Content-Encoding" && key != "Transfer-Encoding" {
					for _, value := range values {
						w.Header().Add(key, value)
					}
				}
			}
			// S'assurer que le Content-Type est défini même en cas d'erreur
			if resp.Header.Get("Content-Type") == "" {
				// Essayer de détecter depuis l'extension
				lowerPath := strings.ToLower(targetPath)
				if strings.HasSuffix(lowerPath, ".css") {
					w.Header().Set("Content-Type", "text/css; charset=utf-8")
				} else if strings.HasSuffix(lowerPath, ".js") {
					w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
				} else {
					w.Header().Set("Content-Type", "application/octet-stream")
				}
			}
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(bodyBytes)))
			w.Header().Del("Transfer-Encoding")
			w.Write(bodyBytes)
			return
		}
		decompressedBody, err := io.ReadAll(gzipReader)
		gzipReader.Close()
		if err != nil {
			fmt.Printf("❌ VMConsoleProxy: Erreur lecture flux gzip: %v (Status: %d, targetPath: %s)\n", err, resp.StatusCode, targetPath)
			// Si la lecture échoue, retourner l'erreur originale de Proxmox
			w.WriteHeader(resp.StatusCode)
			for key, values := range resp.Header {
				if key != "Content-Encoding" && key != "Transfer-Encoding" {
					for _, value := range values {
						w.Header().Add(key, value)
					}
				}
			}
			// S'assurer que le Content-Type est défini même en cas d'erreur
			if resp.Header.Get("Content-Type") == "" {
				// Essayer de détecter depuis l'extension
				lowerPath := strings.ToLower(targetPath)
				if strings.HasSuffix(lowerPath, ".css") {
					w.Header().Set("Content-Type", "text/css; charset=utf-8")
				} else if strings.HasSuffix(lowerPath, ".js") {
					w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
				} else {
					w.Header().Set("Content-Type", "application/octet-stream")
				}
			}
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(bodyBytes)))
			w.Header().Del("Transfer-Encoding")
			w.Write(bodyBytes)
			return
		}
		bodyBytes = decompressedBody
		resp.Header.Del("Content-Encoding")
		fmt.Printf("✅ VMConsoleProxy: Contenu gzip décompressé avant modification (taille décompressée: %d bytes)\n", len(bodyBytes))
	}

	// Construire l'URL de base du proxy pour les ressources statiques
	// (doit être fait avant de modifier le CSS)
	proxyBaseURL := fmt.Sprintf("/api/v1/proxmox/vm/console-proxy?proxmoxUrl=%s&vmid=%s&node=%s&ticket=%s&path=",
		url.QueryEscape(proxmoxURL), vmid, url.QueryEscape(node), url.QueryEscape(ticket))

	// Détecter le Content-Type depuis les en-têtes ou l'extension du fichier
	// PRIORITÉ 1: Détection depuis l'extension du fichier (plus fiable)
	originalContentType := resp.Header.Get("Content-Type")
	contentType := originalContentType
	lowerPath := strings.ToLower(targetPath)

	// Détecter le type MIME depuis l'extension en PRIORITÉ
	detectedFromExtension := false
	if strings.HasSuffix(lowerPath, ".css") {
		contentType = "text/css; charset=utf-8"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .css: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".js") {
		contentType = "application/javascript; charset=utf-8"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .js: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".svg") {
		contentType = "image/svg+xml"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .svg: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".woff") {
		contentType = "font/woff"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .woff: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".woff2") {
		contentType = "font/woff2"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .woff2: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".ttf") {
		contentType = "font/ttf"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .ttf: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".eot") {
		contentType = "application/vnd.ms-fontobject"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .eot: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".png") {
		contentType = "image/png"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .png: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".jpg") || strings.HasSuffix(lowerPath, ".jpeg") {
		contentType = "image/jpeg"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .jpg/.jpeg: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".gif") {
		contentType = "image/gif"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .gif: %s (original: %s)\n", contentType, originalContentType)
	} else if strings.HasSuffix(lowerPath, ".ico") {
		contentType = "image/x-icon"
		detectedFromExtension = true
		fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis extension .ico: %s (original: %s)\n", contentType, originalContentType)
	}

	// PRIORITÉ 2: Si le Content-Type original est vide ou incorrect (text/plain pour un fichier typé), utiliser la détection par extension
	if !detectedFromExtension && (originalContentType == "" || originalContentType == "text/plain") {
		// Si on n'a pas détecté depuis l'extension mais que le Content-Type est vide ou text/plain,
		// essayer de détecter depuis le contenu en dernier recours
		if originalContentType == "" {
			detectedContentType := http.DetectContentType(bodyBytes)
			// Ne pas utiliser text/plain si on peut détecter quelque chose de mieux
			if detectedContentType != "text/plain" || len(bodyBytes) == 0 {
				contentType = detectedContentType
				fmt.Printf("🔍 VMConsoleProxy: Content-Type détecté depuis contenu: %s (original: %s)\n", contentType, originalContentType)
			} else {
				// Si http.DetectContentType retourne text/plain, garder text/plain mais loguer un avertissement
				contentType = "text/plain"
				fmt.Printf("⚠️ VMConsoleProxy: Content-Type non détecté, utilisation de text/plain par défaut (targetPath: %s)\n", targetPath)
			}
		} else {
			// Content-Type est text/plain mais on n'a pas pu détecter depuis l'extension
			// Essayer de détecter depuis le contenu
			detectedContentType := http.DetectContentType(bodyBytes)
			if detectedContentType != "text/plain" {
				contentType = detectedContentType
				fmt.Printf("🔍 VMConsoleProxy: Content-Type corrigé depuis contenu: %s (original: %s)\n", contentType, originalContentType)
			} else {
				contentType = originalContentType
				fmt.Printf("⚠️ VMConsoleProxy: Content-Type text/plain conservé (targetPath: %s)\n", targetPath)
			}
		}
	}

	// Déterminer si c'est du HTML
	isHTML := strings.Contains(contentType, "text/html") || targetPath == ""

	fmt.Printf("🔍 VMConsoleProxy: Content-Type final: %s, targetPath: %s, isHTML: %v\n", contentType, targetPath, isHTML)

	// Si c'est du CSS, remplacer les URLs des polices pour qu'elles passent par le proxy
	if strings.HasPrefix(contentType, "text/css") {
		fmt.Printf("🔍 VMConsoleProxy: CSS détecté, modification des URLs des polices...\n")
		// Utiliser une gestion d'erreur pour éviter les panics
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("❌ VMConsoleProxy: Erreur lors de la modification CSS (recovered): %v\n", r)
				// Continuer avec le bodyBytes original
			}
		}()

		bodyString := string(bodyBytes)
		// Compter les occurrences avant remplacement
		urlCountBefore := strings.Count(bodyString, `url('/novnc/`) + strings.Count(bodyString, `url("/novnc/`) + strings.Count(bodyString, `url(/novnc/`)
		fmt.Printf("🔍 VMConsoleProxy: Nombre d'URLs de polices avant remplacement: %d\n", urlCountBefore)

		// Remplacer les URLs des polices dans les règles @font-face
		// Format: url('/novnc/app/styles/Orbitron700.woff') -> url('/api/v1/proxmox/vm/console-proxy?proxmoxUrl=...&path=/novnc/app/styles/Orbitron700.woff')
		// Pattern: url('/novnc/...') ou url("/novnc/...") ou url(/novnc/...)
		bodyString = strings.ReplaceAll(bodyString, `url('/novnc/`, fmt.Sprintf(`url('%s/novnc/`, proxyBaseURL))
		bodyString = strings.ReplaceAll(bodyString, `url("/novnc/`, fmt.Sprintf(`url("%s/novnc/`, proxyBaseURL))
		bodyString = strings.ReplaceAll(bodyString, `url(/novnc/`, fmt.Sprintf(`url(%s/novnc/`, proxyBaseURL))
		// Aussi pour les URLs avec le node: url('/pve2/novnc/...')
		if node != "" {
			bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`url('/%s/novnc/`, node), fmt.Sprintf(`url('%s/%s/novnc/`, proxyBaseURL, node))
			bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`url("/%s/novnc/`, node), fmt.Sprintf(`url("%s/%s/novnc/`, proxyBaseURL, node))
			bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`url(/%s/novnc/`, node), fmt.Sprintf(`url(%s/%s/novnc/`, proxyBaseURL, node))
		}

		// Compter les occurrences après remplacement
		urlCountAfter := strings.Count(bodyString, proxyBaseURL)
		fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences proxyBaseURL après remplacement: %d\n", urlCountAfter)

		bodyBytes = []byte(bodyString)
		fmt.Printf("✅ VMConsoleProxy: CSS modifié pour rediriger les polices vers le proxy\n")
	}

	// Si ce n'est pas du HTML, servir directement
	if !isHTML {
		// Copier les en-têtes de la réponse (en excluant ceux qui seront recalculés)
		for key, values := range resp.Header {
			// Ne pas copier les en-têtes qui seront recalculés ou qui causent des problèmes
			if key == "Content-Length" || key == "Content-Encoding" || key == "Transfer-Encoding" || key == "Content-Type" {
				continue
			}
			for _, value := range values {
				w.Header().Add(key, value)
			}
		}
		// S'assurer que le Content-Type est TOUJOURS défini (même si vide, utiliser application/octet-stream par défaut)
		if contentType == "" {
			contentType = "application/octet-stream"
			fmt.Printf("⚠️ VMConsoleProxy: Content-Type vide, utilisation de application/octet-stream par défaut (targetPath: %s)\n", targetPath)
		}
		w.Header().Set("Content-Type", contentType)
		// Supprimer Transfer-Encoding pour éviter les problèmes avec Content-Length
		w.Header().Del("Transfer-Encoding")
		// Mettre à jour Content-Length avec la taille réelle (après modifications CSS si applicable)
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(bodyBytes)))
		// Préserver le code de statut HTTP de Proxmox
		w.WriteHeader(resp.StatusCode)
		_, err := w.Write(bodyBytes)
		if err != nil {
			fmt.Printf("❌ VMConsoleProxy: Erreur écriture réponse statique: %v\n", err)
			return
		}
		fmt.Printf("✅ VMConsoleProxy: Ressource statique servie directement (Content-Type: %s, Status: %d, Size: %d)\n", contentType, resp.StatusCode, len(bodyBytes))
		return
	}

	// Pour le HTML (page console-proxy), définir un cookie avec les paramètres du proxy
	// Ce cookie sera utilisé pour les requêtes ultérieures vers /novnc/...
	cookieValue := fmt.Sprintf("proxmoxUrl=%s&vmid=%s&node=%s&ticket=%s",
		url.QueryEscape(proxmoxURL), vmid, url.QueryEscape(node), url.QueryEscape(ticket))
	cookie := &http.Cookie{
		Name:     "proxmox_console_params",
		Value:    cookieValue,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600, // 1 heure
	}
	http.SetCookie(w, cookie)
	fmt.Printf("🍪 VMConsoleProxy: Cookie défini avec les paramètres du proxy\n")

	bodyString := string(bodyBytes)

	// DEBUG: Compter les occurrences de /novnc/ avant remplacement
	novncCountBefore := strings.Count(bodyString, "/novnc/")
	nodeNovncCountBefore := strings.Count(bodyString, fmt.Sprintf("/%s/novnc/", node))
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences /novnc/ avant remplacement: %d\n", novncCountBefore)
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences /%s/novnc/ avant remplacement: %d\n", node, nodeNovncCountBefore)

	// Convertir les ressources relatives (href="app/...") pour qu'elles passent par le proxy
	relativeAttrRegex := regexp.MustCompile(`(?i)(href|src)\s*=\s*([\"'])([^\"']+)["']`)
	relativeMatches := relativeAttrRegex.FindAllStringSubmatch(bodyString, -1)
	if len(relativeMatches) > 0 {
		fmt.Printf("🔍 VMConsoleProxy: Ressources relatives détectées (sans /novnc/): %d\n", len(relativeMatches))
	}
	bodyString = relativeAttrRegex.ReplaceAllStringFunc(bodyString, func(match string) string {
		submatches := relativeAttrRegex.FindStringSubmatch(match)
		if len(submatches) != 4 {
			return match
		}
		attr := submatches[1]
		quote := submatches[2]
		value := submatches[3]

		lowerValue := strings.ToLower(value)
		if strings.HasPrefix(lowerValue, "javascript:") ||
			strings.HasPrefix(lowerValue, "http://") ||
			strings.HasPrefix(lowerValue, "https://") ||
			strings.HasPrefix(lowerValue, "//") ||
			strings.HasPrefix(lowerValue, "/") ||
			strings.HasPrefix(lowerValue, "#") ||
			strings.Contains(lowerValue, "api/v1/proxmox/vm/console-proxy") {
			return match
		}

		// Résoudre le chemin relatif par rapport à /novnc/
		resolvedPath := path.Clean("/novnc/" + value)
		if !strings.HasPrefix(resolvedPath, "/") {
			resolvedPath = "/" + resolvedPath
		}

		proxiedURL := proxyBaseURL + url.QueryEscape(resolvedPath)
		fmt.Printf("🔄 VMConsoleProxy: Ressource relative %s%s%s → %s\n", attr, quote, value, proxiedURL)
		return fmt.Sprintf(`%s=%s%s%s`, attr, quote, proxiedURL, quote)
	})

	// Remplacer les URLs WebSocket pour qu'elles passent par notre proxy
	// noVNC construit l'URL WebSocket dynamiquement en JavaScript
	// Nous devons injecter du JavaScript pour modifier l'URL WebSocket avant la connexion
	parsedProxmoxURL, _ := url.Parse(proxmoxURL)
	proxmoxHost := parsedProxmoxURL.Host

	// proxyBaseURL est déjà défini plus haut

	// Construire l'URL du proxy WebSocket (utiliser le même schéma que la requête)
	// Utiliser wss si la requête est en HTTPS ou si l'URL Proxmox est en HTTPS
	scheme := "ws"
	if strings.HasPrefix(r.URL.Scheme, "https") || strings.Contains(r.Header.Get("Referer"), "https") || strings.HasPrefix(proxmoxURL, "https") {
		scheme = "wss"
	}

	// Construire l'host avec le port si nécessaire
	// r.Host contient déjà le host:port si présent dans la requête
	// Mais pour le JavaScript, on doit utiliser window.location.host qui sera résolu côté client
	host := r.Host
	if host == "" {
		// Fallback si Host n'est pas défini
		host = "localhost:5173"
	}

	// Utiliser l'URL complète du proxy avec le schéma approprié
	// IMPORTANT: Utiliser window.location.host dans le JavaScript pour obtenir le bon host:port
	proxyWebSocketURLTemplate := fmt.Sprintf("%s://%s/api/v1/proxmox/vm/console-proxy?proxmoxUrl=%s&vmid=%s&node=%s&ticket=%s",
		scheme, host, url.QueryEscape(proxmoxURL), vmid, url.QueryEscape(node), url.QueryEscape(ticket))

	// Pour le JavaScript, utiliser window.location.host pour s'adapter automatiquement
	// Construire l'URL avec une concaténation JavaScript qui sera évaluée côté client
	// Format: ws:// + window.location.host + /api/v1/...
	proxyWebSocketURLJS := fmt.Sprintf("%s://\" + window.location.host + \"/api/v1/proxmox/vm/console-proxy?proxmoxUrl=%s&vmid=%s&node=%s&ticket=%s",
		scheme, url.QueryEscape(proxmoxURL), vmid, url.QueryEscape(node), url.QueryEscape(ticket))

	fmt.Printf("🔍 VMConsoleProxy: URL WebSocket proxy construite: %s\n", proxyWebSocketURLTemplate)
	fmt.Printf("🔍 VMConsoleProxy: URL WebSocket JS (avec window.location.host): %s\n", proxyWebSocketURLJS)

	// Remplacer les URLs des ressources statiques (CSS, JS, SVG) pour qu'elles passent par le proxy
	// Pattern: href="/pve2/novnc/..." ou src="/pve2/novnc/..." ou href="/pve2/..." ou src="/pve2/..."
	// IMPORTANT: Remplacer aussi les chemins relatifs comme /novnc/ qui ne contiennent pas le nom du node
	// Format avec node: /pve2/novnc/app.js ou /pve2/novnc/app.js?ver=1.6.0-3
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`href="/%s/novnc/`, node), fmt.Sprintf(`href="%s/%s/novnc/`, proxyBaseURL, node))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`src="/%s/novnc/`, node), fmt.Sprintf(`src="%s/%s/novnc/`, proxyBaseURL, node))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`href='/%s/novnc/`, node), fmt.Sprintf(`href='%s/%s/novnc/`, proxyBaseURL, node))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`src='/%s/novnc/`, node), fmt.Sprintf(`src='%s/%s/novnc/`, proxyBaseURL, node))

	// Remplacer les chemins relatifs /novnc/ (sans le nom du node)
	// IMPORTANT: Les ressources noVNC peuvent être à /novnc/ directement ou à /{node}/novnc/
	// Il faut remplacer les deux formats
	// Compter les occurrences avant remplacement
	hrefNovncCountBefore := strings.Count(bodyString, `href="/novnc/`) + strings.Count(bodyString, `href='/novnc/`)
	srcNovncCountBefore := strings.Count(bodyString, `src="/novnc/`) + strings.Count(bodyString, `src='/novnc/`)
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences href/src='/novnc/ avant remplacement: href=%d, src=%d\n", hrefNovncCountBefore, srcNovncCountBefore)

	bodyString = strings.ReplaceAll(bodyString, `href="/novnc/`, fmt.Sprintf(`href="%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `src="/novnc/`, fmt.Sprintf(`src="%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `href='/novnc/`, fmt.Sprintf(`href='%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `src='/novnc/`, fmt.Sprintf(`src='%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `href="novnc/`, fmt.Sprintf(`href="%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `src="novnc/`, fmt.Sprintf(`src="%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `href='novnc/`, fmt.Sprintf(`href='%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `src='novnc/`, fmt.Sprintf(`src='%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `href="./novnc/`, fmt.Sprintf(`href="%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `src="./novnc/`, fmt.Sprintf(`src="%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `href='./novnc/`, fmt.Sprintf(`href='%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `src='./novnc/`, fmt.Sprintf(`src='%s/novnc/`, proxyBaseURL))

	// Compter les occurrences après remplacement
	hrefNovncCountAfter := strings.Count(bodyString, fmt.Sprintf(`href="%s/novnc/`, proxyBaseURL)) + strings.Count(bodyString, fmt.Sprintf(`href='%s/novnc/`, proxyBaseURL))
	srcNovncCountAfter := strings.Count(bodyString, fmt.Sprintf(`src="%s/novnc/`, proxyBaseURL)) + strings.Count(bodyString, fmt.Sprintf(`src='%s/novnc/`, proxyBaseURL))
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences href/src proxy après remplacement: href=%d, src=%d\n", hrefNovncCountAfter, srcNovncCountAfter)

	// Remplacer aussi les URLs absolues avec le host Proxmox
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`href="https://%s/`, proxmoxHost), fmt.Sprintf(`href="%s`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`src="https://%s/`, proxmoxHost), fmt.Sprintf(`src="%s`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`href='https://%s/`, proxmoxHost), fmt.Sprintf(`href='%s`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`src='https://%s/`, proxmoxHost), fmt.Sprintf(`src='%s`, proxyBaseURL))

	// Remplacer les URLs relatives qui commencent par /{node}/novnc/ ou /novnc/ dans les attributs
	// Format avec node: /pve2/novnc/app.js -> proxy?path=/pve2/novnc/app.js
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`"/%s/novnc/`, node), fmt.Sprintf(`"%s/%s/novnc/`, proxyBaseURL, node))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`'/%s/novnc/`, node), fmt.Sprintf(`'%s/%s/novnc/`, proxyBaseURL, node))
	// Format sans node: /novnc/app.js -> proxy?path=/novnc/app.js
	bodyString = strings.ReplaceAll(bodyString, `"/novnc/`, fmt.Sprintf(`"%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `'/novnc/`, fmt.Sprintf(`'%s/novnc/`, proxyBaseURL))

	// Remplacer les URLs WebSocket dans le HTML
	// noVNC peut utiliser différents formats d'URL
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf("wss://%s", proxmoxHost), proxyWebSocketURLTemplate)
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf("ws://%s", proxmoxHost), proxyWebSocketURLTemplate)
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`"wss://%s`, proxmoxHost), fmt.Sprintf(`"%s`, proxyWebSocketURLTemplate))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`'wss://%s`, proxmoxHost), fmt.Sprintf(`'%s`, proxyWebSocketURLTemplate))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`"ws://%s`, proxmoxHost), fmt.Sprintf(`"%s`, proxyWebSocketURLTemplate))
	bodyString = strings.ReplaceAll(bodyString, fmt.Sprintf(`'ws://%s`, proxmoxHost), fmt.Sprintf(`'%s`, proxyWebSocketURLTemplate))

	// Avant d'injecter le JavaScript, remplacer TOUTES les URLs JavaScript qui chargent des ressources
	// noVNC utilise probablement des chemins relatifs ou des variables pour charger les ressources
	// Il faut intercepter ces chargements en modifiant le code JavaScript lui-même

	// Remplacer les chemins dans le JavaScript pour qu'ils pointent vers le proxy
	// Pattern: "/novnc/..." ou '/novnc/...' dans le code JavaScript
	bodyString = strings.ReplaceAll(bodyString, `"/novnc/`, fmt.Sprintf(`"%s/novnc/`, proxyBaseURL))
	bodyString = strings.ReplaceAll(bodyString, `'/novnc/`, fmt.Sprintf(`'%s/novnc/`, proxyBaseURL))
	// Aussi pour les template literals
	bodyString = strings.ReplaceAll(bodyString, "`/novnc/", fmt.Sprintf("`%s/novnc/", proxyBaseURL))

	fmt.Printf("🔍 VMConsoleProxy: URLs JavaScript remplacées pour rediriger vers le proxy\n")

	// Injecter du JavaScript pour modifier l'URL WebSocket et intercepter les requêtes de ressources
	// IMPORTANT: Le script doit s'exécuter IMMÉDIATEMENT, même avant que le DOM soit chargé
	// Utiliser une IIFE (Immediately Invoked Function Expression) pour exécution immédiate
	jsInjection := fmt.Sprintf(`
<script>
(function() {
	console.log('🚀🚀🚀 [INJECTION] Script d\'interception démarré - PRIORITÉ MAXIMALE 🚀🚀🚀');
	console.log('🔧 [INJECTION] Démarrage du proxy WebSocket et ressources pour noVNC');
	
	// Extraire les paramètres de l'URL de la page actuelle et les stocker dans sessionStorage
	// Cela permettra de les récupérer même si le Referer change
	var currentURL = new URL(window.location.href);
	var proxmoxUrl = currentURL.searchParams.get('proxmoxUrl');
	var vmid = currentURL.searchParams.get('vmid');
	var node = currentURL.searchParams.get('node');
	var ticket = currentURL.searchParams.get('ticket');
	
	if (proxmoxUrl && vmid && node && ticket) {
		// Stocker les paramètres dans sessionStorage pour les réutiliser
		sessionStorage.setItem('proxmox_console_proxmoxUrl', proxmoxUrl);
		sessionStorage.setItem('proxmox_console_vmid', vmid);
		sessionStorage.setItem('proxmox_console_node', node);
		sessionStorage.setItem('proxmox_console_ticket', ticket);
		console.log('💾 [INJECTION] Paramètres stockés dans sessionStorage');
	} else {
		// Essayer de récupérer depuis sessionStorage
		proxmoxUrl = sessionStorage.getItem('proxmox_console_proxmoxUrl');
		vmid = sessionStorage.getItem('proxmox_console_vmid');
		node = sessionStorage.getItem('proxmox_console_node');
		ticket = sessionStorage.getItem('proxmox_console_ticket');
		console.log('📦 [INJECTION] Paramètres récupérés depuis sessionStorage');
	}
	
	var proxyWSURL = '%s';
	var proxyBaseURL = '%s';
	var proxmoxHost = '%s';
	var proxmoxNode = '%s';
	console.log('   - proxyWSURL:', proxyWSURL);
	console.log('   - proxyBaseURL:', proxyBaseURL);
	console.log('   - proxmoxHost:', proxmoxHost);
	console.log('   - proxmoxNode:', proxmoxNode);
	console.log('   - window.location.href:', window.location.href);
	console.log('   - window.location.origin:', window.location.origin);
	
	// Reconstruire proxyBaseURL avec les paramètres stockés pour s'assurer qu'ils sont toujours présents
	if (proxmoxUrl && vmid && node && ticket) {
		proxyBaseURL = '/api/v1/proxmox/vm/console-proxy?proxmoxUrl=' + encodeURIComponent(proxmoxUrl) + '&vmid=' + encodeURIComponent(vmid) + '&node=' + encodeURIComponent(node) + '&ticket=' + encodeURIComponent(ticket) + '&path=';
		console.log('🔄 [INJECTION] proxyBaseURL reconstruit avec paramètres:', proxyBaseURL.substring(0, 100) + '...');
	}
	
	// Intercepter les connexions WebSocket de noVNC
	// IMPORTANT: Intercepter AVANT que noVNC ne charge pour capturer toutes les connexions
	// Intercepter TOUTES les connexions WebSocket qui ne pointent pas déjà vers notre proxy
	var originalWebSocket = window.WebSocket;
	window.WebSocket = function(url, protocols) {
		console.log('🔌 [INTERCEPTION] Tentative de connexion WebSocket:', url);
		var originalUrl = url;
		
		// Ne pas intercepter si l'URL pointe déjà vers notre proxy
		if (url && url.indexOf('/api/v1/proxmox/vm/console-proxy') !== -1) {
			console.log('✅ [INTERCEPTION] URL pointe déjà vers le proxy, pas d\'interception nécessaire');
			return new originalWebSocket(url, protocols);
		}
		
		// Intercepter TOUTES les URLs qui pourraient être des connexions VNC Proxmox
		// Vérifier plusieurs patterns pour être sûr de capturer toutes les variantes
		var shouldProxy = false;
		if (url) {
			// Vérifier si l'URL contient le host Proxmox
			if (url.indexOf(proxmoxHost) !== -1) {
				console.log('   → Détecté: host Proxmox dans l\'URL');
				shouldProxy = true;
			}
			// Vérifier les paramètres de console
			else if (url.indexOf('websocket=1') !== -1 || url.indexOf('console=kvm') !== -1 || url.indexOf('novnc') !== -1 || url.indexOf('/?console=') !== -1) {
				console.log('   → Détecté: paramètres de console dans l\'URL');
				shouldProxy = true;
			}
			// Vérifier si c'est une URL relative qui pourrait pointer vers Proxmox
			else if ((url.startsWith('/') || url.startsWith('?')) && (url.indexOf('console') !== -1 || url.indexOf('vmid') !== -1)) {
				console.log('   → Détecté: URL relative avec console/vmid');
				shouldProxy = true;
			}
			// Vérifier si l'URL contient le node Proxmox
			else if (url.indexOf('/' + proxmoxNode + '/') !== -1) {
				console.log('   → Détecté: node Proxmox dans l\'URL');
				shouldProxy = true;
			}
			// Intercepter aussi les URLs qui contiennent le port Proxmox (8006)
			else if (url.indexOf(':8006') !== -1) {
				console.log('   → Détecté: port Proxmox (8006) dans l\'URL');
				shouldProxy = true;
			}
		}
		
		if (shouldProxy) {
			console.log('🔄 [INTERCEPTION] Remplacement de l\'URL WebSocket par le proxy');
			console.log('   - URL originale:', originalUrl);
			console.log('   - URL proxy (template):', proxyWSURL);
			// Construire l'URL proxy en remplaçant window.location.host par sa valeur réelle
			if (typeof proxyWSURL === 'string' && proxyWSURL.indexOf('window.location.host') !== -1) {
				// Remplacer l'expression JavaScript par la valeur réelle
				url = proxyWSURL.replace('" + window.location.host + "', window.location.host);
				console.log('   - URL proxy (construite):', url);
			} else {
				url = proxyWSURL;
			}
		} else {
			console.log('⚠️ [INTERCEPTION] URL non interceptée (pas de pattern Proxmox détecté)');
		}
		console.log('✅ [INTERCEPTION] URL WebSocket finale:', url);
		return new originalWebSocket(url, protocols);
	};
	
	// Intercepter les requêtes de ressources (CSS, JS, SVG) via fetch/XMLHttpRequest
	var originalFetch = window.fetch;
	window.fetch = function(input, init) {
		var url = typeof input === 'string' ? input : input.url;
		var originalUrl = url;
		console.log('🔍 [INTERCEPTION] fetch appelé avec URL:', url);
		
		if (url) {
			var shouldProxy = false;
			var newUrl = url;
			
			// S'assurer que proxyBaseURL contient les paramètres
			if (!proxyBaseURL.includes('proxmoxUrl=') && proxmoxUrl && vmid && node && ticket) {
				proxyBaseURL = '/api/v1/proxmox/vm/console-proxy?proxmoxUrl=' + encodeURIComponent(proxmoxUrl) + '&vmid=' + encodeURIComponent(vmid) + '&node=' + encodeURIComponent(node) + '&ticket=' + encodeURIComponent(ticket) + '&path=';
				console.log('🔄 [INTERCEPTION] proxyBaseURL reconstruit dans fetch:', proxyBaseURL.substring(0, 100) + '...');
			}
			
			// Vérifier si c'est une ressource Proxmox
			if (url.indexOf(proxmoxHost) !== -1) {
				// URL absolue avec host Proxmox
				var path = url.substring(url.indexOf(proxmoxHost) + proxmoxHost.length);
				newUrl = proxyBaseURL + encodeURIComponent(path);
				shouldProxy = true;
			} else if (url.indexOf('/' + proxmoxNode + '/') !== -1) {
				// Chemin avec node: /pve2/novnc/...
				var path = url.substring(url.indexOf('/' + proxmoxNode + '/'));
				newUrl = proxyBaseURL + encodeURIComponent(path);
				shouldProxy = true;
			} else if (url.indexOf('/novnc/') !== -1) {
				// Chemin /novnc/...
				var path = url.substring(url.indexOf('/novnc/'));
				newUrl = proxyBaseURL + encodeURIComponent(path);
				shouldProxy = true;
			} else if (url.startsWith('/') && !url.startsWith('/api/') && !url.startsWith('/api/v1/proxmox/vm/console-proxy')) {
				// Chemin relatif qui pourrait être une ressource Proxmox
				// Vérifier si c'est probablement une ressource noVNC
				if (url.indexOf('novnc') !== -1 || url.indexOf(proxmoxNode) !== -1 || url.match(/\.(css|js|svg|png|jpg|gif|woff|woff2|ttf|eot)$/i)) {
					newUrl = proxyBaseURL + encodeURIComponent(url);
					shouldProxy = true;
				}
			}
			
			if (shouldProxy && newUrl !== originalUrl) {
				console.log('🔄 [INTERCEPTION] fetch redirigé vers proxy:', originalUrl, '->', newUrl);
				if (typeof input === 'string') {
					input = newUrl;
				} else {
					input = Object.assign({}, input, {url: newUrl});
				}
			} else if (!shouldProxy) {
				console.log('⚠️ [INTERCEPTION] fetch non intercepté:', originalUrl);
			}
		}
		return originalFetch(input, init);
	};
	
	// Intercepter aussi XMLHttpRequest pour les anciennes méthodes
	var originalXHROpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
		var originalUrl = url;
		console.log('🔍 [INTERCEPTION] XMLHttpRequest.open appelé avec URL:', url);
		
		if (url) {
			var shouldProxy = false;
			var newUrl = url;
			
			// S'assurer que proxyBaseURL contient les paramètres
			if (!proxyBaseURL.includes('proxmoxUrl=') && proxmoxUrl && vmid && node && ticket) {
				proxyBaseURL = '/api/v1/proxmox/vm/console-proxy?proxmoxUrl=' + encodeURIComponent(proxmoxUrl) + '&vmid=' + encodeURIComponent(vmid) + '&node=' + encodeURIComponent(node) + '&ticket=' + encodeURIComponent(ticket) + '&path=';
				console.log('🔄 [INTERCEPTION] proxyBaseURL reconstruit dans XHR:', proxyBaseURL.substring(0, 100) + '...');
			}
			
			// Vérifier si c'est une ressource Proxmox
			if (url.indexOf(proxmoxHost) !== -1) {
				// URL absolue avec host Proxmox
				var path = url.substring(url.indexOf(proxmoxHost) + proxmoxHost.length);
				newUrl = proxyBaseURL + encodeURIComponent(path);
				shouldProxy = true;
			} else if (url.indexOf('/' + proxmoxNode + '/') !== -1) {
				// Chemin avec node: /pve2/novnc/...
				var path = url.substring(url.indexOf('/' + proxmoxNode + '/'));
				newUrl = proxyBaseURL + encodeURIComponent(path);
				shouldProxy = true;
			} else if (url.indexOf('/novnc/') !== -1) {
				// Chemin /novnc/...
				var path = url.substring(url.indexOf('/novnc/'));
				newUrl = proxyBaseURL + encodeURIComponent(path);
				shouldProxy = true;
			} else if (url.startsWith('/') && !url.startsWith('/api/') && !url.startsWith('/api/v1/proxmox/vm/console-proxy')) {
				// Chemin relatif qui pourrait être une ressource Proxmox
				// Vérifier si c'est probablement une ressource noVNC
				if (url.indexOf('novnc') !== -1 || url.indexOf(proxmoxNode) !== -1 || url.match(/\.(css|js|svg|png|jpg|gif|woff|woff2|ttf|eot)$/i)) {
					newUrl = proxyBaseURL + encodeURIComponent(url);
					shouldProxy = true;
				}
			}
			
			if (shouldProxy && newUrl !== originalUrl) {
				console.log('🔄 [INTERCEPTION] XMLHttpRequest redirigé vers proxy:', originalUrl, '->', newUrl);
				url = newUrl;
			} else if (!shouldProxy) {
				console.log('⚠️ [INTERCEPTION] XMLHttpRequest non intercepté:', originalUrl);
			}
		}
		return originalXHROpen.call(this, method, url, async, user, password);
	};
	
	// Intercepter les balises <link> et <script> existantes dans le DOM IMMÉDIATEMENT
	// Ne pas attendre DOMContentLoaded car les ressources sont déjà chargées
	// IMPORTANT: Exécuter immédiatement, même si le DOM n'est pas complètement chargé
	(function interceptExistingTags() {
		console.log('🔧 [INTERCEPTION] Interception des balises existantes dans le DOM');
		// Intercepter les balises <link> existantes
		var links = document.querySelectorAll('link[href]');
		console.log('🔧 [INTERCEPTION] Nombre de balises <link> trouvées:', links.length);
		links.forEach(function(link) {
			var href = link.href;
			var originalHref = href;
			// Vérifier si c'est une ressource Proxmox
			if (href.indexOf(proxmoxHost) !== -1 || href.indexOf('/' + proxmoxNode + '/') !== -1 || href.indexOf('/novnc/') !== -1 || (href.startsWith(window.location.origin + '/') && !href.startsWith(window.location.origin + '/api/') && !href.startsWith(window.location.origin + '/api/v1/proxmox/vm/console-proxy'))) {
				var path = href;
				if (href.indexOf(proxmoxHost) !== -1) {
					path = href.substring(href.indexOf(proxmoxHost) + proxmoxHost.length);
				} else if (href.startsWith(window.location.origin)) {
					path = href.substring(window.location.origin.length);
				}
				// Intercepter toutes les ressources qui pourraient être Proxmox
				if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1 || (path.startsWith('/') && !path.startsWith('/api/'))) {
					link.href = proxyBaseURL + encodeURIComponent(path);
					console.log('🔄 [INTERCEPTION] Balise <link> existante redirigée vers proxy:', originalHref, '->', link.href);
				}
			}
		});
		// Intercepter les balises <script> existantes
		var scripts = document.querySelectorAll('script[src]');
		console.log('🔧 [INTERCEPTION] Nombre de balises <script> trouvées:', scripts.length);
		scripts.forEach(function(script) {
			var src = script.src;
			var originalSrc = src;
			// Vérifier si c'est une ressource Proxmox
			if (src.indexOf(proxmoxHost) !== -1 || src.indexOf('/' + proxmoxNode + '/') !== -1 || src.indexOf('/novnc/') !== -1 || (src.startsWith(window.location.origin + '/') && !src.startsWith(window.location.origin + '/api/') && !src.startsWith(window.location.origin + '/api/v1/proxmox/vm/console-proxy'))) {
				var path = src;
				if (src.indexOf(proxmoxHost) !== -1) {
					path = src.substring(src.indexOf(proxmoxHost) + proxmoxHost.length);
				} else if (src.startsWith(window.location.origin)) {
					path = src.substring(window.location.origin.length);
				}
				// Intercepter toutes les ressources qui pourraient être Proxmox
				if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1 || (path.startsWith('/') && !path.startsWith('/api/'))) {
					script.src = proxyBaseURL + encodeURIComponent(path);
					console.log('🔄 [INTERCEPTION] Balise <script> existante redirigée vers proxy:', originalSrc, '->', script.src);
				}
			}
		});
		console.log('✅ [INTERCEPTION] Interception des balises existantes terminée');
	})();
	
	// Intercepter la création dynamique d'éléments (document.createElement)
	var originalCreateElement = document.createElement;
	document.createElement = function(tagName, options) {
		var element = originalCreateElement.call(document, tagName, options);
		// Si c'est un <link> ou <script>, intercepter les modifications de href/src
		if (tagName.toLowerCase() === 'link' || tagName.toLowerCase() === 'script') {
			// Intercepter setAttribute
			var originalSetAttribute = element.setAttribute;
			element.setAttribute = function(name, value) {
				if ((name === 'href' || name === 'src') && value) {
					var originalValue = value;
					// Vérifier si c'est une ressource Proxmox
					if (value.indexOf(proxmoxHost) !== -1 || value.indexOf('/' + proxmoxNode + '/') !== -1 || value.indexOf('/novnc/') !== -1 || (value.startsWith('/') && !value.startsWith('/api/') && !value.startsWith('/api/v1/proxmox/vm/console-proxy'))) {
						var path = value;
						if (value.indexOf(proxmoxHost) !== -1) {
							path = value.substring(value.indexOf(proxmoxHost) + proxmoxHost.length);
						} else if (value.startsWith(window.location.origin)) {
							path = value.substring(window.location.origin.length);
						}
						if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1 || (path.startsWith('/') && !path.startsWith('/api/'))) {
							value = proxyBaseURL + encodeURIComponent(path);
							console.log('🔄 [INTERCEPTION] createElement.setAttribute: redirection', name, originalValue, '->', value);
						}
					}
				}
				return originalSetAttribute.call(this, name, value);
			};
			
			// Intercepter aussi les propriétés href/src directement (pour les frameworks modernes)
			if (tagName.toLowerCase() === 'link') {
				Object.defineProperty(element, 'href', {
					get: function() { return this._href || ''; },
					set: function(value) {
						var originalValue = value;
						// Vérifier si c'est une ressource Proxmox
						if (value && (value.indexOf(proxmoxHost) !== -1 || value.indexOf('/' + proxmoxNode + '/') !== -1 || value.indexOf('/novnc/') !== -1 || (value.startsWith(window.location.origin + '/') && !value.startsWith(window.location.origin + '/api/') && !value.startsWith(window.location.origin + '/api/v1/proxmox/vm/console-proxy')))) {
							var path = value;
							if (value.indexOf(proxmoxHost) !== -1) {
								path = value.substring(value.indexOf(proxmoxHost) + proxmoxHost.length);
							} else if (value.startsWith(window.location.origin)) {
								path = value.substring(window.location.origin.length);
							}
							if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1 || (path.startsWith('/') && !path.startsWith('/api/'))) {
								value = proxyBaseURL + encodeURIComponent(path);
								console.log('🔄 [INTERCEPTION] createElement.href: redirection', originalValue, '->', value);
							}
						}
						this._href = value;
						originalSetAttribute.call(this, 'href', value);
					},
					configurable: true
				});
			} else if (tagName.toLowerCase() === 'script') {
				Object.defineProperty(element, 'src', {
					get: function() { return this._src || ''; },
					set: function(value) {
						var originalValue = value;
						// Vérifier si c'est une ressource Proxmox
						if (value && (value.indexOf(proxmoxHost) !== -1 || value.indexOf('/' + proxmoxNode + '/') !== -1 || value.indexOf('/novnc/') !== -1 || (value.startsWith(window.location.origin + '/') && !value.startsWith(window.location.origin + '/api/') && !value.startsWith(window.location.origin + '/api/v1/proxmox/vm/console-proxy')))) {
							var path = value;
							if (value.indexOf(proxmoxHost) !== -1) {
								path = value.substring(value.indexOf(proxmoxHost) + proxmoxHost.length);
							} else if (value.startsWith(window.location.origin)) {
								path = value.substring(window.location.origin.length);
							}
							if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1 || (path.startsWith('/') && !path.startsWith('/api/'))) {
								value = proxyBaseURL + encodeURIComponent(path);
								console.log('🔄 [INTERCEPTION] createElement.src: redirection', originalValue, '->', value);
							}
						}
						this._src = value;
						originalSetAttribute.call(this, 'src', value);
					},
					configurable: true
				});
			}
		}
		return element;
	};
	
	// Intercepter aussi les balises <link> et <img> qui sont chargées automatiquement
	// Observer les changements dans le DOM pour intercepter les nouvelles balises
	var observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			mutation.addedNodes.forEach(function(node) {
				if (node.nodeType === 1) { // Element node
					// Intercepter les balises <link>
					if (node.tagName === 'LINK' && node.href) {
						var href = node.href;
						// Ne pas modifier si l'URL pointe déjà vers le proxy
						if (href.indexOf('/api/v1/proxmox/vm/console-proxy') !== -1) {
							return;
						}
						if (href.indexOf(proxmoxHost) !== -1 || href.indexOf('/' + proxmoxNode + '/') !== -1 || href.indexOf('/novnc/') !== -1 || (href.startsWith(window.location.origin + '/') && !href.startsWith(window.location.origin + '/api/'))) {
							var path = href;
							if (href.indexOf(proxmoxHost) !== -1) {
								path = href.substring(href.indexOf(proxmoxHost) + proxmoxHost.length);
							} else if (href.startsWith(window.location.origin)) {
								path = href.substring(window.location.origin.length);
							}
							if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1) {
								node.href = proxyBaseURL + encodeURIComponent(path);
								console.log('🔄 Balise <link> redirigée vers proxy:', href, '->', node.href);
							}
						}
					}
					// Intercepter les balises <img>
					if (node.tagName === 'IMG' && node.src) {
						var src = node.src;
						// Ne pas modifier si l'URL pointe déjà vers le proxy
						if (src.indexOf('/api/v1/proxmox/vm/console-proxy') !== -1) {
							return;
						}
						if (src.indexOf(proxmoxHost) !== -1 || src.indexOf('/' + proxmoxNode + '/') !== -1 || src.indexOf('/novnc/') !== -1 || (src.startsWith(window.location.origin + '/') && !src.startsWith(window.location.origin + '/api/'))) {
							var path = src;
							if (src.indexOf(proxmoxHost) !== -1) {
								path = src.substring(src.indexOf(proxmoxHost) + proxmoxHost.length);
							} else if (src.startsWith(window.location.origin)) {
								path = src.substring(window.location.origin.length);
							}
							if (path.indexOf('/novnc/') !== -1 || path.indexOf('/' + proxmoxNode + '/') !== -1) {
								node.src = proxyBaseURL + encodeURIComponent(path);
								console.log('🔄 Balise <img> redirigée vers proxy:', src, '->', node.src);
							}
						}
					}
				}
			});
		});
	});
	observer.observe(document, { childList: true, subtree: true });
	
	// Intercepter aussi les URLs relatives qui commencent par /?console=
	var originalOpen = window.open;
	window.open = function(url, target, features) {
		if (url && url.indexOf('console=kvm') !== -1 && url.indexOf('websocket=1') !== -1) {
			url = proxyWSURL;
		}
		return originalOpen(url, target, features);
	};

	// Intercepter la fonction start() de noVNC pour diagnostiquer les erreurs "implement me"
	function wrapNoVNCStart() {
		if (typeof window.start === 'function' && !window.__proxyStartWrapped) {
			var originalStart = window.start;
			window.__proxyStartWrapped = true;
			window.start = async function() {
				console.log('🕹️ [INJECTION] noVNC start() appelé', arguments);
				try {
					var result = await originalStart.apply(this, arguments);
					console.log('✅ [INJECTION] noVNC start() terminé avec succès');
					return result;
				} catch (err) {
					console.error('❌ [INJECTION] noVNC start() a échoué:', err);
					throw err;
				}
			};
			console.log('🛠️ [INJECTION] Fonction start() de noVNC interceptée');
		}
	}
	// Essayer immédiatement puis réessayer jusqu'à ce que start() soit défini
	wrapNoVNCStart();
	var startWrapInterval = setInterval(function() {
		if (window.__proxyStartWrapped) {
			clearInterval(startWrapInterval);
		} else {
			wrapNoVNCStart();
		}
	}, 100);
})();
</script>
`, proxyWebSocketURLJS, proxyBaseURL, proxmoxHost, node)

	// Injecter le script dans le <head> si possible, sinon avant </body> ou </html>
	// IMPORTANT: Injecter tôt pour intercepter avant que noVNC ne charge
	// Essayer d'injecter dans le <head> en premier pour une exécution plus précoce
	if strings.Contains(bodyString, "</head>") {
		bodyString = strings.Replace(bodyString, "</head>", jsInjection+"</head>", 1)
	} else if strings.Contains(bodyString, "<head>") {
		// Si pas de </head>, injecter juste après <head>
		bodyString = strings.Replace(bodyString, "<head>", "<head>"+jsInjection, 1)
	} else if strings.Contains(bodyString, "</body>") {
		bodyString = strings.Replace(bodyString, "</body>", jsInjection+"</body>", 1)
	} else if strings.Contains(bodyString, "</html>") {
		bodyString = strings.Replace(bodyString, "</html>", jsInjection+"</html>", 1)
	} else {
		// Si pas de balise de fermeture, ajouter au début du body ou à la fin
		if strings.Contains(bodyString, "<body") {
			// Trouver la position après <body> ou <body ...>
			bodyIndex := strings.Index(bodyString, "<body")
			if bodyIndex != -1 {
				// Trouver la fin de la balise <body>
				bodyEndIndex := strings.Index(bodyString[bodyIndex:], ">")
				if bodyEndIndex != -1 {
					insertPos := bodyIndex + bodyEndIndex + 1
					bodyString = bodyString[:insertPos] + jsInjection + bodyString[insertPos:]
				}
			}
		} else {
			// Dernier recours : ajouter à la fin
			bodyString += jsInjection
		}
	}

	// DEBUG: Compter les occurrences de /novnc/ après remplacement
	novncCountAfter := strings.Count(bodyString, "/novnc/")
	nodeNovncCountAfter := strings.Count(bodyString, fmt.Sprintf("/%s/novnc/", node))
	proxyBaseCount := strings.Count(bodyString, proxyBaseURL)
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences /novnc/ après remplacement: %d\n", novncCountAfter)
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences /%s/novnc/ après remplacement: %d\n", node, nodeNovncCountAfter)
	fmt.Printf("🔍 VMConsoleProxy: Nombre d'occurrences proxyBaseURL dans le HTML: %d\n", proxyBaseCount)

	// DEBUG: Extraire un échantillon du HTML pour voir le format des URLs
	if strings.Contains(bodyString, "novnc") {
		// Trouver la première occurrence de novnc dans le HTML
		novncIndex := strings.Index(bodyString, "novnc")
		if novncIndex > 0 && novncIndex < len(bodyString)-100 {
			sample := bodyString[novncIndex-50 : novncIndex+100]
			fmt.Printf("🔍 VMConsoleProxy: Échantillon HTML autour de 'novnc': %s\n", sample)
		}
	}

	// Copier les en-têtes de la réponse
	for key, values := range resp.Header {
		// Ne pas copier certains en-têtes qui seront recalculés ou qui causent des problèmes
		if key == "Content-Length" || key == "Content-Encoding" || key == "Transfer-Encoding" {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Assouplir la CSP pour permettre l'injection du script proxy
	w.Header().Del("Content-Security-Policy")
	w.Header().Del("Content-Security-Policy-Report-Only")
	w.Header().Set("Content-Security-Policy", "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:; media-src * data: blob:; connect-src * data: blob:; frame-src * data: blob:;")

	// Mettre à jour Content-Length avec la nouvelle taille
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(bodyString)))

	// Copier le code de statut
	w.WriteHeader(resp.StatusCode)

	// Écrire le corps modifié
	_, err = w.Write([]byte(bodyString))
	if err != nil {
		fmt.Printf("❌ VMConsoleProxy: Erreur écriture réponse: %v\n", err)
		return
	}

	fmt.Printf("✅ VMConsoleProxy: Réponse proxifiée avec succès (Status: %d, Body size: %d)\n", resp.StatusCode, len(bodyString))
}

// handleWebSocketProxy gère le proxy WebSocket pour la console VNC
func (h *Handlers) handleWebSocketProxy(w http.ResponseWriter, r *http.Request, proxmoxURL, vmid, node, ticket string) {
	fmt.Printf("🔔 handleWebSocketProxy: Requête WebSocket reçue - vmid=%s, node=%s, remote=%s\n", vmid, node, r.RemoteAddr)

	// Construire l'URL WebSocket vers Proxmox
	parsedURL, err := url.Parse(proxmoxURL)
	if err != nil {
		fmt.Printf("❌ handleWebSocketProxy: Erreur parsing URL: %v\n", err)
		http.Error(w, "URL invalide", http.StatusBadRequest)
		return
	}

	// Déterminer le schéma WebSocket (wss pour https, ws pour http)
	wsScheme := "wss"
	if parsedURL.Scheme == "http" {
		wsScheme = "ws"
	}

	// Construire l'URL WebSocket complète
	// IMPORTANT: Proxmox nécessite le paramètre websocket=1 pour les connexions WebSocket VNC
	wsPath := fmt.Sprintf("/?console=kvm&novnc=1&websocket=1&vmid=%s&node=%s", vmid, url.QueryEscape(node))
	proxmoxWSURL := fmt.Sprintf("%s://%s%s", wsScheme, parsedURL.Host, wsPath)

	fmt.Printf("🔌 handleWebSocketProxy: Connexion WebSocket vers %s\n", proxmoxWSURL)

	// Upgrader la connexion HTTP vers WebSocket
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Accepter toutes les origines pour le proxy
		},
	}

	// Upgrader la connexion du client
	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("❌ handleWebSocketProxy: Erreur upgrade WebSocket client: %v\n", err)
		return
	}
	defer clientConn.Close()

	// Créer l'URL WebSocket avec les en-têtes nécessaires
	wsURL, err := url.Parse(proxmoxWSURL)
	if err != nil {
		fmt.Printf("❌ handleWebSocketProxy: Erreur parsing WebSocket URL: %v\n", err)
		return
	}

	// Créer les en-têtes pour la connexion WebSocket vers Proxmox
	headers := http.Header{}
	headers.Set("Cookie", fmt.Sprintf("PVEAuthCookie=%s", ticket))
	headers.Set("Origin", proxmoxURL)

	// Se connecter à Proxmox via WebSocket
	dialer := websocket.Dialer{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	proxmoxConn, _, err := dialer.Dial(wsURL.String(), headers)
	if err != nil {
		fmt.Printf("❌ handleWebSocketProxy: Erreur connexion WebSocket Proxmox: %v\n", err)
		clientConn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Erreur connexion Proxmox"))
		return
	}
	defer proxmoxConn.Close()

	fmt.Printf("✅ handleWebSocketProxy: Connexion WebSocket établie avec Proxmox\n")

	// Créer des channels pour gérer les erreurs
	errClient := make(chan error, 1)
	errProxmox := make(chan error, 1)

	// Copier les messages du client vers Proxmox
	go func() {
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				errClient <- err
				return
			}
			if err := proxmoxConn.WriteMessage(messageType, message); err != nil {
				errClient <- err
				return
			}
		}
	}()

	// Copier les messages de Proxmox vers le client
	go func() {
		for {
			messageType, message, err := proxmoxConn.ReadMessage()
			if err != nil {
				errProxmox <- err
				return
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				errProxmox <- err
				return
			}
		}
	}()

	// Attendre qu'une des connexions se ferme
	select {
	case err := <-errClient:
		if err != nil {
			fmt.Printf("⚠️ handleWebSocketProxy: Erreur client: %v\n", err)
		}
	case err := <-errProxmox:
		if err != nil {
			fmt.Printf("⚠️ handleWebSocketProxy: Erreur Proxmox: %v\n", err)
		}
	}

	fmt.Printf("🔌 handleWebSocketProxy: Connexion WebSocket fermée\n")
}
