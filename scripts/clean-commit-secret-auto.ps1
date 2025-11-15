# Script automatisé pour nettoyer le commit aff0c5a du pattern webhook
# Usage: .\scripts\clean-commit-secret-auto.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Nettoyage automatique du commit aff0c5a..." -ForegroundColor Cyan

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

$commitHash = "aff0c5a"
$filePath = "scripts/fix-slack-webhook-history.ps1"
$parentCommit = "$commitHash^"

Write-Host ""
Write-Host "📋 Plan d'action:" -ForegroundColor Yellow
Write-Host "  1. Rebase interactif depuis $parentCommit" -ForegroundColor White
Write-Host "  2. Modifier le commit $commitHash" -ForegroundColor White
Write-Host "  3. Remplacer le pattern dans le fichier" -ForegroundColor White
Write-Host "  4. Continuer le rebase" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  ATTENTION: Cette opération va réécrire l'historique Git" -ForegroundColor Yellow
Write-Host "   Les commits après $commitHash seront modifiés" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Voulez-vous continuer? (tapez 'OUI' pour confirmer)"
if ($confirm -ne "OUI") {
    Write-Host "Opération annulée" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔄 Démarrage du rebase interactif..." -ForegroundColor Yellow

# Créer un script d'édition automatique pour git rebase
$editorScript = @"
# Script d'édition automatique pour git rebase
`$content = Get-Content `$args[0]
# Remplacer 'pick' par 'edit' pour le commit aff0c5a
`$content = `$content -replace "^pick $commitHash", "edit $commitHash"
Set-Content -Path `$args[0] -Value `$content
"@

$editorPath = "$env:TEMP\git-rebase-auto-editor.ps1"
Set-Content -Path $editorPath -Value $editorScript

# Définir l'éditeur
$env:GIT_SEQUENCE_EDITOR = "powershell -File $editorPath"

try {
    Write-Host "   Exécution de: git rebase -i $parentCommit" -ForegroundColor Cyan
    
    # Démarrer le rebase interactif
    git rebase -i $parentCommit
    
    # Vérifier si on est en mode rebase (edit)
    if (Test-Path ".git/rebase-merge") {
        Write-Host "✅ Rebase démarré, modification du fichier..." -ForegroundColor Green
        
        # Vérifier que le fichier existe
        if (Test-Path $filePath) {
            Write-Host "   Lecture du fichier..." -ForegroundColor Cyan
            $content = Get-Content $filePath -Raw
            
            # Remplacer le pattern
            $originalContent = $content
            $content = $content -replace "https://hooks\.slack\.com/services/[^\`"]+", "SLACK_WEBHOOK_URL_PATTERN_TO_REPLACE"
            $content = $content -replace "https://example\.com/webhook/placeholder-slack", "WEBHOOK_PLACEHOLDER_REPLACEMENT"
            
            if ($content -ne $originalContent) {
                Write-Host "   Pattern remplacé dans le fichier" -ForegroundColor Green
                Set-Content -Path $filePath -Value $content -NoNewline
                
                # Ajouter et amender le commit
                Write-Host "   Ajout du fichier au staging..." -ForegroundColor Cyan
                git add $filePath
                
                Write-Host "   Modification du commit..." -ForegroundColor Cyan
                git commit --amend --no-edit
                
                Write-Host "   Continuation du rebase..." -ForegroundColor Cyan
                git rebase --continue
                
                Write-Host "✅ Rebase terminé avec succès!" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Le pattern n'a pas été trouvé dans le fichier" -ForegroundColor Yellow
                Write-Host "   Le fichier a peut-être déjà été modifié" -ForegroundColor Yellow
                git rebase --continue
            }
        } else {
            Write-Host "⚠️  Le fichier $filePath n'existe pas dans ce commit" -ForegroundColor Yellow
            git rebase --continue
        }
    } else {
        Write-Host "⚠️  Le rebase n'a pas démarré en mode edit" -ForegroundColor Yellow
        Write-Host "   Vérifiez manuellement: git status" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erreur lors du rebase: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Si le rebase est en cours, vous pouvez:" -ForegroundColor Cyan
    Write-Host "   - Continuer: git rebase --continue" -ForegroundColor White
    Write-Host "   - Annuler: git rebase --abort" -ForegroundColor White
    Write-Host "   - Vérifier: git status" -ForegroundColor White
    exit 1
} finally {
    # Nettoyer
    if (Test-Path $editorPath) {
        Remove-Item $editorPath -Force
    }
    # Réinitialiser l'éditeur
    Remove-Item Env:\GIT_SEQUENCE_EDITOR -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✅ Nettoyage terminé!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "  1. Verifier l'historique: git log --oneline" -ForegroundColor White
Write-Host "  2. Verifier le commit modifie: git show HEAD~3:scripts/fix-slack-webhook-history.ps1" -ForegroundColor White
Write-Host "  3. Pousser avec force: git push --force-with-lease origin dev" -ForegroundColor White
Write-Host ""
Write-Host "ATTENTION: Le force push va reecrire l'historique sur GitHub" -ForegroundColor Yellow
Write-Host "   Assurez-vous que personne d'autre n'a pas pousse entre-temps" -ForegroundColor Yellow

