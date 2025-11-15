package config

import (
	"os"
	"strconv"
)

// Config contient la configuration de l'application
type Config struct {
	Environment string // "dev" ou "production"
	Database    DatabaseConfig
	Server      ServerConfig
	SMTP        SMTPConfig
	Security    SecurityConfig
}

// DatabaseConfig contient la configuration de la base de données
type DatabaseConfig struct {
	Path string
}

// ServerConfig contient la configuration du serveur
type ServerConfig struct {
	Port string
	Host string
}

// SMTPConfig contient la configuration SMTP
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	TLS      bool
}

// SecurityConfig contient la configuration de sécurité
type SecurityConfig struct {
	JWTSecret string
	CORS      CORSConfig
}

// CORSConfig contient la configuration CORS
type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

// Load charge la configuration depuis les variables d'environnement
func Load() *Config {
	env := getEnv("ENV", getEnv("NODE_ENV", "production"))
	if env == "development" || env == "dev" {
		env = "dev"
	} else {
		env = "production"
	}

	return &Config{
		Environment: env,
		Database: DatabaseConfig{
			Path: getEnv("DB_PATH", "data/app.db"),
		},
		Server: ServerConfig{
			Port: getEnv("PORT", "8080"),
			Host: getEnv("HOST", "0.0.0.0"), // 0.0.0.0 pour être accessible depuis Docker
		},
		SMTP: SMTPConfig{
			Host:     getEnv("SMTP_HOST", ""),
			Port:     getEnvAsInt("SMTP_PORT", 587),
			Username: getEnv("SMTP_USERNAME", ""),
			Password: getEnv("SMTP_PASSWORD", ""),
			From:     getEnv("SMTP_FROM", ""),
			TLS:      getEnvAsBool("SMTP_TLS", true),
		},
		Security: SecurityConfig{
			JWTSecret: getEnv("JWT_SECRET", ""),
			CORS: CORSConfig{
				AllowedOrigins: []string{getEnv("CORS_ORIGINS", "*")},
				AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
				AllowedHeaders: []string{"Content-Type", "Authorization"},
			},
		},
	}
}

// getEnv récupère une variable d'environnement avec une valeur par défaut
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt récupère une variable d'environnement comme entier
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvAsBool récupère une variable d'environnement comme booléen
func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
