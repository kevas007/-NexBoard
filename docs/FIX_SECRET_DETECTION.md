# Résolution des Problèmes de Détection de Secrets GitHub

## 🚨 Problème

GitHub bloque les pushes qui contiennent des patterns de secrets détectés, même s'il s'agit de placeholders ou d'exemples.

## ✅ Solution 1 : Remplacer le Pattern dans le Commit

### Étape 1 : Modifier le fichier localement

Le fichier `scripts/fix-slack-webhook-history.ps1` contient un pattern qui ressemble à une URL Slack webhook. Même si c'est un placeholder, GitHub le détecte.

**Solution** : Remplacer le pattern par quelque chose qui ne ressemble pas à une vraie URL webhook.

### Étape 2 : Modifier le commit

```powershell
# Vérifier le commit concerné
git log --oneline -10

# Modifier le dernier commit (si c'est le dernier)
git add scripts/fix-slack-webhook-history.ps1
git commit --amend --no-edit

# Ou créer un nouveau commit
git add scripts/fix-slack-webhook-history.ps1
git commit -m "fix: remplacer pattern webhook par placeholder sécurisé"
```

### Étape 3 : Force push (si nécessaire)

```powershell
# ⚠️ ATTENTION : Force push réécrit l'historique
# Ne faire que si vous êtes sûr et si c'est votre branche
git push --force-with-lease origin dev
```

## ✅ Solution 2 : Autoriser le Secret sur GitHub (Faux Positif)

Si c'est un faux positif (placeholder/example), vous pouvez autoriser le secret sur GitHub :

1. **Aller sur l'URL fournie** :
   ```
   https://github.com/kevas007/proxmox-dash/security/secret-scanning/unblock-secret/35XCHBGZIJ33xh9c16iQhRbUtLK
   ```

2. **Cliquer sur "Allow secret"** si c'est bien un placeholder

3. **Repousser** :
   ```powershell
   git push origin dev
   ```

## ✅ Solution 3 : Nettoyer l'Historique Git (Recommandé)

Si le secret est dans l'historique Git, il faut le nettoyer :

### Option A : Utiliser BFG Repo-Cleaner (Recommandé)

```powershell
# Installer BFG (via Chocolatey ou téléchargement)
# https://rtyley.github.io/bfg-repo-cleaner/

# Nettoyer le pattern
bfg --replace-text replacements.txt

# Nettoyer et pousser
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease origin dev
```

### Option B : Utiliser git filter-branch

```powershell
# ⚠️ ATTENTION : Opération destructive
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch scripts/fix-slack-webhook-history.ps1" `
  --prune-empty --tag-name-filter cat -- --all

# Nettoyer
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force-with-lease origin dev
```

## 🔒 Prévention

### 1. Utiliser des Patterns Non-Détectables

**❌ Mauvais** (détecté par GitHub) :
```powershell
# Pattern qui ressemble à une URL webhook (sera détecté)
$pattern = "SLACK_WEBHOOK_URL_PATTERN"
```

**✅ Bon** (non détecté) :
```powershell
$pattern = "SLACK_WEBHOOK_PLACEHOLDER"
# ou
$pattern = "WEBHOOK_URL_PLACEHOLDER"
```

### 2. Utiliser des Variables d'Environnement

**❌ Mauvais** :
```go
// Pattern qui ressemble à une URL webhook (sera détecté)
webhookURL := "SLACK_WEBHOOK_URL_PATTERN"
```

**✅ Bon** :
```go
webhookURL := os.Getenv("SLACK_WEBHOOK_URL")
```

### 3. Utiliser des Fichiers .env (gitignored)

```bash
# .env (gitignored)
SLACK_WEBHOOK_URL=SLACK_WEBHOOK_URL_PATTERN