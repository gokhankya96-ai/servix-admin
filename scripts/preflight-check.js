const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const requiredFiles = [
  'index.html',
  'style.css',
  'style.js',
  'main.js',
  'preload.js',
  'database.js',
  'package.json'
];
const requiredDeps = [
  'electron',
  'better-sqlite3',
  'electron-builder',
  'electron-rebuild',
  'electron-updater',
  'nodemailer'
];

function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function fail(msg) { console.error(`❌ ${msg}`); process.exitCode = 1; }

console.log('\nTeknik Servis - Production Ön Kontrol\n');

if (!fs.existsSync(pkgPath)) {
  fail('package.json bulunamadı.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

requiredFiles.forEach(file => {
  const filePath = path.join(root, file);
  fs.existsSync(filePath) ? ok(`${file} mevcut`) : fail(`${file} eksik`);
});

const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
requiredDeps.forEach(dep => {
  deps[dep] ? ok(`${dep} paketi tanımlı`) : fail(`${dep} package.json içinde yok`);
});

if (!pkg.version || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
  fail('version semver formatında olmalı. Örn: 1.0.0');
} else {
  ok(`Sürüm numarası geçerli: ${pkg.version}`);
}

if (!pkg.build) {
  fail('electron-builder build ayarları yok.');
} else {
  ok('electron-builder build ayarları mevcut');
  if (!pkg.build.appId) warn('build.appId boş görünüyor.');
  if (!pkg.build.productName) warn('build.productName boş görünüyor.');
  if (!pkg.build.publish || !pkg.build.publish.length) warn('publish ayarı yok; auto update çalışmaz.');
  const publishUrl = pkg.build.publish?.[0]?.url || '';
  if (publishUrl.includes('example.com')) warn('Update URL hâlâ örnek URL. Production için kendi release adresini yaz.');
}

const nodeModules = path.join(root, 'node_modules');
if (!fs.existsSync(nodeModules)) {
  warn('node_modules yok. Önce npm install çalıştır.');
} else {
  ok('node_modules mevcut');
}

const nativeModule = path.join(root, 'node_modules', 'better-sqlite3');
if (!fs.existsSync(nativeModule)) {
  warn('better-sqlite3 kurulmamış görünüyor. npm install sonrası npm run rebuild çalıştır.');
} else {
  ok('better-sqlite3 klasörü mevcut');
}

const iconPath = path.join(root, 'resources', 'icon.ico');
if (!fs.existsSync(iconPath)) {
  warn('resources/icon.ico yok. EXE için özel ikon eklemek istersen bu dosyayı koy.');
} else {
  ok('Installer ikonu mevcut');
}

console.log('\nÖnerilen sıra: npm install → npm run rebuild → npm run preflight → npm start → npm run dist\n');
if (process.exitCode) {
  console.log('Ön kontrolde hata bulundu. Yukarıdaki ❌ maddeleri düzeltmeden production build alma.');
} else {
  console.log('Production ön kontrol tamamlandı.');
}
