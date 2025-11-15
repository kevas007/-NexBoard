# Script pour supprimer le secret Slack de l'historique Git
$ErrorActionPreference = "Stop"

Write-Host "🔍 Recherche et correction du secret dans l'historique Git..." -ForegroundColor Yellow

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
        Write-Host "⚠️  Correction du fichier actuel..." -ForegroundColor Yellow
        $content = $content -replace "https://hooks\.slack\.com/services/[^\`"]+", "https://example.com/webhook/slack/placeholder"
        $content = $content -replace "https://discord\.com/api/webhooks/[^\`"]+", "https://example.com/webhook/discord/placeholder"
        Set-Content $filePath -Value $content -NoNewline
        git add $filePath
        Write-Host "✅ Fichier corrigé et ajouté au staging" -ForegroundColor Green
    }
}

# Utiliser git filter-branch pour réécrire l'historique
Write-Host "🔄 Réécriture de l'historique Git avec git filter-branch..." -ForegroundColor Yellow

$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

# Créer un script bash temporaire pour le remplacement
$bashScript = @"
#!/bin/bash
git checkout `$GIT_COMMIT -- backend/internal/seeders/seeders.go 2>/dev/null || exit 0
if [ -f backend/internal/seeders/seeders.go ]; then
    sed -i.bak 's|https://hooks\.slack\.com/services/[^"]*|https://example.com/webhook/slack/placeholder|g' backend/internal/seeders/seeders.go
    sed -i.bak 's|https://discord\.com/api/webhooks/[^"]*|https://example.com/webhook/discord/placeholder|g' backend/internal/seeders/seeders.go
    rm -f backend/internal/seeders/seeders.go.bak 2>/dev/null
    git add backend/internal/seeders/seeders.go
fi
"@

$bashScriptPath = "fix-secret-temp.sh"
Set-Content $bashScriptPath -Value $bashScript -NoNewline

# Donner les permissions d'exécution (sur Linux/Mac)
# Sur Windows avec Git Bash, cela devrait fonctionner

Write-Host "📝 Exécution de git filter-branch..." -ForegroundColor Cyan
Write-Host "⚠️  Cela peut prendre du temps selon la taille de l'historique..." -ForegroundColor Yellow

# Utiliser git filter-branch avec le script bash
$filterCommand = "git filter-branch -f --tree-filter 'if [ -f backend/internal/seeders/seeders.go ]; then sed -i.bak `"s|https://hooks\.slack\.com/services/[^`\`"]*|https://example.com/webhook/slack/placeholder|g`" backend/internal/seeders/seeders.go; sed -i.bak `"s|https://discord\.com/api/webhooks/[^`\`"]*|https://example.com/webhook/discord/placeholder|g`" backend/internal/seeders/seeders.go; rm -f backend/internal/seeders/seeders.go.bak 2>/dev/null; fi' --prune-empty --tag-name-filter cat -- --all"

Write-Host "💡 Commande à exécuter dans Git Bash:" -ForegroundColor Cyan
Write-Host $filterCommand -ForegroundColor White
Write-Host ""
Write-Host "Ou utilisez BFG Repo-Cleaner (recommandé):" -ForegroundColor Cyan
Write-Host "1. Téléchargez BFG: https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor White
Write-Host "2. Exécutez: java -jar bfg.jar --replace-text replacements.txt" -ForegroundColor White
Write-Host ""
Write-Host "Ou utilisez la méthode manuelle avec rebase interactif:" -ForegroundColor Cyan
Write-Host "1. git rebase -i f711dfd^" -ForegroundColor White
Write-Host "2. Changez 'pick' en 'edit' pour le commit f711dfd" -ForegroundColor White
Write-Host "3. Corrigez le fichier et faites 'git commit --amend'" -ForegroundColor White
Write-Host "4. Continuez avec 'git rebase --continue'" -ForegroundColor White

