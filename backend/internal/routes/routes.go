package routes

import (
	"net/http"

	"proxmox-dashboard/internal/handlers"
	"proxmox-dashboard/internal/sse"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// SetupRoutes configure toutes les routes de l'application
func SetupRoutes(h *handlers.Handlers, hub *sse.Hub) *chi.Mux {
	r := chi.NewRouter()

	// Middleware global
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
	}))

	// Routes de santé
	r.Get("/health", h.GetHealth)

	// Route de compatibilité pour /api/apps (redirige vers /api/v1/apps)
	r.Route("/api/apps", func(r chi.Router) {
		r.Get("/", h.GetApps)
		r.Post("/", h.CreateApp)
		r.Put("/{id}", h.UpdateApp)
		r.Delete("/{id}", h.DeleteApp)
	})

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Applications
		r.Route("/apps", func(r chi.Router) {
			r.Get("/", h.GetApps)
			r.Post("/", h.CreateApp)
			r.Put("/{id}", h.UpdateApp)
			r.Delete("/{id}", h.DeleteApp)
		})

		// Alertes
		r.Route("/alerts", func(r chi.Router) {
			r.Get("/", h.GetAlerts)
			r.Post("/", h.CreateAlert)
			r.Put("/:id/acknowledge", h.AcknowledgeAlert)
			r.Put("/acknowledge-all", h.AcknowledgeAllAlerts)
			r.Get("/stream", h.StreamAlerts) // SSE endpoint
		})

		// Notifications
		r.Route("/notifications", func(r chi.Router) {
			r.Post("/subscribe", h.SubscribeNotification)
			r.Post("/test", h.TestEmail)
		})

		// Santé des services
		r.Route("/health", func(r chi.Router) {
			r.Get("/http", h.GetHealthHTTP)
			r.Get("/tcp", h.GetHealthTCP)
		})

		// Administration
		r.Route("/admin", func(r chi.Router) {
			r.Post("/clear-db", h.ClearDatabase)
		})

		// Proxmox
		r.Route("/proxmox", func(r chi.Router) {
			r.Post("/fetch-data", h.FetchProxmoxData)
			r.Post("/fetch-backups", h.FetchProxmoxBackups)
			r.Post("/fetch-tasks", h.FetchProxmoxTasks)
			r.Post("/fetch-docker", h.FetchProxmoxDocker)
			r.Post("/fetch-databases", h.FetchProxmoxDatabases)
			r.Post("/fetch-networks", h.FetchProxmoxNetworks)
			r.Post("/test-password", h.TestProxmoxPassword)     // test du mot de passe
			r.Post("/vm/{action}", h.VMAction)                  // start, stop, restart, pause
			r.Post("/vm/console", h.VMConsole)                  // console VNC
			r.Get("/vm/console-redirect", h.VMConsoleRedirect)  // redirection console VNC avec cookie
			r.HandleFunc("/vm/console-proxy", h.VMConsoleProxy) // proxy console VNC avec cookie HTTP
			r.Post("/vm/config", h.VMConfig)                    // configuration VM
		})

		// Prometheus
		r.Route("/prometheus", func(r chi.Router) {
			r.Get("/query", h.QueryPrometheus)
		})
	})

	// Server-Sent Events
	r.Get("/events", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeHTTP(w, r)
	})

	// Routes statiques pour le frontend
	r.Handle("/*", http.FileServer(http.Dir("./frontend/dist/")))

	return r
}
