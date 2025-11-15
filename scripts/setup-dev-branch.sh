#!/bin/bash

# Script pour configurer la branche dev pour les contributeurs
# Usage: ./scripts/setup-dev-branch.sh

set -e

echo "🔧 Configuration de la branche dev pour les contributions..."

# Vérifier que nous sommes dans un repo git
if [ ! -d .git ]; then
    echo "❌ Erreur: Ce script doit être exécuté dans un repository Git"
    exit 1
fi

# Vérifier si le remote upstream existe
if ! git remote | grep -q upstream; then
    echo "➕ Ajout du remote upstream..."
    git remote add upstream https://github.com/kevas007/proxmox-dash.git
    echo "✅ Remote upstream ajouté"
else
    echo "✅ Remote upstream existe déjà"
fi

# Récupérer les dernières modifications
echo "📥 Récupération des dernières modifications..."
git fetch upstream

# Vérifier si la branche dev existe localement
if git show-ref --verify --quiet refs/heads/dev; then
    echo "✅ Branche dev existe localement"
    git checkout dev
    echo "🔄 Mise à jour de la branche dev..."
    git pull upstream dev || git merge upstream/dev
else
    echo "➕ Création de la branche dev locale..."
    git checkout -b dev upstream/dev
fi

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Créez une branche feature : git checkout -b feature/nom-de-votre-fonctionnalite"
echo "   2. Développez votre fonctionnalité"
echo "   3. Poussez vers votre fork : git push origin feature/nom-de-votre-fonctionnalite"
echo "   4. Créez une Pull Request vers la branche 'dev' (JAMAIS vers 'main')"
echo ""
echo "⚠️  Rappel : La branche 'main' est réservée à kevas007 uniquement"

