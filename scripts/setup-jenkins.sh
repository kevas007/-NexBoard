#!/bin/bash

# Script pour configurer Jenkins pour Proxmox Dash
# Usage: ./scripts/setup-jenkins.sh

set -e

echo "🔧 Configuration de Jenkins pour Proxmox Dash..."

# Vérifier que Jenkins est installé
if ! command -v jenkins &> /dev/null && ! systemctl is-active --quiet jenkins; then
    echo "⚠️  Jenkins n'est pas installé ou ne fonctionne pas"
    echo "Installez Jenkins d'abord : https://www.jenkins.io/doc/book/installing/"
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

# Vérifier que l'utilisateur Jenkins peut utiliser Docker
if ! groups jenkins | grep -q docker; then
    echo "➕ Ajout de l'utilisateur Jenkins au groupe docker..."
    sudo usermod -aG docker jenkins
    echo "✅ Utilisateur Jenkins ajouté au groupe docker"
    echo "⚠️  Redémarrez Jenkins : sudo systemctl restart jenkins"
fi

# Vérifier que Go est installé
if ! command -v go &> /dev/null; then
    echo "⚠️  Go n'est pas installé"
    echo "Installez Go 1.22+ : https://go.dev/doc/install"
fi

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js n'est pas installé"
    echo "Installez Node.js 18+ : https://nodejs.org/"
fi

echo ""
echo "✅ Vérifications terminées"
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Accédez à Jenkins : http://localhost:8080"
echo "   2. Installez les plugins requis (voir jenkins/README.md)"
echo "   3. Configurez les outils (Go, Node.js) dans Global Tool Configuration"
echo "   4. Créez un nouveau Multibranch Pipeline"
echo "   5. Configurez le repository Git"
echo "   6. Le pipeline se lancera automatiquement"
echo ""
echo "📚 Documentation complète : jenkins/README.md"

