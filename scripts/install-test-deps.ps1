# Script d'installation des dépendances de test pour ProxmoxDash (Windows)

Write-Host "🧪 Installation des dépendances de test..." -ForegroundColor Cyan

# Vérifier si nous sommes dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: Ce script doit être exécuté depuis le répertoire frontend/" -ForegroundColor Red
    exit 1
}

# Installer les dépendances de test
Write-Host "📦 Installation des dépendances de test..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
    exit 1
}

# Vérifier l'installation
Write-Host "✅ Vérification de l'installation..." -ForegroundColor Green

# Vérifier Vitest
$vitestInstalled = npm list vitest 2>$null
if ($vitestInstalled) {
    Write-Host "✅ Vitest installé" -ForegroundColor Green
} else {
    Write-Host "❌ Vitest non installé" -ForegroundColor Red
    exit 1
}

# Vérifier Testing Library
$testingLibraryInstalled = npm list @testing-library/react 2>$null
if ($testingLibraryInstalled) {
    Write-Host "✅ Testing Library installé" -ForegroundColor Green
} else {
    Write-Host "❌ Testing Library non installé" -ForegroundColor Red
    exit 1
}

# Vérifier jsdom
$jsdomInstalled = npm list jsdom 2>$null
if ($jsdomInstalled) {
    Write-Host "✅ jsdom installé" -ForegroundColor Green
} else {
    Write-Host "❌ jsdom non installé" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Installation terminée avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Commandes disponibles:" -ForegroundColor Cyan
Write-Host "  npm test              - Lance les tests en mode watch" -ForegroundColor White
Write-Host "  npm run test:run      - Lance les tests une seule fois" -ForegroundColor White
Write-Host "  npm run test:ui       - Lance l'interface de test" -ForegroundColor White
Write-Host "  npm run test:coverage - Lance les tests avec couverture" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Pour commencer: npm test" -ForegroundColor Yellow
