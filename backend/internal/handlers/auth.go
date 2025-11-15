package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"proxmox-dashboard/internal/auth"
	"proxmox-dashboard/internal/middleware"
	"proxmox-dashboard/internal/models"

	"github.com/go-chi/chi/v5"
)

// AuthHandlers contient les handlers d'authentification
type AuthHandlers struct {
	authService *auth.Service
}

// NewAuthHandlers crée une nouvelle instance des handlers d'authentification
func NewAuthHandlers(authService *auth.Service) *AuthHandlers {
	return &AuthHandlers{
		authService: authService,
	}
}

// Login authentifie un utilisateur
func (h *AuthHandlers) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Données de connexion invalides", err)
		return
	}

	// Validation basique
	if req.Username == "" || req.Password == "" {
		h.writeError(w, http.StatusBadRequest, "Nom d'utilisateur et mot de passe requis", nil)
		return
	}

	// Récupérer l'IP et User-Agent
	ipAddress := auth.GetClientIP(r)
	userAgent := r.Header.Get("User-Agent")

	// Authentifier
	response, err := h.authService.Login(req, ipAddress, userAgent)
	if err != nil {
		h.writeError(w, http.StatusUnauthorized, "Échec de l'authentification", err)
		return
	}

	h.writeJSON(w, http.StatusOK, response)
}

// Logout déconnecte un utilisateur
func (h *AuthHandlers) Logout(w http.ResponseWriter, r *http.Request) {
	// Récupérer le token depuis le header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		h.writeError(w, http.StatusBadRequest, "Token requis", nil)
		return
	}

	// Extraire le token
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		h.writeError(w, http.StatusBadRequest, "Format de token invalide", nil)
		return
	}

	token := parts[1]

	// Déconnecter
	if err := h.authService.Logout(token); err != nil {
		h.writeError(w, http.StatusInternalServerError, "Erreur lors de la déconnexion", err)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]string{"message": "Déconnexion réussie"})
}

// Me retourne les informations de l'utilisateur connecté
func (h *AuthHandlers) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetCurrentUser(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Utilisateur non authentifié", nil)
		return
	}

	h.writeJSON(w, http.StatusOK, user)
}

// ListUsers liste tous les utilisateurs (admin seulement)
func (h *AuthHandlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.authService.ListUsers()
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Erreur lors de la récupération des utilisateurs", err)
		return
	}

	h.writeJSON(w, http.StatusOK, users)
}

// CreateUser crée un nouvel utilisateur (admin seulement)
func (h *AuthHandlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Données utilisateur invalides", err)
		return
	}

	// Validation basique
	if req.Username == "" || req.Email == "" || req.Password == "" {
		h.writeError(w, http.StatusBadRequest, "Nom d'utilisateur, email et mot de passe requis", nil)
		return
	}

	if !req.Role.IsValid() {
		h.writeError(w, http.StatusBadRequest, "Rôle invalide", nil)
		return
	}

	// Créer l'utilisateur
	user, err := h.authService.CreateUser(req)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Erreur lors de la création de l'utilisateur", err)
		return
	}

	h.writeJSON(w, http.StatusCreated, user)
}

// GetUser récupère un utilisateur par ID
func (h *AuthHandlers) GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "ID utilisateur invalide", err)
		return
	}

	user, err := h.authService.GetUserByID(id)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "Utilisateur non trouvé", err)
		return
	}

	h.writeJSON(w, http.StatusOK, user)
}

// UpdateUser met à jour un utilisateur
func (h *AuthHandlers) UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "ID utilisateur invalide", err)
		return
	}

	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Données de mise à jour invalides", err)
		return
	}

	// Vérifier que l'utilisateur existe
	targetUser, err := h.authService.GetUserByID(id)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "Utilisateur non trouvé", err)
		return
	}

	// Vérifier les permissions
	currentUser, ok := middleware.GetCurrentUser(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Utilisateur non authentifié", nil)
		return
	}

	// Seul un admin peut modifier d'autres utilisateurs
	// Un utilisateur peut modifier son propre profil (sauf le rôle)
	if currentUser.ID != targetUser.ID && currentUser.Role != models.RoleAdmin {
		h.writeError(w, http.StatusForbidden, "Permission insuffisante", nil)
		return
	}

	// Un utilisateur non-admin ne peut pas changer son rôle
	if currentUser.ID == targetUser.ID && currentUser.Role != models.RoleAdmin && req.Role != nil {
		h.writeError(w, http.StatusForbidden, "Impossible de modifier son propre rôle", nil)
		return
	}

	// TODO: Implémenter la mise à jour dans le service
	h.writeJSON(w, http.StatusOK, map[string]string{"message": "Mise à jour non implémentée"})
}

// ChangePassword change le mot de passe d'un utilisateur
func (h *AuthHandlers) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Données de changement de mot de passe invalides", err)
		return
	}

	// Validation
	if req.CurrentPassword == "" || req.NewPassword == "" {
		h.writeError(w, http.StatusBadRequest, "Mot de passe actuel et nouveau mot de passe requis", nil)
		return
	}

	currentUser, ok := middleware.GetCurrentUser(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Utilisateur non authentifié", nil)
		return
	}

	// TODO: Implémenter le changement de mot de passe dans le service
	_ = currentUser // Utiliser la variable pour éviter l'erreur de compilation
	h.writeJSON(w, http.StatusOK, map[string]string{"message": "Changement de mot de passe non implémenté"})
}

// GetUserRoles retourne la liste des rôles disponibles
func (h *AuthHandlers) GetUserRoles(w http.ResponseWriter, r *http.Request) {
	roles := []map[string]interface{}{
		{
			"value":       models.RoleAdmin,
			"label":       "Administrateur",
			"description": "Accès complet à toutes les fonctionnalités",
		},
		{
			"value":       models.RoleUser,
			"label":       "Utilisateur",
			"description": "Gestion des applications et alertes",
		},
		{
			"value":       models.RoleViewer,
			"label":       "Observateur",
			"description": "Lecture seule des données",
		},
		{
			"value":       models.RoleGuest,
			"label":       "Invité",
			"description": "Accès très limité",
		},
	}

	h.writeJSON(w, http.StatusOK, roles)
}

// GetUserPermissions retourne les permissions de l'utilisateur connecté
func (h *AuthHandlers) GetUserPermissions(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetCurrentUser(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Utilisateur non authentifié", nil)
		return
	}

	permissions := models.RolePermissions[user.Role]
	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"role":        user.Role,
		"permissions": permissions,
	})
}

// Fonctions utilitaires

func (h *AuthHandlers) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *AuthHandlers) writeError(w http.ResponseWriter, status int, message string, err error) {
	response := map[string]interface{}{
		"error":  message,
		"status": status,
	}

	if err != nil {
		response["details"] = err.Error()
	}

	h.writeJSON(w, status, response)
}
