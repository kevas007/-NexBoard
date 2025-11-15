# Scripts du Projet

Ce dossier contient tous les scripts utilitaires du projet.

## Structure

```
scripts/
├── install-test-deps.sh     # Installation des dépendances de test (Linux/macOS)
├── install-test-deps.ps1    # Installation des dépendances de test (Windows)
├── generate-tokens.js       # Génération de tokens
├── Makefile                 # Makefile pour Linux/macOS
├── Makefile.windows         # Makefile pour Windows
└── README.md                # Ce fichier
```

## Scripts Disponibles

### Installation des Dépendances

**Linux/macOS :**
```bash
chmod +x scripts/install-test-deps.sh
./scripts/install-test-deps.sh
```

**Windows :**
```powershell
.\scripts\install-test-deps.ps1
```

### Build et Tests

**Linux/macOS :**
```bash
make help                    # Affiche l'aide
make build                   # Build du projet
make test                    # Lance tous les tests
make test-backend           # Tests backend uniquement
make test-frontend          # Tests frontend uniquement
make test-coverage          # Tests avec couverture
```

**Windows :**
```powershell
make -f Makefile.windows help
make -f Makefile.windows build
make -f Makefile.windows test
```

### Génération de Tokens

```bash
node scripts/generate-tokens.js
```

## Scripts PowerShell

- `start-dev.ps1` - Démarrage en mode développement
- `test-auth-system.ps1` - Tests du système d'authentification
- `test-notification-auth.ps1` - Tests des notifications
- `test-security.ps1` - Tests de sécurité

## Scripts Shell

- `test-security.sh` - Tests de sécurité (Linux/macOS)

## Utilisation

1. **Développement :** Utilisez les scripts de votre plateforme
2. **CI/CD :** Les scripts sont intégrés dans GitHub Actions
3. **Tests :** Utilisez les Makefiles pour une expérience uniforme
