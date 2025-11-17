# Tests du Projet

Ce dossier contient tous les tests du projet organisés par type.

## Structure

```
tests/
├── backend/           # Tests du backend Go
├── frontend/          # Tests du frontend React
├── integration/       # Tests d'intégration
└── README.md          # Ce fichier
```

## Backend Tests

Les tests du backend sont organisés par module :
- Tests unitaires pour les modèles
- Tests unitaires pour le store
- Tests unitaires pour les handlers
- Tests d'intégration

### Exécution

```bash
# Tous les tests backend (depuis tests/backend)
cd tests/backend && go test ./...

# Tests avec couverture
cd tests/backend && go test -cover ./...

# Tests spécifiques
cd tests/backend && go test -run TestStore
cd tests/backend && go test -run TestModels
```

### Note importante

Les tests backend utilisent le package `backend_test` pour éviter les conflits avec le package `backend` du code source. Tous les fichiers de test dans `tests/backend/` doivent utiliser `package backend_test`.

## Frontend Tests

Les tests du frontend utilisent Vitest et React Testing Library :
- Tests unitaires des composants
- Tests des utilitaires
- Tests de performance

### Exécution

```bash
# Tous les tests frontend
cd frontend && npm run test:run

# Tests en mode watch
npm run test

# Tests avec couverture
npm run test:coverage

# Interface de test
npm run test:ui
```

## Tests d'Intégration

Les tests d'intégration vérifient le fonctionnement complet du système.

### Exécution

```bash
# Tests d'intégration
npm run test:integration
```

## Configuration

- **Backend :** Utilise le framework de test natif de Go
- **Frontend :** Vitest + React Testing Library
- **Intégration :** Jest + Supertest

## Couverture de Code

- Backend : `go test -cover ./...`
- Frontend : `npm run test:coverage`
- Intégration : `npm run test:integration:coverage`
