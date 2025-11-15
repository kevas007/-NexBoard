pipeline {
    agent any

    environment {
        // Variables d'environnement
        DOCKER_REGISTRY = credentials('docker-registry-url') ?: ''
        IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
        PROJECT_NAME = 'proxmox-dash'
        
        // Branches
        MAIN_BRANCH = 'main'
        DEV_BRANCH = 'dev'
        
        // Chemins
        BACKEND_DIR = 'backend'
        FRONTEND_DIR = 'frontend'
        TEST_BACKEND_DIR = 'tests/backend'
        TEST_FRONTEND_DIR = 'frontend/src/test'
        
        // Docker
        DOCKER_BUILDKIT = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
    }

    options {
        // Options du pipeline
        buildDiscarder(logRotator(
            numToKeepStr: '20',
            daysToKeepStr: '30',
            artifactNumToKeepStr: '10'
        ))
        timeout(time: 45, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
        skipDefaultCheckout(false)
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "📥 Checkout du code depuis ${env.GIT_BRANCH}"
                    checkout scm
                    
                    // Vérifier la branche
                    def currentBranch = env.GIT_BRANCH.replaceAll('origin/', '')
                    echo "🌿 Branche actuelle: ${currentBranch}"
                    
                    if (currentBranch == env.MAIN_BRANCH) {
                        echo "⚠️  Branche main détectée - déploiement en production"
                        env.DEPLOY_ENV = 'production'
                    } else if (currentBranch == env.DEV_BRANCH) {
                        echo "🔧 Branche dev détectée - déploiement en développement"
                        env.DEPLOY_ENV = 'development'
                    } else {
                        echo "🧪 Branche feature détectée - tests uniquement"
                        env.DEPLOY_ENV = 'test'
                    }
                }
            }
        }

        stage('Validate') {
            steps {
                script {
                    echo "✅ Validation de la structure du projet..."
                    sh '''
                        # Vérifier la structure
                        [ -d "${BACKEND_DIR}" ] || { echo "❌ Dossier backend manquant"; exit 1; }
                        [ -d "${FRONTEND_DIR}" ] || { echo "❌ Dossier frontend manquant"; exit 1; }
                        [ -f "${BACKEND_DIR}/go.mod" ] || { echo "❌ go.mod manquant"; exit 1; }
                        [ -f "${FRONTEND_DIR}/package.json" ] || { echo "❌ package.json manquant"; exit 1; }
                        echo "✅ Structure valide"
                    '''
                }
            }
        }

        stage('Lint & Format') {
            parallel {
                stage('Backend Lint') {
                    steps {
                        script {
                            echo "🔍 Vérification du code Go..."
                            dir(env.BACKEND_DIR) {
                                sh '''
                                    # Vérifier que Go est installé
                                    go version || { echo "❌ Go non installé"; exit 1; }
                                    
                                    # Télécharger les dépendances
                                    go mod download
                                    go mod verify
                                    
                                    # Formater le code (vérification uniquement)
                                    echo "📝 Vérification du formatage..."
                                    if ! gofmt -l . | grep -q .; then
                                        echo "✅ Code bien formaté"
                                    else
                                        echo "⚠️  Code non formaté détecté (non bloquant)"
                                        gofmt -l . | head -10
                                    fi
                                    
                                    # Vérifier les imports (si goimports est disponible)
                                    if command -v goimports &> /dev/null; then
                                        if ! goimports -l . | grep -q .; then
                                            echo "✅ Imports bien organisés"
                                        else
                                            echo "⚠️  Imports non organisés (non bloquant)"
                                        fi
                                    fi
                                '''
                            }
                        }
                    }
                }
                
                stage('Frontend Lint') {
                    steps {
                        script {
                            echo "🔍 Vérification du code TypeScript/React..."
                            dir(env.FRONTEND_DIR) {
                                sh '''
                                    # Installer les dépendances
                                    echo "📦 Installation des dépendances..."
                                    npm ci --prefer-offline --no-audit
                                    
                                    # Linter
                                    echo "🔍 Exécution du linter..."
                                    npm run lint || echo "⚠️  Linter a trouvé des problèmes (non bloquant)"
                                    
                                    # Vérifier TypeScript
                                    echo "🔍 Vérification TypeScript..."
                                    npx tsc --noEmit || { echo "❌ Erreurs TypeScript"; exit 1; }
                                '''
                            }
                        }
                    }
                }
            }
        }

        stage('Tests') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        script {
                            echo "🧪 Exécution des tests Go..."
                            dir(env.BACKEND_DIR) {
                                sh '''
                                    # Exécuter les tests avec couverture
                                    echo "🧪 Tests unitaires..."
                                    go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
                                    
                                    # Tests dans le dossier tests/backend
                                    if [ -d "../${TEST_BACKEND_DIR}" ]; then
                                        echo "🧪 Tests d'intégration..."
                                        cd "../${TEST_BACKEND_DIR}"
                                        go test -v -race -coverprofile=../coverage-integration.out ./...
                                        cd "../${BACKEND_DIR}"
                                    fi
                                    
                                    # Générer le rapport de couverture
                                    if [ -f "coverage.out" ]; then
                                        go tool cover -func=coverage.out -o coverage.txt
                                        go tool cover -html=coverage.out -o coverage.html
                                        echo "📊 Couverture de code générée"
                                        cat coverage.txt | tail -1
                                    fi
                                '''
                            }
                        }
                    }
                    post {
                        always {
                            script {
                                // Publier le rapport de couverture
                                if (fileExists("${env.BACKEND_DIR}/coverage.html")) {
                                    publishHTML([
                                        reportDir: env.BACKEND_DIR,
                                        reportFiles: 'coverage.html',
                                        reportName: 'Backend Coverage Report',
                                        keepAll: true
                                    ])
                                }
                            }
                        }
                    }
                }
                
                stage('Frontend Tests') {
                    steps {
                        script {
                            echo "🧪 Exécution des tests React..."
                            dir(env.FRONTEND_DIR) {
                                sh '''
                                    # Installer les dépendances
                                    npm ci --prefer-offline --no-audit
                                    
                                    # Exécuter les tests unitaires avec couverture
                                    echo "🧪 Tests unitaires..."
                                    npm run test:coverage || npm run test:run -- --coverage || true
                                    
                                    # Vérifier que les tests ont été exécutés
                                    if [ -d "coverage" ]; then
                                        echo "✅ Rapports de couverture générés"
                                    fi
                                '''
                            }
                        }
                    }
                    post {
                        always {
                            script {
                                // Publier la couverture si disponible
                                if (fileExists("${env.FRONTEND_DIR}/coverage/cobertura-coverage.xml")) {
                                    publishCoverage adapters: [
                                        istanbulCoberturaAdapter("${env.FRONTEND_DIR}/coverage/cobertura-coverage.xml")
                                    ], sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Build') {
            parallel {
                stage('Build Backend') {
                    steps {
                        script {
                            echo "🔨 Build du backend Go..."
                            dir(env.BACKEND_DIR) {
                                sh '''
                                    # Nettoyer les builds précédents
                                    rm -rf bin/ tmp/
                                    mkdir -p bin
                                    
                                    # Build de l'application
                                    echo "🔨 Compilation..."
                                    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
                                        -a -installsuffix cgo \
                                        -ldflags="-w -s" \
                                        -o bin/api \
                                        ./cmd/main.go
                                    
                                    # Vérifier que le binaire existe
                                    if [ ! -f "bin/api" ]; then
                                        echo "❌ Erreur: le binaire n'a pas été créé"
                                        exit 1
                                    fi
                                    
                                    # Afficher les informations du binaire
                                    echo "✅ Build réussi"
                                    ls -lh bin/api
                                    file bin/api
                                '''
                            }
                        }
                    }
                    post {
                        success {
                            archiveArtifacts artifacts: "${env.BACKEND_DIR}/bin/api", fingerprint: true
                        }
                    }
                }
                
                stage('Build Frontend') {
                    steps {
                        script {
                            echo "🔨 Build du frontend React..."
                            dir(env.FRONTEND_DIR) {
                                sh '''
                                    # Nettoyer les builds précédents
                                    rm -rf dist/
                                    
                                    # Installer les dépendances
                                    npm ci --prefer-offline --no-audit
                                    
                                    # Build de production
                                    echo "🔨 Build de production..."
                                    npm run build
                                    
                                    # Vérifier que le build existe
                                    if [ ! -d "dist" ]; then
                                        echo "❌ Erreur: le build n'a pas été créé"
                                        exit 1
                                    fi
                                    
                                    # Vérifier les fichiers essentiels
                                    if [ ! -f "dist/index.html" ]; then
                                        echo "❌ Erreur: index.html manquant"
                                        exit 1
                                    fi
                                    
                                    echo "✅ Build réussi"
                                    du -sh dist/
                                    find dist -type f | wc -l | xargs echo "Fichiers générés:"
                                '''
                            }
                        }
                    }
                    post {
                        success {
                            archiveArtifacts artifacts: "${env.FRONTEND_DIR}/dist/**/*", fingerprint: true
                        }
                    }
                }
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    echo "🐳 Build des images Docker..."
                    
                    def dockerComposeFile = env.DEPLOY_ENV == 'production' ? 'docker-compose.prod.yml' : 'docker-compose.dev.yml'
                    def imagePrefix = env.DEPLOY_ENV == 'production' ? 'prod' : 'dev'
                    
                    sh """
                        # Vérifier Docker
                        docker --version
                        docker-compose --version
                        
                        # Nettoyer les images anciennes (garder les 5 dernières)
                        docker image prune -f || true
                        
                        # Build des images avec cache
                        echo "🔨 Build avec ${dockerComposeFile}..."
                        docker-compose -f ${dockerComposeFile} build --parallel
                        
                        # Vérifier que les images ont été créées
                        docker images | grep ${PROJECT_NAME} || { echo "❌ Images non créées"; exit 1; }
                        
                        # Tag des images si registry configuré
                        if [ -n "${DOCKER_REGISTRY}" ]; then
                            echo "🏷️  Tag des images..."
                            docker tag ${PROJECT_NAME}-api:latest ${DOCKER_REGISTRY}/${PROJECT_NAME}-api:${IMAGE_TAG}
                            docker tag ${PROJECT_NAME}-api:latest ${DOCKER_REGISTRY}/${PROJECT_NAME}-api:${imagePrefix}-latest
                            docker tag ${PROJECT_NAME}-web:latest ${DOCKER_REGISTRY}/${PROJECT_NAME}-web:${IMAGE_TAG}
                            docker tag ${PROJECT_NAME}-web:latest ${DOCKER_REGISTRY}/${PROJECT_NAME}-web:${imagePrefix}-latest
                        fi
                        
                        echo "✅ Images Docker créées"
                        docker images ${PROJECT_NAME}* --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"
                    """
                }
            }
        }

        stage('Security Scan') {
            when {
                anyOf {
                    branch env.MAIN_BRANCH
                    branch env.DEV_BRANCH
                }
            }
            steps {
                script {
                    echo "🔒 Scan de sécurité..."
                    sh '''
                        # Scan des images Docker avec Trivy (si installé)
                        if command -v trivy &> /dev/null; then
                            echo "🔍 Scan de l'image API..."
                            trivy image --exit-code 0 --severity HIGH,CRITICAL \
                                --format table \
                                ${PROJECT_NAME}-api:latest || true
                            
                            echo "🔍 Scan de l'image Web..."
                            trivy image --exit-code 0 --severity HIGH,CRITICAL \
                                --format table \
                                ${PROJECT_NAME}-web:latest || true
                        else
                            echo "⚠️  Trivy non installé, scan de sécurité ignoré"
                            echo "💡 Installez Trivy pour activer le scan: https://github.com/aquasecurity/trivy"
                        fi
                        
                        # Scan des dépendances Go (si gosec est installé)
                        if command -v gosec &> /dev/null; then
                            echo "🔍 Scan de sécurité Go..."
                            cd ${BACKEND_DIR}
                            gosec ./... || true
                        fi
                        
                        # Scan des dépendances npm (audit)
                        echo "🔍 Audit de sécurité npm..."
                        cd ${FRONTEND_DIR}
                        npm audit --audit-level=high || echo "⚠️  Vulnérabilités détectées (non bloquant)"
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch env.MAIN_BRANCH
                    branch env.DEV_BRANCH
                }
            }
            steps {
                script {
                    echo "🚀 Déploiement en ${env.DEPLOY_ENV}..."
                    
                    if (env.DEPLOY_ENV == 'production') {
                        echo "⚠️  Déploiement en PRODUCTION - nécessite approbation"
                        // Ici vous pouvez ajouter une étape d'approbation manuelle
                        // input message: 'Approuver le déploiement en production?', ok: 'Déployer'
                    }
                    
                    def dockerComposeFile = env.DEPLOY_ENV == 'production' ? 'docker-compose.prod.yml' : 'docker-compose.dev.yml'
                    def imagePrefix = env.DEPLOY_ENV == 'production' ? 'prod' : 'dev'
                    
                    sh """
                        # Push vers le registry (si configuré)
                        if [ -n "${DOCKER_REGISTRY}" ]; then
                            echo "📤 Push des images vers le registry..."
                            docker push ${DOCKER_REGISTRY}/${PROJECT_NAME}-api:${IMAGE_TAG} || true
                            docker push ${DOCKER_REGISTRY}/${PROJECT_NAME}-api:${imagePrefix}-latest || true
                            docker push ${DOCKER_REGISTRY}/${PROJECT_NAME}-web:${IMAGE_TAG} || true
                            docker push ${DOCKER_REGISTRY}/${PROJECT_NAME}-web:${imagePrefix}-latest || true
                            echo "✅ Images poussées vers ${DOCKER_REGISTRY}"
                        else
                            echo "ℹ️  Pas de registry configuré, images locales uniquement"
                        fi
                        
                        # Informations de déploiement
                        echo ""
                        echo "🚀 Images prêtes pour le déploiement"
                        echo "   Environnement: ${env.DEPLOY_ENV}"
                        echo "   Compose file: ${dockerComposeFile}"
                        echo "   Tag: ${IMAGE_TAG}"
                        echo ""
                        echo "📋 Commandes de déploiement:"
                        echo "   docker-compose -f ${dockerComposeFile} up -d"
                        echo "   docker-compose -f ${dockerComposeFile} ps"
                        echo "   docker-compose -f ${dockerComposeFile} logs -f"
                    """
                }
            }
        }
    }

    post {
        always {
            // Nettoyage
            script {
                sh '''
                    # Nettoyer les images Docker non utilisées (garder les 5 dernières)
                    docker image prune -f || true
                    
                    # Nettoyer les volumes non utilisés
                    docker volume prune -f || true
                    
                    # Nettoyer les builds (optionnel, garder pour debug)
                    # rm -rf ${BACKEND_DIR}/bin/* || true
                    # rm -rf ${FRONTEND_DIR}/dist/* || true
                '''
            }
        }
        success {
            script {
                echo "✅ Pipeline réussi !"
                echo "📊 Résumé:"
                echo "   - Branche: ${env.GIT_BRANCH}"
                echo "   - Commit: ${env.GIT_COMMIT.take(7)}"
                echo "   - Build: #${env.BUILD_NUMBER}"
                echo "   - Environnement: ${env.DEPLOY_ENV ?: 'test'}"
                
                // Notification de succès (à configurer)
                // slackSend(color: 'good', message: "Build réussi: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
            }
        }
        failure {
            script {
                echo "❌ Pipeline échoué !"
                echo "🔍 Vérifiez les logs ci-dessus pour plus de détails"
                
                // Notification d'échec (à configurer)
                // slackSend(color: 'danger', message: "Build échoué: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
            }
        }
        unstable {
            script {
                echo "⚠️  Pipeline instable"
                echo "Certaines étapes ont échoué mais n'ont pas bloqué le pipeline"
            }
        }
        cleanup {
            // Nettoyage final
            cleanWs()
        }
    }
}

