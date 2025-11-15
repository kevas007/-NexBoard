#!/bin/bash

# Script d'installation des dépendances de test pour ProxmoxDash

echo "🧪 Installation des dépendances de test..."

# Vérifier si nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire frontend/"
    exit 1
fi

# Installer les dépendances de test
echo "📦 Installation des dépendances de test..."
npm install

# Vérifier l'installation
echo "✅ Vérification de l'installation..."

# Vérifier Vitest
if npm list vitest > /dev/null 2>&1; then
    echo "✅ Vitest installé"
else
    echo "❌ Vitest non installé"
    exit 1
fi

# Vérifier Testing Library
if npm list @testing-library/react > /dev/null 2>&1; then
    echo "✅ Testing Library installé"
else
    echo "❌ Testing Library non installé"
    exit 1
fi

# Vérifier jsdom
if npm list jsdom > /dev/null 2>&1; then
    echo "✅ jsdom installé"
else
    echo "❌ jsdom non installé"
    exit 1
fi

echo "🎉 Installation terminée avec succès!"
echo ""
echo "📋 Commandes disponibles:"
echo "  npm test              - Lance les tests en mode watch"
echo "  npm run test:run      - Lance les tests une seule fois"
echo "  npm run test:ui       - Lance l'interface de test"
echo "  npm run test:coverage - Lance les tests avec couverture"
echo ""
echo "🚀 Pour commencer: npm test"
