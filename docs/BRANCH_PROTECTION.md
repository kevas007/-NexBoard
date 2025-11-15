# Configuration de la Protection de Branche

Ce guide explique comment configurer la protection de la branche `main` sur GitHub et GitLab.

## 🔒 Objectif

- **Branche `main`** : Réservée uniquement à **kevas007**
- **Branche `dev`** : Branche de développement pour toutes les contributions
- Les contributeurs doivent créer des Pull/Merge Requests vers `dev`, jamais vers `main`

## 📋 Configuration GitHub

### 1. Activer la Protection de Branche

1. Allez dans **Settings** → **Branches**
2. Cliquez sur **Add rule** ou **Add branch protection rule**
3. Dans **Branch name pattern**, entrez : `main`
4. Cochez les options suivantes :
   - ✅ **Require a pull request before merging**
     - Require approvals: `1`
     - Dismiss stale pull request approvals when new commits are pushed
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Include administrators** (même vous devez suivre les règles)
   - ✅ **Restrict pushes that create files larger than 100 MB**
   - ✅ **Do not allow bypassing the above settings**

### 2. Restreindre les Pushes

Pour restreindre les pushes directs sur `main` :

1. Dans les règles de protection de branche, cochez :
   - ✅ **Restrict who can push to matching branches**
2. Ajoutez uniquement votre compte **kevas007** dans la liste autorisée

### 3. Configuration Alternative via GitHub Actions

Le fichier `.github/workflows/branch-protection.yml` vérifie automatiquement que seuls les utilisateurs autorisés peuvent pousser sur `main`.

Pour l'activer :
1. Allez dans **Settings** → **Actions** → **General**
2. Activez les workflows GitHub Actions

## 📋 Configuration GitLab

### 1. Activer la Protection de Branche

1. Allez dans **Settings** → **Repository** → **Protected branches**
2. Dans **Branch**, sélectionnez : `main`
3. Dans **Allowed to merge**, sélectionnez : **Maintainers** (ou uniquement votre compte)
4. Dans **Allowed to push**, sélectionnez : **No one** (ou uniquement votre compte)
5. Cliquez sur **Protect**

### 2. Configuration via GitLab CI

Le fichier `.gitlab-ci.yml` inclut une vérification automatique qui empêche les pushes non autorisés sur `main`.

## 🛠️ Scripts d'Aide

### Pour les Contributeurs

Utilisez les scripts fournis pour configurer votre environnement :

**Linux/Mac** :
```bash
./scripts/setup-dev-branch.sh
```

**Windows** :
```powershell
.\scripts\setup-dev-branch.ps1
```

Ces scripts :
- Ajoutent le remote `upstream`
- Créent/synchronisent la branche `dev`
- Configurent votre environnement pour contribuer

## ✅ Vérification

### Vérifier que la Protection Fonctionne

1. **En tant que contributeur** (non kevas007) :
   ```bash
   git checkout main
   git push origin main
   ```
   Cette commande devrait échouer avec une erreur de permission.

2. **En tant que kevas007** :
   ```bash
   git checkout main
   git push origin main
   ```
   Cette commande devrait fonctionner.

### Vérifier le Workflow

1. Créez une branche feature depuis `dev` :
   ```bash
   git checkout dev
   git pull upstream dev
   git checkout -b feature/test
   ```

2. Faites un commit et poussez :
   ```bash
   git add .
   git commit -m "test: vérification du workflow"
   git push origin feature/test
   ```

3. Créez une Pull Request vers `dev` (pas `main`)

## 📝 Notes Importantes

- ⚠️ La branche `main` est la branche de production
- ✅ Toutes les contributions doivent passer par `dev`
- ✅ Seul **kevas007** peut merger `dev` → `main`
- ✅ Les Pull Requests vers `main` seront automatiquement fermées

## 🔧 Dépannage

### Erreur : "You are not allowed to push to main"

**Solution** : C'est normal ! Utilisez la branche `dev` à la place.

### Erreur : "Branch dev does not exist"

**Solution** :
```bash
git fetch upstream
git checkout -b dev upstream/dev
```

### Erreur : "Remote upstream not found"

**Solution** :
```bash
git remote add upstream https://github.com/kevas007/proxmox-dash.git
git fetch upstream
```

---

**Pour toute question, consultez [CONTRIBUTING.md](../CONTRIBUTING.md) ou créez une issue.**

