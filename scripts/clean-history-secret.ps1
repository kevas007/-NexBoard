# Script pour nettoyer l'historique Git du pattern webhook détecté
# Usage: .\scripts\clean-history-secret.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Nettoyage de l'historique Git du pattern webhook..." -ForegroundColor Cyan

# Vérifier que nous sommes dans un repo git
if (-not (Test-Path .git)) {
    Write-Host "❌ Erreur: Ce script doit être exécuté dans un repository Git" -ForegroundColor Red
    exit 1
}

# Vérifier qu'il n'y a pas de modifications non commitées
$status = git status --porcelain
if ($status) {
    Write-Host "❌ Erreur: Il y a des modifications non commitées" -ForegroundColor Red
    Write-Host "   Veuillez les commiter ou les stasher avant de continuer" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "⚠️  ATTENTION: Cette opération va réécrire l'historique Git" -ForegroundColor Yellow
Write-Host "   Tous les commits après aff0c5a seront modifiés" -ForegroundColor Yellow
Write-Host "   Il faudra faire un force push après" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Voulez-vous continuer? (tapez 'OUI' pour confirmer)"
if ($confirm -ne "OUI") {
    Write-Host "Opération annulée" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔄 Nettoyage de l'historique avec git filter-branch..." -ForegroundColor Yellow

# Créer un script bash temporaire pour le remplacement
$bashScript = @"
#!/bin/bash
# Script pour remplacer le pattern dans l'historique Git

# Récupérer le contenu du fichier à chaque commit
git checkout `$GIT_COMMIT -- scripts/fix-slack-webhook-history.ps1 2>/dev/null || exit 0

if [ -f scripts/fix-slack-webhook-history.ps1 ]; then
    # Remplacer le pattern détecté par GitHub
    sed -i.bak 's|https://hooks\.slack\.com/services/[^"]*|SLACK_WEBHOOK_URL_PATTERN_TO_REPLACE|g' scripts/fix-slack-webhook-history.ps1
    sed -i.bak 's|https://example\.com/webhook/placeholder-slack|WEBHOOK_PLACEHOLDER_REPLACEMENT|g' scripts/fix-slack-webhook-history.ps1
    
    # Supprimer le fichier backup
    rm -f scripts/fix-slack-webhook-history.ps1.bak 2>/dev/null
    
    # Ajouter le fichier modifié
    git add scripts/fix-slack-webhook-history.ps1
fi
"@

$bashScriptPath = "$env:TEMP\git-filter-script.sh"
Set-Content -Path $bashScriptPath -Value $bashScript -NoNewline

# Rendre le script exécutable (si sur Linux/Mac)
# Sur Windows avec Git Bash, cela devrait fonctionner

Write-Host "📝 Application du filtre sur tout l'historique..." -ForegroundColor Yellow

# Utiliser git filter-branch
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

try {
    # Exécuter git filter-branch avec le script bash
    # Note: Sur Windows, cela nécessite Git Bash ou WSL
    $bashPath = (Get-Command bash -ErrorAction SilentlyContinue).Source
    if (-not $bashPath) {
        Write-Host "❌ Erreur: bash n'est pas disponible" -ForegroundColor Red
        Write-Host "   Ce script nécessite Git Bash ou WSL" -ForegroundColor Yellow
        Write-Host "   Alternative: Utiliser BFG Repo-Cleaner" -ForegroundColor Yellow
        exit 1
    }
    
    # Exécuter le script bash
    & $bashPath $bashScriptPath
    
    # Utiliser git filter-branch
    git filter-branch --force --index-filter `
        "git checkout `$GIT_COMMIT -- scripts/fix-slack-webhook-history.ps1 2>/dev/null || exit 0; if [ -f scripts/fix-slack-webhook-history.ps1 ]; then sed -i 's|https://hooks\.slack\.com/services/[^\"]*|SLACK_WEBHOOK_URL_PATTERN_TO_REPLACE|g' scripts/fix-slack-webhook-history.ps1; sed -i 's|https://example\.com/webhook/placeholder-slack|WEBHOOK_PLACEHOLDER_REPLACEMENT|g' scripts/fix-slack-webhook-history.ps1; git add scripts/fix-slack-webhook-history.ps1; fi" `
        --prune-empty --tag-name-filter cat -- --all
    
    Write-Host "✅ Historique nettoyé avec succès" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Erreur lors du nettoyage: $_" -ForegroundColor Red
    Write-Host "   Vous pouvez essayer avec BFG Repo-Cleaner" -ForegroundColor Yellow
    exit 1
} finally {
    # Nettoyer le script temporaire
    if (Test-Path $bashScriptPath) {
        Remove-Item $bashScriptPath -Force
    }
}

Write-Host ""
Write-Host "🧹 Nettoyage des références Git..." -ForegroundColor Yellow

# Nettoyer les références
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host ""
Write-Host "✅ Nettoyage terminé!" -ForegroundColor Green
Write-Host ""
Write-Host "📤 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Vérifier l'historique: git log --oneline" -ForegroundColor White
Write-Host "  2. Vérifier le fichier: git show HEAD:scripts/fix-slack-webhook-history.ps1" -ForegroundColor White
Write-Host "  3. Pousser avec force: git push --force-with-lease origin dev" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  ATTENTION: Le force push va réécrire l'historique sur GitHub" -ForegroundColor Yellow
Write-Host "   Assurez-vous que personne d'autre n'a poussé entre-temps" -ForegroundColor Yellow

