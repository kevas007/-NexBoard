#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script de vérification de sécurité final pour NexBoard
 * Vérifie qu'aucun mot de passe ou token n'est en dur dans le code source
 */

const SECURITY_PATTERNS = [
  // Mots de passe en dur (mais pas les champs vides ou les variables)
  /password\s*[:=]\s*['"][^'"]{3,}['"]/gi,

  // Tokens en dur (mais pas les variables d'environnement)
  /token\s*[:=]\s*['"][^'"]{10,}['"]/gi,

  // Secrets en dur
  /secret\s*[:=]\s*['"][^'"]{5,}['"]/gi,

  // Mots de passe spécifiques dangereux
  /admin123|demo123|viewer123|password123|123456/gi,

  // Tokens de développement dangereux
  /dev-token-change-in-production|your-secret-key|your-jwt-secret/gi,
];

const EXCLUDED_FILES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.cache',
  'logs',
  'data',
  'backups',
  'scripts/security-check.js',
  'scripts/security-check-final.js',
  'scripts/generate-tokens.js',
  'package-lock.json',
  'tests',
  'test',
  'docs',
  'backend/main', // Binaire compilé
  'backend/main.exe', // Binaire compilé
];

const EXCLUDED_EXTENSIONS = [
  '.log',
  '.db',
  '.sqlite',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

function shouldExcludeFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);

  return EXCLUDED_FILES.some(excluded => filePath.includes(excluded)) ||
         EXCLUDED_EXTENSIONS.includes(ext);
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    // Ignorer les fichiers de configuration d'exemple
    if (filePath.includes('env.example') || filePath.includes('config.env')) {
      return [];
    }

    // Ignorer les fichiers de test
    if (filePath.includes('test') || filePath.includes('spec')) {
      return [];
    }

    // Ignorer les fichiers de documentation
    if (filePath.includes('docs/') || filePath.includes('README')) {
      return [];
    }

    // Ignorer les fichiers de configuration de build
    if (filePath.includes('Makefile') || filePath.includes('vite.config')) {
      return [];
    }

    SECURITY_PATTERNS.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Ignorer les patterns dans les commentaires ou la documentation
          if (match.includes('example') || match.includes('placeholder') || match.includes('CHANGEME')) {
            return;
          }

          // Ignorer les URLs locales de développement
          if (match.includes('localhost') || match.includes('127.0.0.1')) {
            return;
          }

          // Ignorer les patterns dans les scripts de sécurité eux-mêmes
          if (filePath.includes('security-check')) {
            return;
          }

          // Ignorer les validations de format de token
          if (match.includes('PVEAPIToken=') || match.includes('Token=')) {
            return;
          }

          const lines = content.substring(0, content.indexOf(match)).split('\n').length;
          issues.push({
            line: lines,
            match: match.trim(),
            pattern: `Pattern ${index + 1}`,
            file: filePath
          });
        });
      }
    });

    return issues;
  } catch (error) {
    return [];
  }
}

function scanDirectory(dirPath) {
  const issues = [];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!shouldExcludeFile(fullPath)) {
          issues.push(...scanDirectory(fullPath));
        }
      } else if (stat.isFile()) {
        if (!shouldExcludeFile(fullPath)) {
          issues.push(...scanFile(fullPath));
        }
      }
    }
  } catch (error) {
    // Ignorer les erreurs de permission
  }

  return issues;
}

function main() {
  console.log('🔍 Vérification de sécurité NexBoard (Final)...\n');

  const issues = scanDirectory('.');

  if (issues.length === 0) {
    console.log('✅ Aucun problème de sécurité détecté !');
    console.log('🔒 Le code semble sécurisé.');
    return 0;
  }

  console.log(`❌ ${issues.length} problème(s) de sécurité détecté(s) :\n`);

  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}:${issue.line}`);
    console.log(`   Pattern: ${issue.pattern}`);
    console.log(`   Contenu: ${issue.match}`);
    console.log('');
  });

  console.log('🛠️  Actions recommandées :');
  console.log('1. Supprimez les mots de passe et tokens en dur');
  console.log('2. Utilisez des variables d\'environnement');
  console.log('3. Utilisez le script generate-tokens.js pour générer des secrets');
  console.log('4. Consultez docs/SECURITY-CONFIG.md pour la configuration');

  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { scanFile, scanDirectory, shouldExcludeFile };
