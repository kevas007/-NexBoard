# Script pour corriger le secret dans l'historique Git
$commitHash = "f711dfd"
$filePath = "backend/internal/seeders/seeders.go"

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path $filePath)) {
    Write-Host "Erreur: Le fichier $filePath n'existe pas"
    exit 1
}

# Vérifier que le fichier actuel est correct
$content = Get-Content $filePath -Raw
if ($content -match "hooks\.slack\.com") {
    Write-Host "Le fichier contient encore l'URL Slack. Correction en cours..."
    $content = $content -replace "https://hooks\.slack\.com/services/[^\"]+", "https://example.com/webhook/slack/placeholder"
    Set-Content -Path $filePath -Value $content -NoNewline
    Write-Host "Fichier corrigé localement"
}

# Utiliser git rebase pour modifier le commit
Write-Host "Démarrage du rebase interactif..."
$env:GIT_SEQUENCE_EDITOR = "powershell -Command `"`$content = Get-Content `$args[0]; `$content = `$content -replace '^pick $commitHash', 'edit $commitHash'; Set-Content -Path `$args[0] -Value `$content`""
git rebase -i "$commitHash^"

# Si le rebase est en cours, modifier le fichier et continuer
if (Test-Path ".git/rebase-merge") {
    Write-Host "Rebase en cours, modification du fichier..."
    $content = Get-Content $filePath -Raw
    $content = $content -replace "https://hooks\.slack\.com/services/[^\"]+", "https://example.com/webhook/slack/placeholder"
    Set-Content -Path $filePath -Value $content -NoNewline
    git add $filePath
    git commit --amend --no-edit
    git rebase --continue
}

Write-Host "Terminé!"

