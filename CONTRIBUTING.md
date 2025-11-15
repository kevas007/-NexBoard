# Guide de Contribution - NexBoard

Merci de votre intérêt à contribuer à NexBoard ! Ce guide vous aidera à démarrer.

## 🤝 Comment Contribuer

### 1. Signaler un Bug

Si vous trouvez un bug, veuillez :

1. **Vérifier** que le bug n'a pas déjà été signalé dans les [Issues](https://github.com/kevas007/nexboard/issues)
2. **Créer une nouvelle issue** avec le template "Bug Report"
3. **Inclure** :
   - Description claire du problème
   - Étapes pour reproduire
   - Comportement attendu vs réel
   - Captures d'écran si applicable
   - Version et environnement

### 2. Proposer une Nouvelle Fonctionnalité

1. **Créer une issue** avec le template "Feature Request"
2. **Décrire** clairement la fonctionnalité souhaitée
3. **Expliquer** pourquoi elle serait utile
4. **Attendre** l'approbation avant de commencer le développement

### 3. Contribuer au Code

#### Prérequis

- **Backend** : Go 1.22+
- **Frontend** : Node.js 18+, npm
- **Base de données** : SQLite
- **Docker** : Pour l'environnement de développement

#### Processus de Contribution

⚠️ **IMPORTANT : Workflow de Branches**

- **Branche `main`** : Réservée uniquement à **kevas007**. Aucun push direct n'est autorisé pour les autres contributeurs.
- **Branche `dev`** : Branche de développement principale pour toutes les contributions.
- **Branches feature** : Créées depuis `dev` pour chaque nouvelle fonctionnalité.

1. **Fork** le repository
2. **Clone** votre fork :
   ```bash
   git clone https://github.com/VOTRE-USERNAME/proxmox-dash.git
   cd proxmox-dash
   ```

3. **Ajouter le remote upstream** :
   ```bash
   git remote add upstream https://github.com/kevas007/proxmox-dash.git
   ```

4. **Synchroniser avec upstream** :
   ```bash
   git fetch upstream
   git checkout dev
   git pull upstream dev
   ```

5. **Créer une branche feature depuis `dev`** :
   ```bash
   git checkout -b feature/nom-de-votre-fonctionnalite
   ```

4. **Installer les dépendances** :
   ```bash
   # Backend
   cd backend
   go mod download
   
   # Frontend
   cd frontend
   npm install
   ```

7. **Démarrer l'environnement** :
   ```bash
   docker compose up -d
   ```

8. **Développer** votre fonctionnalité
9. **Tester** vos modifications
10. **Commit** vos changements :
   ```bash
   git add .
   git commit -m "feat: ajouter nouvelle fonctionnalité"
   ```

11. **Push** vers votre fork sur la branche `dev` :
   ```bash
   git push origin feature/nom-de-votre-fonctionnalite
   ```

12. **Créer une Pull Request** vers la branche `dev` (⚠️ **JAMAIS vers `main`**)
    - Base: `dev`
    - Compare: `feature/nom-de-votre-fonctionnalite`
    - Seul **kevas007** peut merger dans `main` après validation

### 🔒 Protection de la Branche Main

La branche `main` est protégée et réservée uniquement à **kevas007** pour :
- Garantir la stabilité du code en production
- Maintenir la qualité du code
- Éviter les push directs non validés

**Règles** :
- ✅ Tous les contributeurs doivent pousser vers `dev`
- ✅ Les Pull Requests doivent cibler `dev`
- ✅ Seul **kevas007** peut merger `dev` → `main`
- ❌ Aucun push direct sur `main` autorisé pour les autres utilisateurs

**Scripts d'aide** :
- Linux/Mac : `./scripts/setup-dev-branch.sh`
- Windows : `.\scripts\setup-dev-branch.ps1`

Pour plus de détails sur la configuration, consultez [docs/BRANCH_PROTECTION.md](docs/BRANCH_PROTECTION.md)

## 📋 Standards de Code

### Backend (Go)

- **Formatage** : `gofmt` et `goimports`
- **Linting** : `golangci-lint`
- **Tests** : Tests unitaires pour les nouvelles fonctionnalités
- **Documentation** : Commentaires pour les fonctions publiques

```bash
# Vérifier le code
golangci-lint run

# Formater le code
gofmt -w .
goimports -w .
```

### Frontend (React/TypeScript)

- **Formatage** : Prettier
- **Linting** : ESLint
- **Tests** : Vitest pour les composants
- **Types** : TypeScript strict

```bash
# Vérifier le code
npm run lint

# Formater le code
npm run format

# Tests
npm run test
```

### Commits

Utilisez le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
type(scope): description

feat(api): ajouter endpoint de monitoring
fix(ui): corriger affichage des métriques
docs(readme): mettre à jour l'installation
```

**Types** :
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `docs` : Documentation
- `style` : Formatage, pas de changement de code
- `refactor` : Refactoring
- `test` : Ajout de tests
- `chore` : Maintenance

## 🧪 Tests

### Backend

```bash
cd backend
go test ./...
go test -race ./...
```

### Frontend

```bash
cd frontend
npm run test
npm run test:coverage
```

## 📝 Documentation

- **README.md** : Mise à jour pour les nouvelles fonctionnalités
- **Code** : Commentaires pour les fonctions complexes
- **API** : Documentation des endpoints
- **Changelog** : Mise à jour pour les releases

## 🔍 Review Process

### Pour les Contributeurs

1. **Assurez-vous** que votre code fonctionne
2. **Ajoutez des tests** si nécessaire
3. **Mettez à jour la documentation**
4. **Vérifiez** que tous les tests passent
5. **Décrivez** clairement vos changements dans la PR

### Pour les Reviewers

1. **Vérifier** la fonctionnalité
2. **Tester** le code
3. **Vérifier** la sécurité
4. **S'assurer** que la documentation est à jour
5. **Donner** des retours constructifs

## 🚫 Ce qui ne sera pas Accepté

- Code non testé
- Violations de sécurité
- Code non documenté
- Breaking changes sans justification
- Code qui ne suit pas les standards

## 🎯 Types de Contributions

### 🐛 Corrections de Bugs
- Corrections de bugs existants
- Améliorations de performance
- Corrections de sécurité

### ✨ Nouvelles Fonctionnalités
- Nouvelles pages/écrans
- Nouvelles API endpoints
- Intégrations avec d'autres services

### 📚 Documentation
- Amélioration du README
- Documentation API
- Guides d'utilisation
- Exemples de code

### 🧪 Tests
- Tests unitaires
- Tests d'intégration
- Tests de performance
- Tests de sécurité

### 🎨 UI/UX
- Améliorations d'interface
- Responsive design
- Accessibilité
- Animations et transitions

## 📞 Support

- **Issues** : [GitHub Issues](https://github.com/kevas007/proxmox-dash/issues)
- **Discussions** : [GitHub Discussions](https://github.com/kevas007/proxmox-dash/discussions)
- **Email** : [kevassiobo@gmail.com](mailto:kevassiobo@gmail.com)

## 🙏 Reconnaissance

Tous les contributeurs sont reconnus dans :
- Le fichier [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Les releases GitHub
- Le README du projet

---

**Merci de contribuer à NexBoard ! 🚀**

*Développé avec ❤️ par [kevas007](https://github.com/kevas007)*
