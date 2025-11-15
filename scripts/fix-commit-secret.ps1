# Script pour corriger le commit contenant le pattern webhook détecté
# Usage: .\scripts\fix-commit-secret.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Correction du commit contenant le pattern webhook..." -ForegroundColor Cyan

# Vérifier que nous sommes dans un repo git
if (-not (Test-Path .git)) {
    Write-Host "❌ Erreur: Ce script doit être exécuté dans un repository Git" -ForegroundColor Red
    exit 1
}

# Commit à modifier
$commitHash = "aff0c5a"
$filePath = "scripts/fix-slack-webhook-history.ps1"

Write-Host "📝 Modification du commit $commitHash..." -ForegroundColor Yellow

# Vérifier si le commit existe
$commitExists = git rev-parse --verify "$commitHash" 2>$null
if (-not $commitExists) {
    Write-Host "❌ Le commit $commitHash n'existe pas" -ForegroundColor Red
    exit 1
}

# Vérifier si le commit est dans l'historique actuel
$isInHistory = git log --oneline | Select-String -Pattern $commitHash
if (-not $isInHistory) {
    Write-Host "⚠️  Le commit $commitHash n'est pas dans l'historique actuel" -ForegroundColor Yellow
    Write-Host "   Il a peut-être déjà été modifié ou n'est pas sur cette branche" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "⚠️  ATTENTION: Cette opération va réécrire l'historique Git" -ForegroundColor Yellow
Write-Host ""
Write-Host "Options disponibles:" -ForegroundColor Cyan
Write-Host "  1. Utiliser git rebase interactif pour modifier le commit" -ForegroundColor White
Write-Host "  2. Utiliser BFG Repo-Cleaner (recommandé)" -ForegroundColor White
Write-Host "  3. Autoriser le secret sur GitHub (si c'est un faux positif)" -ForegroundColor White
Write-Host ""
Write-Host "💡 Voir docs/FIX_SECRET_DETECTION.md pour les instructions détaillées" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Voulez-vous continuer avec git rebase interactif? (o/N)"
if ($choice -ne "o" -and $choice -ne "O") {
    Write-Host "Opération annulée" -ForegroundColor Yellow
    exit 0
}

# Utiliser git rebase interactif
Write-Host "🔄 Démarrage du rebase interactif..." -ForegroundColor Yellow
Write-Host "   Dans l'éditeur, changez 'pick' en 'edit' pour le commit $commitHash" -ForegroundColor Yellow

# Créer un script temporaire pour l'éditeur
$editorScript = @"
# Script d'édition automatique pour git rebase
`$content = Get-Content `$args[0]
`$content = `$content -replace "^pick $commitHash", "edit $commitHash"
Set-Content -Path `$args[0] -Value `$content
"@

$editorPath = "$env:TEMP\git-rebase-editor.ps1"
Set-Content -Path $editorPath -Value $editorScript

# Définir l'éditeur
$env:GIT_SEQUENCE_EDITOR = "powershell -File $editorPath"

# Démarrer le rebase (depuis le commit parent)
$parentCommit = "$commitHash^"
Write-Host "   Rebase depuis $parentCommit..." -ForegroundColor Yellow

try {
    git rebase -i $parentCommit
    
    # Si on est en mode edit, modifier le fichier
    if (Test-Path ".git/rebase-merge") {
        Write-Host "📝 Modification du fichier dans le commit..." -ForegroundColor Yellow
        
        if (Test-Path $filePath) {
            $content = Get-Content $filePath -Raw
            $content = $content -replace "https://hooks\.slack\.com/services/[^\`"]+", "SLACK_WEBHOOK_URL_PATTERN_TO_REPLACE"
            $content = $content -replace "https://example\.com/webhook/placeholder-slack", "WEBHOOK_PLACEHOLDER_REPLACEMENT"
            Set-Content -Path $filePath -Value $content -NoNewline
            
            git add $filePath
            git commit --amend --no-edit
            git rebase --continue
        }
    }
    
    Write-Host "✅ Rebase terminé avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du rebase: $_" -ForegroundColor Red
    Write-Host "   Vous pouvez annuler avec: git rebase --abort" -ForegroundColor Yellow
    exit 1
} finally {
    # Nettoyer
    if (Test-Path $editorPath) {
        Remove-Item $editorPath -Force
    }
}

Write-Host ""
Write-Host "✅ Commit modifié avec succès" -ForegroundColor Green
Write-Host "   Vous pouvez maintenant pousser avec: git push --force-with-lease origin dev" -ForegroundColor Cyan

