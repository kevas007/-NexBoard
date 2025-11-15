# Script pour nettoyer l'historique Git des patterns de webhook Slack détectés comme secrets
# Usage: .\scripts\fix-slack-webhook-history.ps1

Write-Host "🔧 Nettoyage de l'historique Git des patterns de webhook..." -ForegroundColor Cyan

# Vérifier que nous sommes dans un repo git
if (-not (Test-Path .git)) {
    Write-Host "❌ Erreur: Ce script doit être exécuté dans un repository Git" -ForegroundColor Red
    exit 1
}

# Vérifier que git-filter-repo est installé (optionnel, on utilisera git filter-branch)
Write-Host "📝 Remplacement du pattern dans l'historique..." -ForegroundColor Yellow

# Utiliser git filter-branch pour remplacer le pattern dans tout l'historique


# Note: Utiliser des patterns qui ne ressemblent PAS à de vraies URLs webhook
# pour éviter la détection par GitHub Secret Scanning

$oldPattern = "SLACK_WEBHOOK_URL_PATTERN_TO_REPLACE"
$newPattern = "WEBHOOK_PLACEHOLDER_REPLACEMENT"

# Créer un script temporaire pour le remplacement
$filterScript = @"
#!/bin/sh
git ls-files -s | sed 's/	/|/g' | while read f; do
    if echo `$f | grep -q 'backend/internal/seeders/seeders.go'; then
        git show `$f | sed 's|$oldPattern|$newPattern|g' | git hash-object -w --stdin
    else
        echo `$f
    fi
done | git update-index --index-info
"@

Write-Host "⚠️  ATTENTION: Cette opération va réécrire l'historique Git" -ForegroundColor Yellow
Write-Host "Il est recommandé de:" -ForegroundColor Yellow
Write-Host "  1. Faire une sauvegarde complète du repository" -ForegroundColor Yellow
Write-Host "  2. Utiliser BFG Repo-Cleaner (recommandé) ou git filter-repo" -ForegroundColor Yellow
Write-Host ""
Write-Host ""
Write-Host "💡 Note: Si GitHub bloque encore, vous pouvez:" -ForegroundColor Cyan
Write-Host "  1. Autoriser le secret sur GitHub (si c'est un faux positif)" -ForegroundColor Cyan
Write-Host "  2. Utiliser BFG Repo-Cleaner pour nettoyer l'historique" -ForegroundColor Cyan
Write-Host "  3. Voir docs/FIX_SECRET_DETECTION.md pour plus d'infos" -ForegroundColor Cyan

