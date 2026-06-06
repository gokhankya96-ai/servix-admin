const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const files = [
  'index.html',
  'style.css',
  'style.js',
  'main.js',
  'preload.js',
  'database.js',
  'package.json'
];

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const manifest = {
  generatedAt: new Date().toISOString(),
  algorithm: 'sha256',
  files: {}
};

for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Manifest dosyası bulunamadı: ${file}`);
  }
  manifest.files[file] = sha256(fullPath);
}

fs.writeFileSync(path.join(root, 'security-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('security-manifest.json oluşturuldu.');
