# Configuration Jenkins CI/CD pour Proxmox Dash

Ce guide explique comment configurer Jenkins pour automatiser le build, les tests et le déploiement du projet.

## 📋 Prérequis

### Sur le serveur Jenkins

1. **Jenkins** installé (version 2.400+)
2. **Plugins Jenkins** requis :
   - Docker Pipeline
   - Docker
   - Git
   - GitHub (si vous utilisez GitHub)
   - AnsiColor
   - HTML Publisher
   - Test Results Analyzer
   - Coverage

3. **Outils installés** :
   - Docker et Docker Compose
   - Go 1.22+
   - Node.js 18+ et npm
   - Git

## 🚀 Configuration

### Option 1 : Pipeline Simple (Jenkinsfile)

1. **Créer un nouveau job Pipeline** :
   - Jenkins → New Item → Pipeline
   - Nom : `nexboard-pipeline`

2. **Configuration** :
   - **Definition** : Pipeline script from SCM
   - **SCM** : Git
   - **Repository URL** : URL de votre repository
   - **Credentials** : Ajoutez vos credentials Git si nécessaire
   - **Branch Specifier** : `*/dev` ou `*/main`
   - **Script Path** : `Jenkinsfile`

3. **Build Triggers** (optionnel) :
   - ✅ GitHub hook trigger for GITScm polling
   - ✅ Poll SCM : `H/5 * * * *` (toutes les 5 minutes)

### Option 2 : Multibranch Pipeline (Recommandé)

1. **Créer un Multibranch Pipeline** :
   - Jenkins → New Item → Multibranch Pipeline
   - Nom : `nexboard-multibranch`

2. **Configuration** :
   - **Branch Sources** : Git
   - **Project Repository** : URL de votre repository
   - **Credentials** : Ajoutez vos credentials Git
   - **Behaviours** :
     - ✅ Discover branches
     - ✅ Discover pull requests
   - **Build Configuration** :
     - Mode : by Jenkinsfile
     - Script Path : `jenkins/Jenkinsfile.multibranch`

3. **Scan Multibranch Pipeline Triggers** :
   - ✅ Build whenever a SNAPSHOT dependency is built
   - ✅ Periodically if not otherwise run : `H/15 * * * *`

## 🔧 Configuration des Outils dans Jenkins

### Configurer Go

1. Jenkins → Manage Jenkins → Global Tool Configuration
2. Section **Go** :
   - Name : `Go-1.22`
   - Install automatically : ✅
   - Version : `1.22.x`

### Configurer Node.js

1. Jenkins → Manage Jenkins → Global Tool Configuration
2. Section **NodeJS** :
   - Name : `NodeJS-18`
   - Install automatically : ✅
   - Version : `18.x.x`

### Configurer Docker

Assurez-vous que l'utilisateur Jenkins peut utiliser Docker :

```bash
# Sur le serveur Jenkins
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

## 🔐 Credentials

### Docker Registry (optionnel)

Si vous utilisez un registry Docker privé :

1. Jenkins → Manage Jenkins → Credentials
2. Add Credentials :
   - Kind : Username with password
   - ID : `docker-registry`
   - Username : votre username
   - Password : votre password

### GitHub (si nécessaire)

1. Jenkins → Manage Jenkins → Credentials
2. Add Credentials :
   - Kind : SSH Username with private key
   - ID : `github-ssh`
   - Private Key : votre clé SSH GitHub

## 📊 Webhooks GitHub/GitLab

### GitHub

1. Repository → Settings → Webhooks
2. Add webhook :
   - Payload URL : `http://votre-jenkins:8080/github-webhook/`
   - Content type : `application/json`
   - Events : ✅ Push, ✅ Pull requests

### GitLab

1. Project → Settings → Webhooks
2. Add webhook :
   - URL : `http://votre-jenkins:8080/project/nexboard-multibranch`
   - Trigger : ✅ Push events, ✅ Merge request events

## 🎯 Workflow

### Branche `dev`

- ✅ Build automatique
- ✅ Tests
- ✅ Build Docker (dev)
- ✅ Déploiement automatique en dev

### Branche `main`

- ✅ Build automatique
- ✅ Tests
- ✅ Build Docker (production)
- ⚠️ Déploiement avec approbation manuelle

### Branches feature

- ✅ Build automatique
- ✅ Tests
- ❌ Pas de déploiement

## 🔍 Monitoring

### Consulter les builds

- Jenkins → `nexboard-multibranch` → Branches
- Cliquez sur une branche pour voir les builds

### Logs

- Chaque build affiche les logs en temps réel
- Les logs sont colorés grâce au plugin AnsiColor

### Rapports

- **Tests** : Résultats disponibles dans chaque build
- **Coverage** : Rapports de couverture de code
- **Artifacts** : Binaires et builds disponibles

## 🐛 Dépannage

### Erreur : "docker: command not found"

**Solution** :
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### Erreur : "go: command not found"

**Solution** : Configurez Go dans Global Tool Configuration

### Erreur : "npm: command not found"

**Solution** : Configurez Node.js dans Global Tool Configuration

### Erreur : "Permission denied"

**Solution** : Vérifiez les permissions Docker et fichiers

## 📝 Personnalisation

### Variables d'environnement

Modifiez le `Jenkinsfile` pour ajouter vos variables :

```groovy
environment {
    MY_VAR = 'value'
    SECRET_VAR = credentials('my-secret')
}
```

### Étapes supplémentaires

Ajoutez des stages dans le `Jenkinsfile` :

```groovy
stage('Mon Stage') {
    steps {
        sh 'ma-commande'
    }
}
```

## 🔗 Ressources

- [Documentation Jenkins](https://www.jenkins.io/doc/)
- [Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Docker Pipeline Plugin](https://plugins.jenkins.io/docker-workflow/)

---

**Pour toute question, consultez la documentation Jenkins ou créez une issue.**

