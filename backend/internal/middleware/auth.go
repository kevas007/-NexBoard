package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"proxmox-dashboard/internal/auth"
	"proxmox-dashboard/internal/models"
)

// JWTAuthMiddleware vérifie l'authentification JWT
func JWTAuthMiddleware(authService *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var token string

			// Essayer d'abord le header Authorization
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				// Vérifier le format "Bearer token"
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && parts[0] == "Bearer" {
					token = parts[1]
				}
			}

			// Si pas de token dans le header, essayer dans les paramètres de requête (pour SSE)
			if token == "" {
				token = r.URL.Query().Get("token")
			}

			// Si toujours pas de token, retourner une erreur
			if token == "" {
				http.Error(w, "Token d'authentification requis", http.StatusUnauthorized)
				return
			}

			// Valider le token
			user, err := authService.ValidateToken(token)
			if err != nil {
				http.Error(w, "Token invalide: "+err.Error(), http.StatusUnauthorized)
				return
			}

			// Ajouter l'utilisateur au contexte
			ctx := context.WithValue(r.Context(), "user", user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// LegacyAuthMiddleware vérifie le token d'authentification legacy (pour compatibilité)
func LegacyAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Récupérer le token depuis les variables d'environnement
		expectedToken := os.Getenv("AUTH_TOKEN")

		// Si aucun token n'est configuré, passer (mode développement)
		if expectedToken == "" {
			// Créer un utilisateur admin fictif pour le développement
			adminUser := &models.User{
				ID:       1,
				Username: "dev-admin",
				Role:     models.RoleAdmin,
				Active:   true,
			}
			ctx := context.WithValue(r.Context(), "user", adminUser)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Récupérer le header Authorization
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Token d'authentification requis", http.StatusUnauthorized)
			return
		}

		// Vérifier le format "Bearer token"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Format d'authentification invalide", http.StatusUnauthorized)
			return
		}

		token := parts[1]

		// Vérifier le token
		if token != expectedToken {
			http.Error(w, "Token d'authentification invalide", http.StatusUnauthorized)
			return
		}

		// Token valide, créer un utilisateur admin fictif
		adminUser := &models.User{
			ID:       1,
			Username: "legacy-admin",
			Role:     models.RoleAdmin,
			Active:   true,
		}
		ctx := context.WithValue(r.Context(), "user", adminUser)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuthMiddleware vérifie le token seulement s'il est fourni
func OptionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expectedToken := os.Getenv("AUTH_TOKEN")

		// Si aucun token configuré, passer
		if expectedToken == "" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")

		// Si pas de header auth, passer (optionnel)
		if authHeader == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Si header présent, le valider
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Format d'authentification invalide", http.StatusUnauthorized)
			return
		}

		token := parts[1]
		if token != expectedToken {
			http.Error(w, "Token d'authentification invalide", http.StatusUnauthorized)
			return
		}

		// Ajouter l'info d'authentification au contexte
		ctx := context.WithValue(r.Context(), "authenticated", true)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AdminOnlyMiddleware nécessite une authentification pour les opérations d'administration
func AdminOnlyMiddleware(next http.Handler) http.Handler {
	return LegacyAuthMiddleware(next)
}

// RequirePermission vérifie qu'un utilisateur a une permission spécifique
func RequirePermission(resource, action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Récupérer l'utilisateur du contexte
			user, ok := r.Context().Value("user").(*models.User)
			if !ok {
				http.Error(w, "Utilisateur non authentifié", http.StatusUnauthorized)
				return
			}

			// Vérifier la permission
			if !user.Role.HasPermission(resource, action) {
				http.Error(w, "Permission insuffisante", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole vérifie qu'un utilisateur a un rôle spécifique ou supérieur
func RequireRole(minRole string) func(http.Handler) http.Handler {
	roleHierarchy := map[models.UserRole]int{
		models.RoleGuest:  0,
		models.RoleViewer: 1,
		models.RoleUser:   2,
		models.RoleAdmin:  3,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Récupérer l'utilisateur du contexte
			user, ok := r.Context().Value("user").(*models.User)
			if !ok {
				http.Error(w, "Utilisateur non authentifié", http.StatusUnauthorized)
				return
			}

			// Vérifier le niveau de rôle
			userLevel, exists := roleHierarchy[user.Role]
			if !exists {
				http.Error(w, "Rôle utilisateur invalide", http.StatusForbidden)
				return
			}

			minLevel, exists := roleHierarchy[models.UserRole(minRole)]
			if !exists {
				http.Error(w, "Rôle requis invalide", http.StatusInternalServerError)
				return
			}

			if userLevel < minLevel {
				http.Error(w, "Niveau d'autorisation insuffisant", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetCurrentUser récupère l'utilisateur actuel depuis le contexte
func GetCurrentUser(r *http.Request) (*models.User, bool) {
	user, ok := r.Context().Value("user").(*models.User)
	return user, ok
}

// RateLimitMiddleware limite le nombre de requêtes par IP
func RateLimitMiddleware(next http.Handler) http.Handler {
	// Simple rate limiting basé sur les variables d'environnement
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Pour l'instant, on passe toutes les requêtes
		// En production, implémenter un vrai rate limiting avec Redis ou en mémoire
		next.ServeHTTP(w, r)
	})
}
