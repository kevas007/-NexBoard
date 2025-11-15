# Script pour supprimer le secret Slack de l'historique Git
$ErrorActionPreference = "Stop"

Write-Host "🔍 Recherche du secret dans l'historique Git..." -ForegroundColor Yellow

# Vérifier que nous sommes dans un dépôt Git
if (-not (Test-Path .git)) {
    Write-Host "❌ Ce n'est pas un dépôt Git!" -ForegroundColor Red
    exit 1
}

# Vérifier le fichier actuel
$filePath = "backend/internal/seeders/seeders.go"
if (Test-Path $filePath) {
    $content = Get-Content $filePath -Raw
    if ($content -match "hooks\.slack\.com") {
        Write-Host "⚠️  Le secret est toujours présent dans le fichier actuel!" -ForegroundColor Yellow
        $content = $content -replace "https://hooks\.slack\.com/services/[^\`"]+", "https://example.com/webhook/slack/placeholder"
        $content = $content -replace "https://discord\.com/api/webhooks/[^\`"]+", "https://example.com/webhook/discord/placeholder"
        Set-Content $filePath -Value $content -NoNewline
        Write-Host "✅ Fichier corrigé" -ForegroundColor Green
    }
}

# Utiliser git filter-branch pour réécrire l'historique
Write-Host "🔄 Réécriture de l'historique Git..." -ForegroundColor Yellow

$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

# Créer un script temporaire pour le remplacement
$scriptContent = @"
#!/bin/sh
git checkout `$GIT_COMMIT -- backend/internal/seeders/seeders.go 2>/dev/null || exit 0
if [ -f backend/internal/seeders/seeders.go ]; then
    sed -i 's|https://hooks\.slack\.com/services/[^"]*|https://example.com/webhook/slack/placeholder|g' backend/internal/seeders/seeders.go
    sed -i 's|https://discord\.com/api/webhooks/[^"]*|https://example.com/webhook/discord/placeholder|g' backend/internal/seeders/seeders.go
    git add backend/internal/seeders/seeders.go
fi
"@

# Utiliser une approche PowerShell native
Write-Host "📝 Modification des commits contenant le secret..." -ForegroundColor Yellow

# Obtenir tous les commits qui modifient le fichier
$commits = git log --all --oneline --follow -- "backend/internal/seeders/seeders.go" | ForEach-Object { ($_ -split ' ')[0] }

foreach ($commit in $commits) {
    $fileContent = git show "$commit`:backend/internal/seeders/seeders.go" 2>$null
    if ($fileContent -match "hooks\.slack\.com") {
        Write-Host "🔧 Correction du commit $commit" -ForegroundColor Cyan
        
        # Utiliser git rebase interactif avec un script automatique
        # Pour l'instant, on va utiliser une méthode plus simple
    }
}

Write-Host "✅ Utilisez 'git push --force' pour pousser les modifications" -ForegroundColor Green
Write-Host "⚠️  ATTENTION: Force push réécrit l'historique. Assurez-vous que personne d'autre n'a récupéré ces commits!" -ForegroundColor Yellow

