const fs = require('fs');
const path = require('path');

const channel = (process.argv[2] || process.env.SERVIX_RELEASE_CHANNEL || 'stable').toLowerCase();
const allowed = ['stable', 'beta'];
const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function fail(message) {
  console.error(`\n[Servix Release Check] ${message}\n`);
  process.exit(1);
}

if (!allowed.includes(channel)) {
  fail(`Geçersiz channel: ${channel}. Kullanılabilir: stable, beta`);
}

if (!pkg.version || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(pkg.version)) {
  fail(`package.json version SemVer formatında değil: ${pkg.version}`);
}

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.warn('[Servix Release Check] GH_TOKEN / GITHUB_TOKEN yok. Publish sırasında GitHub yetkilendirmesi gerekebilir.');
}

const publish = pkg.build && pkg.build.publish;
if (!publish || !Array.isArray(publish) || !publish.length) {
  fail('package.json build.publish ayarı bulunamadı.');
}

const github = publish.find(item => item.provider === 'github');
if (!github) {
  fail('GitHub publish provider bulunamadı.');
}

if (!github.owner || github.owner.includes('CHANGE_ME') || !github.repo || github.repo.includes('CHANGE_ME')) {
  fail('package.json içindeki GitHub owner/repo placeholder değerleri gerçek bilgilerle değiştirilmeli.');
}

console.log(`[Servix Release Check] OK`);
console.log(`Version : ${pkg.version}`);
console.log(`Channel : ${channel}`);
console.log(`GitHub  : ${github.owner}/${github.repo}`);
