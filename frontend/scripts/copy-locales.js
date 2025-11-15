// Script pour copier les fichiers de traduction vers public/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '..', 'src', 'locales');
const targetDir = path.join(__dirname, '..', 'public', 'locales');

// Créer le dossier public/locales s'il n'existe pas
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Vérifier que le dossier source existe
if (!fs.existsSync(sourceDir)) {
  console.error(`❌ Dossier source introuvable: ${sourceDir}`);
  process.exit(1);
}

// Copier tous les fichiers .json
try {
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;
  
  files.forEach(file => {
  if (file.endsWith('.json')) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Copié: ${file}`);
      copiedCount++;
  }
});

  console.log(`✨ ${copiedCount} fichier(s) de traduction copié(s) avec succès!`);
} catch (error) {
  console.error('❌ Erreur lors de la copie des traductions:', error);
  process.exit(1);
}
