# Script PowerShell pour configurer la branche dev pour les contributeurs
# Usage: .\scripts\setup-dev-branch.ps1

Write-Host "🔧 Configuration de la branche dev pour les contributions..." -ForegroundColor Cyan

# Vérifier que nous sommes dans un repo git
if (-not (Test-Path .git)) {
    Write-Host "❌ Erreur: Ce script doit être exécuté dans un repository Git" -ForegroundColor Red
    exit 1
}

# Vérifier si le remote upstream existe
$upstreamExists = git remote | Select-String -Pattern "upstream"
if (-not $upstreamExists) {
    Write-Host "➕ Ajout du remote upstream..." -ForegroundColor Yellow
    git remote add upstream https://github.com/kevas007/NexBoard.git
    Write-Host "✅ Remote upstream ajouté" -ForegroundColor Green
} else {
    Write-Host "✅ Remote upstream existe déjà" -ForegroundColor Green
}

# Récupérer les dernières modifications
Write-Host "📥 Récupération des dernières modifications..." -ForegroundColor Cyan
git fetch upstream

# Vérifier si la branche dev existe localement
$devBranchExists = git show-ref --verify --quiet refs/heads/dev 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Branche dev existe localement" -ForegroundColor Green
    git checkout dev
    Write-Host "🔄 Mise à jour de la branche dev..." -ForegroundColor Cyan
    git pull upstream dev
    if ($LASTEXITCODE -ne 0) {
        git merge upstream/dev
    }
} else {
    Write-Host "➕ Création de la branche dev locale..." -ForegroundColor Yellow
    git checkout -b dev upstream/dev
}

Write-Host ""
Write-Host "✅ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "   1. Créez une branche feature : git checkout -b feature/nom-de-votre-fonctionnalite"
Write-Host "   2. Développez votre fonctionnalité"
Write-Host "   3. Poussez vers votre fork : git push origin feature/nom-de-votre-fonctionnalite"
Write-Host "   4. Créez une Pull Request vers la branche 'dev' (JAMAIS vers 'main')"
Write-Host ""
Write-Host "⚠️  Rappel : La branche 'main' est réservée à kevas007 uniquement" -ForegroundColor Yellow

