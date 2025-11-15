package middleware

import (
	"net/http"
	"os"
	"strings"
)

// SecurityHeaders ajoute les headers de sécurité
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Headers de sécurité
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// CSP (Content Security Policy)
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline'; " +
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
			"font-src 'self' https://fonts.gstatic.com; " +
			"img-src 'self' data: https:; " +
			"connect-src 'self'"
		w.Header().Set("Content-Security-Policy", csp)

		// HSTS en production
		if os.Getenv("NODE_ENV") == "production" {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		next.ServeHTTP(w, r)
	})
}

// ValidateInput valide les entrées utilisateur
func ValidateInput(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Vérifier la taille du body
		if r.ContentLength > 10*1024*1024 { // 10MB max
			http.Error(w, "Payload trop volumineux", http.StatusRequestEntityTooLarge)
			return
		}

		// Vérifier le Content-Type pour les requêtes POST/PUT
		if r.Method == "POST" || r.Method == "PUT" {
			contentType := r.Header.Get("Content-Type")
			if contentType != "" && !strings.HasPrefix(contentType, "application/json") {
				http.Error(w, "Content-Type non supporté", http.StatusUnsupportedMediaType)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// IPWhitelist vérifie les IPs autorisées (optionnel)
func IPWhitelist(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedIPs := os.Getenv("ALLOWED_IPS")

		// Si pas de restriction d'IP configurée, passer
		if allowedIPs == "" {
			next.ServeHTTP(w, r)
			return
		}

		clientIP := getClientIP(r)
		allowed := false

		for _, ip := range strings.Split(allowedIPs, ",") {
			if strings.TrimSpace(ip) == clientIP {
				allowed = true
				break
			}
		}

		if !allowed {
			http.Error(w, "Accès refusé depuis cette IP", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// getClientIP récupère l'IP réelle du client
func getClientIP(r *http.Request) string {
	// Vérifier les headers de proxy
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return strings.Split(forwarded, ",")[0]
	}

	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	return r.RemoteAddr
}
