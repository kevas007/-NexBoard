#!/usr/bin/env node

const crypto = require('crypto');

/**
 * Génère des tokens sécurisés pour ProxmoxDash
 */

function generateSecureToken(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generateJWTSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

console.log('🔐 Génération de tokens sécurisés pour ProxmoxDash\n');

console.log('AUTH_TOKEN (pour l\'authentification API):');
console.log(`AUTH_TOKEN=${generateSecureToken(32)}\n`);

console.log('JWT_SECRET (pour les tokens JWT):');
console.log(`JWT_SECRET=${generateJWTSecret(32)}\n`);

console.log('🔒 Conseils de sécurité:');
console.log('1. Copiez ces valeurs dans votre fichier config.prod.env');
console.log('2. Ne partagez jamais ces tokens');
console.log('3. Régénérez-les régulièrement en production');
console.log('4. Utilisez HTTPS en production');
console.log('5. Configurez un pare-feu approprié');

console.log('\n📝 Exemple de configuration:');
console.log('# Dans config.prod.env');
console.log(`AUTH_TOKEN=${generateSecureToken(32)}`);
console.log(`JWT_SECRET=${generateJWTSecret(32)}`);
console.log('CORS_ORIGINS=https://yourdomain.com');
console.log('ALLOWED_IPS=192.168.1.100,10.0.0.50');
