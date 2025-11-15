# Script PowerShell pour configurer Jenkins pour Proxmox Dash
# Usage: .\scripts\setup-jenkins.ps1

Write-Host "🔧 Configuration de Jenkins pour Proxmox Dash..." -ForegroundColor Cyan

# Vérifier que Docker est installé
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker n'est pas installé" -ForegroundColor Red
    Write-Host "Installez Docker Desktop : https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Vérifier que Go est installé
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Go n'est pas installé" -ForegroundColor Yellow
    Write-Host "Installez Go 1.22+ : https://go.dev/doc/install" -ForegroundColor Yellow
}

# Vérifier que Node.js est installé
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Node.js n'est pas installé" -ForegroundColor Yellow
    Write-Host "Installez Node.js 18+ : https://nodejs.org/" -ForegroundColor Yellow
}

# Vérifier que Docker Compose est disponible
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Docker Compose n'est pas installé" -ForegroundColor Yellow
    Write-Host "Docker Desktop inclut Docker Compose" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Vérifications terminées" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "   1. Installez Jenkins (voir jenkins/README.md)" -ForegroundColor White
Write-Host "   2. Accédez à Jenkins : http://localhost:8080" -ForegroundColor White
Write-Host "   3. Installez les plugins requis" -ForegroundColor White
Write-Host "   4. Configurez les outils (Go, Node.js)" -ForegroundColor White
Write-Host "   5. Créez un nouveau Multibranch Pipeline" -ForegroundColor White
Write-Host "   6. Configurez le repository Git" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation complète : jenkins/README.md" -ForegroundColor Cyan

