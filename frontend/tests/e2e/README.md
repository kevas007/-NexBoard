# Tests E2E avec Playwright

Ce dossier contient les tests end-to-end (E2E) pour NexBoard, utilisant Playwright.

## Installation

```bash
# Installer les dépendances (si pas déjà fait)
npm install

# Installer les navigateurs Playwright
npx playwright install --with-deps
```

## Exécution des tests

### Tous les tests
```bash
npm run test:e2e
```

### Tests spécifiques
```bash
# Tests VMs uniquement
npm run test:e2e:vms

# Tests LXC uniquement
npm run test:e2e:lxc

# Tests Storage uniquement
npm run test:e2e:storage
```

### Mode interactif
```bash
# Interface UI pour déboguer
npm run test:e2e:ui

# Mode headed (voir le navigateur)
npm run test:e2e:headed

# Mode debug (step-by-step)
npm run test:e2e:debug
```

## Configuration

Les tests sont configurés dans `playwright.config.ts`. Par défaut, ils pointent vers `http://localhost:5173`.

Pour changer l'URL de base :
```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Tests disponibles

### VMs (`vms-actions.spec.ts`)
- ✅ Affichage de la page VMs
- ✅ Clic sur bouton Console et vérification du toast

### LXC (`lxc-actions.spec.ts`)
- ✅ Affichage de la page LXC
- ✅ Clic sur bouton Console
- ✅ Démarrer un conteneur arrêté
- ✅ Arrêter un conteneur en cours

### Storage (`storage-actions.spec.ts`)
- ✅ Affichage des pools de stockage
- ✅ Actualiser un pool
- ✅ Monter un pool démonté
- ✅ Démonter un pool monté
- ✅ Supprimer un pool avec confirmation

## Notes

- Les tests utilisent des données mockées (seeders frontend)
- Les tests vérifient principalement l'UI et les toasts, pas les appels API réels
- En cas d'échec, les traces sont conservées dans `test-results/`

