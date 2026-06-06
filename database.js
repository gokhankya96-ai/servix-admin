const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const os = require('os');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'teknik-servis.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_code TEXT NOT NULL UNIQUE,
    license_type TEXT NOT NULL CHECK (license_type IN ('trial_7','monthly_30','yearly_365','lifetime')),
    assigned_user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','passive','expired')),
    starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_licenses_user_status ON licenses(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);

CREATE TABLE IF NOT EXISTS device_hwid (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    hwid_hash TEXT NOT NULL,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (license_id),
    UNIQUE (hwid_hash, license_id)
);

CREATE INDEX IF NOT EXISTS idx_device_hwid_user ON device_hwid(user_id);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success','failed','info')),
    message TEXT NOT NULL,
    license_id INTEGER,
    license_code TEXT,
    device_name TEXT,
    platform TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activation_logs_created ON activation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activation_logs_email ON activation_logs(email);

CREATE TABLE IF NOT EXISTS online_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    device_name TEXT,
    platform TEXT,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_online_sessions_seen ON online_sessions(last_seen_at);
`);

try { db.prepare('ALTER TABLE users ADD COLUMN last_login_at TEXT').run(); } catch (error) {}
try { db.prepare("ALTER TABLE users ADD COLUMN admin_note TEXT DEFAULT ''").run(); } catch (error) {}
try { db.prepare("ALTER TABLE licenses ADD COLUMN note TEXT DEFAULT ''").run(); } catch (error) {}

function writeActivationLog({ userId = null, email = '', eventType = 'system', status = 'info', message = '', licenseId = null, licenseCode = '', device = null } = {}) {
    const deviceInfo = device || getCurrentDeviceInfo();

    db.prepare(`
        INSERT INTO activation_logs (user_id, email, event_type, status, message, license_id, license_code, device_name, platform)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        String(email || '').trim().toLowerCase(),
        eventType,
        status,
        message,
        licenseId,
        licenseCode,
        deviceInfo?.name || '',
        deviceInfo?.platform || ''
    );
}

function listActivationLogs(limit = 200) {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 20), 500);
    const rows = db.prepare(`
        SELECT
            a.id,
            a.email,
            a.event_type,
            a.status,
            a.message,
            a.license_code,
            a.device_name,
            a.platform,
            a.created_at,
            u.name AS user_name
        FROM activation_logs a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?
    `).all(safeLimit);

    return {
        ok: true,
        logs: rows.map((row) => ({
            id: row.id,
            email: row.email || '',
            userName: row.user_name || '',
            eventType: row.event_type,
            status: row.status,
            message: row.message,
            licenseCode: row.license_code || '',
            deviceName: row.device_name || '',
            platform: row.platform || '',
            createdAt: row.created_at
        }))
    };
}



const defaultBackupDir = path.join(app.getPath('userData'), 'backups');
try { fs.mkdirSync(defaultBackupDir, { recursive: true }); } catch (error) {}

const DEFAULT_SETTINGS = {
    appName: 'Teknik Servis',
    updateUrl: '',
    defaultLicenseType: 'trial_7',
    smtpHost: '',
    smtpPort: '',
    smtpSecure: 'false',
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: '',
    autoBackup: 'true',
    backupFrequency: 'daily',
    backupRetention: '10',
    backupDir: '',
    lastAutoBackupAt: ''
};

function getSetting(key, fallback = '') {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
}

function getAppSettings() {
    const rows = db.prepare('SELECT key, value FROM app_settings').all();
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach((row) => {
        settings[row.key] = row.value;
    });
    if (settings.smtpPassword) {
        settings.smtpPasswordSaved = 'true';
        settings.smtpPassword = '';
    }
    return { ok: true, settings };
}

function saveAppSettings(payload = {}) {
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const save = db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    const tx = db.transaction(() => {
        allowed.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(payload, key)) {
                return;
            }
            if (key === 'smtpPassword' && !payload.smtpPassword) {
                return;
            }
            save.run(key, String(payload[key] ?? ''));
        });
    });
    tx();

    try { getBackupDirectory(); } catch (_error) {}

    writeActivationLog({ eventType: 'settings_updated', status: 'info', message: 'Sistem ayarları güncellendi.' });
    return { ok: true, message: 'Ayarlar kaydedildi.', settings: getAppSettings().settings };
}


function getBackupDirectory() {
    const configured = String(getSetting('backupDir', DEFAULT_SETTINGS.backupDir) || '').trim();
    const resolved = configured || defaultBackupDir;
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
}

function saveInternalSetting(key, value) {
    db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, String(value ?? ''));
}

function shouldRunAutoBackup() {
    if (getSetting('autoBackup', DEFAULT_SETTINGS.autoBackup) !== 'true') {
        return false;
    }

    const frequency = getSetting('backupFrequency', DEFAULT_SETTINGS.backupFrequency);
    const lastValue = getSetting('lastAutoBackupAt', DEFAULT_SETTINGS.lastAutoBackupAt);
    if (!lastValue) return true;

    const lastDate = new Date(lastValue);
    if (Number.isNaN(lastDate.getTime())) return true;

    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const limits = {
        hourly: 60 * 60 * 1000,
        daily: 24 * 60 * 60 * 1000,
        weekly: 7 * 24 * 60 * 60 * 1000
    };
    return diffMs >= (limits[frequency] || limits.daily);
}

function cleanupOldBackups() {
    try {
        const retention = Math.min(Math.max(Number(getSetting('backupRetention', DEFAULT_SETTINGS.backupRetention)) || 10, 1), 100);
        const dir = getBackupDirectory();
        const autoBackups = fs.readdirSync(dir)
            .filter((file) => file.startsWith('auto-') && file.endsWith('.db'))
            .map((file) => ({ file, fullPath: path.join(dir, file), stat: fs.statSync(path.join(dir, file)) }))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        autoBackups.slice(retention).forEach((backup) => {
            try { fs.unlinkSync(backup.fullPath); } catch (_error) {}
        });
    } catch (_error) {}
}

async function runAutoBackupIfNeeded() {
    if (!shouldRunAutoBackup()) {
        return { ok: true, skipped: true, message: 'Otomatik yedek zamanı gelmedi.' };
    }

    const result = await createDatabaseBackup({ reason: 'auto' });
    if (result.ok) {
        saveInternalSetting('lastAutoBackupAt', new Date().toISOString());
        cleanupOldBackups();
    }
    return result;
}

function safeBackupName(prefix = 'backup') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${stamp}.db`;
}


function getRawAppSettings() {
    const rows = db.prepare('SELECT key, value FROM app_settings').all();
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach((row) => {
        settings[row.key] = row.value;
    });
    return settings;
}

function getSmtpConfig() {
    const settings = getRawAppSettings();
    const host = String(settings.smtpHost || '').trim();
    const port = Number(settings.smtpPort || '587');
    const secure = String(settings.smtpSecure || 'false') === 'true';
    const user = String(settings.smtpUser || '').trim();
    const pass = String(settings.smtpPassword || '');
    const from = String(settings.smtpFrom || user || '').trim();

    if (!host || !port || !from) {
        return { ok: false, message: 'SMTP host, port ve gönderici mail bilgisi girilmeli.' };
    }

    const config = {
        host,
        port,
        secure,
        tls: { rejectUnauthorized: false }
    };

    if (user || pass) {
        config.auth = { user, pass };
    }

    return { ok: true, config, from, user, host, port };
}

function createMailLog({ to = '', eventType = 'mail', status = 'info', message = '', userId = null, email = '', licenseId = null, licenseCode = '' }) {
    writeActivationLog({
        userId,
        email: email || to,
        eventType,
        status,
        message,
        licenseId,
        licenseCode
    });
}

async function sendSystemMail({ to, subject, text, html, eventType = 'mail_sent', userId = null, email = '', licenseId = null, licenseCode = '' }) {
    const target = String(to || '').trim().toLowerCase();
    if (!target) {
        return { ok: false, message: 'Mail alıcısı bulunamadı.' };
    }

    const smtp = getSmtpConfig();
    if (!smtp.ok) {
        createMailLog({ to: target, eventType, status: 'failed', message: smtp.message, userId, email, licenseId, licenseCode });
        return { ok: false, message: smtp.message };
    }

    try {
        const transporter = nodemailer.createTransport(smtp.config);
        await transporter.sendMail({
            from: smtp.from,
            to: target,
            subject,
            text,
            html
        });

        createMailLog({ to: target, eventType, status: 'success', message: `Mail gönderildi: ${subject}`, userId, email, licenseId, licenseCode });
        return { ok: true, message: 'Mail gönderildi.' };
    } catch (error) {
        const message = error && error.message ? error.message : 'Mail gönderilemedi.';
        createMailLog({ to: target, eventType, status: 'failed', message, userId, email, licenseId, licenseCode });
        return { ok: false, message };
    }
}

async function testSmtpSettings() {
    const smtp = getSmtpConfig();
    if (!smtp.ok) {
        return { ok: false, message: smtp.message };
    }

    try {
        const transporter = nodemailer.createTransport(smtp.config);
        await transporter.verify();
        writeActivationLog({ eventType: 'smtp_test', status: 'success', message: `SMTP bağlantı testi başarılı: ${smtp.host}:${smtp.port}` });
        return { ok: true, message: 'SMTP bağlantı testi başarılı.' };
    } catch (error) {
        const message = error && error.message ? error.message : 'SMTP bağlantı testi başarısız.';
        writeActivationLog({ eventType: 'smtp_test', status: 'failed', message: `SMTP bağlantı testi başarısız: ${message}` });
        return { ok: false, message: `SMTP bağlantı testi başarısız: ${message}` };
    }
}

async function sendTestMail({ to = '' } = {}) {
    const smtp = getSmtpConfig();
    const target = String(to || smtp.from || '').trim();
    return sendSystemMail({
        to: target,
        subject: 'Teknik Servis - Test Maili',
        text: 'SMTP mail sistemi başarıyla çalışıyor.',
        html: '<p>SMTP mail sistemi başarıyla çalışıyor.</p>',
        eventType: 'mail_test'
    });
}

function buildLicenseMailContent(license, user) {
    const expiry = license.expires_at ? license.expires_at : 'Süresiz';
    const label = LICENSE_TYPES[license.license_type]?.label || license.license_type;
    const text = [
        'Lisans bilgileriniz oluşturuldu.',
        `Lisans Kodu: ${license.license_code}`,
        `Lisans Tipi: ${label}`,
        `Bitiş Tarihi: ${expiry}`
    ].join('\n');

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>Lisans Bilgileriniz</h2>
            <p>Merhaba ${user.name || user.email},</p>
            <p>Lisans bilgileriniz aşağıdadır.</p>
            <ul>
                <li><strong>Lisans Kodu:</strong> ${license.license_code}</li>
                <li><strong>Lisans Tipi:</strong> ${label}</li>
                <li><strong>Bitiş Tarihi:</strong> ${expiry}</li>
            </ul>
        </div>
    `;

    return { text, html };
}

async function sendLicenseInfoMail({ licenseId } = {}) {
    const row = db.prepare(`
        SELECT l.id, l.license_code, l.license_type, l.expires_at, u.id AS user_id, u.name, u.email
        FROM licenses l
        INNER JOIN users u ON u.id = l.assigned_user_id
        WHERE l.id = ?
        LIMIT 1
    `).get(Number(licenseId));

    if (!row || !row.email) {
        return { ok: false, message: 'Lisans atanmış kullanıcı bulunamadı.' };
    }

    const content = buildLicenseMailContent(row, row);
    return sendSystemMail({
        to: row.email,
        subject: 'Lisans Bilgileriniz',
        text: content.text,
        html: content.html,
        eventType: 'license_mail',
        userId: row.user_id,
        email: row.email,
        licenseId: row.id,
        licenseCode: row.license_code
    });
}

async function sendPasswordResetMail({ email = '' } = {}) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ? LIMIT 1').get(cleanEmail);
    if (!user) {
        return { ok: false, message: 'Şifre sıfırlama maili için kullanıcı bulunamadı.' };
    }

    return sendSystemMail({
        to: user.email,
        subject: 'Şifreniz Güncellendi',
        text: 'Teknik Servis hesabınızın şifresi güncellendi. Bu işlemi siz yapmadıysanız yöneticinizle iletişime geçin.',
        html: '<p>Teknik Servis hesabınızın şifresi güncellendi.</p><p>Bu işlemi siz yapmadıysanız yöneticinizle iletişime geçin.</p>',
        eventType: 'password_reset_mail',
        userId: user.id,
        email: user.email
    });
}

async function sendExpiringLicenseMails() {
    const result = listExpiringLicenses();
    const licenses = (result.licenses || []).filter((license) => license.assignedEmail);
    let sent = 0;
    let failed = 0;

    for (const license of licenses) {
        const subject = `Lisansınız ${license.dueState || 'yakında bitecek'}`;
        const text = `Lisans kodunuz ${license.code}. Durum: ${license.dueState}. Bitiş: ${license.expiresAt}.`;
        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
                <h2>Lisans Süresi Uyarısı</h2>
                <p><strong>${license.code}</strong> lisansınız için durum: ${license.dueState}</p>
                <p>Bitiş tarihi: ${license.expiresAt}</p>
            </div>
        `;
        const mailResult = await sendSystemMail({
            to: license.assignedEmail,
            subject,
            text,
            html,
            eventType: 'license_expiry_mail',
            userId: license.userId,
            email: license.assignedEmail,
            licenseId: license.id,
            licenseCode: license.code
        });
        if (mailResult.ok) sent += 1;
        else failed += 1;
    }

    return {
        ok: failed === 0,
        message: `Lisans bitiş maili gönderimi tamamlandı. Başarılı: ${sent}, Hatalı: ${failed}`,
        sent,
        failed
    };
}


async function createDatabaseBackup({ reason = 'manual' } = {}) {
    try {
        const activeBackupDir = getBackupDirectory();
        const fileName = safeBackupName(reason === 'auto' ? 'auto' : 'manual');
        const destination = path.join(activeBackupDir, fileName);
        await db.backup(destination);
        writeActivationLog({ eventType: 'database_backup', status: 'info', message: `Veritabanı yedeği alındı: ${fileName}` });
        return { ok: true, message: 'Yedek başarıyla alındı.', backup: describeBackupFile(destination) };
    } catch (error) {
        return { ok: false, message: error.message || 'Yedek alınamadı.' };
    }
}

function describeBackupFile(filePath) {
    const stat = fs.statSync(filePath);
    return {
        fileName: path.basename(filePath),
        path: filePath,
        size: stat.size,
        createdAt: stat.mtime.toISOString().slice(0, 19).replace('T', ' ')
    };
}

function listDatabaseBackups() {
    try {
        const activeBackupDir = getBackupDirectory();
        const backups = fs.readdirSync(activeBackupDir)
            .filter((file) => file.endsWith('.db'))
            .map((file) => describeBackupFile(path.join(activeBackupDir, file)))
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return { ok: true, backupDir: activeBackupDir, backups };
    } catch (error) {
        return { ok: false, message: error.message || 'Yedek listesi okunamadı.', backups: [] };
    }
}

function restoreDatabaseBackup(fileName) {
    const cleanName = path.basename(String(fileName || ''));
    if (!cleanName.endsWith('.db')) {
        return { ok: false, message: 'Geçersiz yedek dosyası.' };
    }

    const activeBackupDir = getBackupDirectory();
    const source = path.join(activeBackupDir, cleanName);
    if (!fs.existsSync(source)) {
        return { ok: false, message: 'Yedek dosyası bulunamadı.' };
    }

    try {
        const beforeRestore = path.join(activeBackupDir, safeBackupName('before-restore'));
        db.backup(beforeRestore);
        db.close();
        fs.copyFileSync(source, dbPath);
        return { ok: true, message: 'Yedek geri yüklendi. Programı kapatıp tekrar açın.' };
    } catch (error) {
        return { ok: false, message: error.message || 'Yedek geri yüklenemedi.' };
    }
}

function touchOnlineSession(user) {
    const device = getCurrentDeviceInfo();
    db.prepare(`
        INSERT INTO online_sessions (user_id, email, role, device_name, platform, last_seen_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            email = excluded.email,
            role = excluded.role,
            device_name = excluded.device_name,
            platform = excluded.platform,
            last_seen_at = CURRENT_TIMESTAMP
    `).run(user.id, user.email, user.role, device.name, device.platform);
}

function listOnlineUsers() {
    const rows = db.prepare(`
        SELECT s.user_id, s.email, s.role, s.device_name, s.platform, s.last_seen_at, u.name, u.status
        FROM online_sessions s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE datetime(s.last_seen_at) >= datetime('now', '-15 minutes')
        ORDER BY s.last_seen_at DESC
        LIMIT 200
    `).all();

    return {
        ok: true,
        users: rows.map((row) => ({
            id: row.user_id,
            name: row.name || '',
            email: row.email || '',
            role: row.role || '',
            status: row.status || '',
            deviceName: row.device_name || '',
            platform: row.platform || '',
            lastSeenAt: row.last_seen_at || ''
        }))
    };
}

function cleanupAdminLicenses() {
    db.prepare(`
        DELETE FROM device_hwid
        WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')
    `).run();

    db.prepare(`
        DELETE FROM licenses
        WHERE assigned_user_id IN (SELECT id FROM users WHERE role = 'admin')
    `).run();
}

cleanupAdminLicenses();
try { db.prepare("DELETE FROM activation_logs WHERE event_type = 'admin_login'").run(); } catch (error) {}

const LICENSE_TYPES = {
    trial_7: { label: '7 Günlük Deneme', days: 7 },
    monthly_30: { label: '30 Günlük Lisans', days: 30 },
    yearly_365: { label: '365 Günlük Lisans', days: 365 },
    lifetime: { label: 'Süresiz Lisans', days: null }
};

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { passwordHash, salt };
}

function verifyPassword(password, passwordHash, salt) {
    const incomingHash = crypto.scryptSync(password, salt, 64);
    const savedHash = Buffer.from(passwordHash, 'hex');

    if (incomingHash.length !== savedHash.length) {
        return false;
    }

    return crypto.timingSafeEqual(incomingHash, savedHash);
}


function getCurrentDeviceInfo() {
    const cpuModel = os.cpus()?.[0]?.model || 'unknown-cpu';
    const rawHwid = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.userInfo().username,
        cpuModel
    ].join('|');

    return {
        hash: crypto.createHash('sha256').update(rawHwid).digest('hex'),
        name: os.hostname(),
        platform: `${os.platform()}-${os.arch()}`
    };
}

function bindOrValidateHwid({ userId, licenseId }) {
    const currentDevice = getCurrentDeviceInfo();
    const savedDevice = db.prepare(`
        SELECT id, hwid_hash, device_name
        FROM device_hwid
        WHERE license_id = ?
        LIMIT 1
    `).get(licenseId);

    if (!savedDevice) {
        db.prepare(`
            INSERT INTO device_hwid (license_id, user_id, hwid_hash, device_name, platform)
            VALUES (?, ?, ?, ?, ?)
        `).run(licenseId, userId, currentDevice.hash, currentDevice.name, currentDevice.platform);

        return {
            ok: true,
            message: 'Lisans bu cihaza bağlandı.',
            device: { name: currentDevice.name, platform: currentDevice.platform }
        };
    }

    if (savedDevice.hwid_hash !== currentDevice.hash) {
        return {
            ok: false,
            message: `Bu lisans başka bir cihaza bağlı. Kayıtlı cihaz: ${savedDevice.device_name}. HWID reset gerekli.`
        };
    }

    db.prepare(`
        UPDATE device_hwid
        SET last_seen_at = CURRENT_TIMESTAMP, device_name = ?, platform = ?
        WHERE id = ?
    `).run(currentDevice.name, currentDevice.platform, savedDevice.id);

    return {
        ok: true,
        message: 'Cihaz doğrulandı.',
        device: { name: currentDevice.name, platform: currentDevice.platform }
    };
}

function resetLicenseHwid(licenseId) {
    const license = db.prepare(`
        SELECT l.id, l.license_code, u.id AS user_id, u.email
        FROM licenses l
        LEFT JOIN users u ON u.id = l.assigned_user_id
        WHERE l.id = ?
    `).get(licenseId);
    const result = db.prepare('DELETE FROM device_hwid WHERE license_id = ?').run(licenseId);
    writeActivationLog({
        userId: license?.user_id || null,
        email: license?.email || '',
        eventType: 'hwid_reset',
        status: 'info',
        message: result.changes > 0 ? 'HWID kaydı sıfırlandı.' : 'HWID reset istendi, kayıtlı cihaz bulunamadı.',
        licenseId: license?.id || licenseId,
        licenseCode: license?.license_code || ''
    });
    return {
        ok: true,
        message: result.changes > 0 ? 'HWID kaydı sıfırlandı.' : 'Bu lisans için kayıtlı HWID bulunamadı.'
    };
}


function normalizeDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
}

function generateShortLicenseCode(type = 'trial_7') {
    const prefixMap = {
        trial_7: 'TRY',
        monthly_30: 'MON',
        yearly_365: 'YRL',
        lifetime: 'LFT'
    };

    const prefix = prefixMap[type] || 'LIC';
    const partOne = crypto.randomBytes(2).toString('hex').toUpperCase();
    const partTwo = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `TKS-${prefix}-${partOne}-${partTwo}`;
}

function createLicense({ type = 'trial_7', assignedUserId = null, note = '' } = {}) {
    if (!LICENSE_TYPES[type]) {
        return { ok: false, message: 'Geçersiz lisans tipi.' };
    }

    const now = new Date();
    const cleanNote = String(note || '').trim().slice(0, 300);
    const expiresAt = LICENSE_TYPES[type].days === null ? null : normalizeDate(addDays(now, LICENSE_TYPES[type].days));

    let licenseCode = generateShortLicenseCode(type);
    let attempts = 0;

    while (attempts < 8) {
        try {
            const result = db.prepare(`
                INSERT INTO licenses (license_code, license_type, assigned_user_id, starts_at, expires_at, note)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(licenseCode, type, assignedUserId, normalizeDate(now), expiresAt, cleanNote);

            return {
                ok: true,
                message: 'Lisans oluşturuldu.',
                license: {
                    id: result.lastInsertRowid,
                    code: licenseCode,
                    type,
                    label: LICENSE_TYPES[type].label,
                    startsAt: normalizeDate(now),
                    expiresAt,
                    status: 'active'
                }
            };
        } catch (error) {
            if (String(error.message || '').includes('UNIQUE')) {
                licenseCode = generateShortLicenseCode(type);
                attempts += 1;
                continue;
            }
            throw error;
        }
    }

    return { ok: false, message: 'Lisans kodu üretilemedi.' };
}

function getActiveLicense(userId) {
    const now = normalizeDate(new Date());

    const expiredLicenses = db.prepare(`
        UPDATE licenses
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE assigned_user_id = ?
          AND status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at <= ?
    `).run(userId, now);

    const license = db.prepare(`
        SELECT id, license_code, license_type, status, starts_at, expires_at
        FROM licenses
        WHERE assigned_user_id = ?
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY expires_at IS NULL DESC, expires_at DESC
        LIMIT 1
    `).get(userId, now);

    if (!license) {
        return null;
    }

    return {
        id: license.id,
        code: license.license_code,
        type: license.license_type,
        label: LICENSE_TYPES[license.license_type]?.label || license.license_type,
        status: license.status,
        startsAt: license.starts_at,
        expiresAt: license.expires_at
    };
}

function ensureTrialLicense(userId) {
    const licenseCount = db.prepare('SELECT COUNT(*) AS count FROM licenses WHERE assigned_user_id = ?').get(userId).count;

    if (licenseCount > 0) {
        return getActiveLicense(userId);
    }

    const trial = createLicense({ type: 'trial_7', assignedUserId: userId });
    return trial.ok ? trial.license : null;
}

function createUser({ name, email, password }) {
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
        return { ok: false, message: 'Ad soyad, e-posta ve şifre zorunludur.' };
    }

    if (String(password).length < 6) {
        return { ok: false, message: 'Şifre en az 6 karakter olmalıdır.' };
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existingUser) {
        return { ok: false, message: 'Bu e-posta ile kayıtlı hesap zaten var.' };
    }

    const { passwordHash, salt } = hashPassword(password);
    const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, password_salt)
        VALUES (?, ?, ?, ?)
    `).run(cleanName, cleanEmail, passwordHash, salt);

    return {
        ok: true,
        message: 'Yönetici hesabı oluşturuldu. Giriş ekranına yönlendiriliyorsunuz.',
        user: { id: result.lastInsertRowid, name: cleanName, email: cleanEmail, role: 'admin', status: 'active' }
    };
}

function loginUser({ email, password }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = db.prepare(`
        SELECT id, name, email, password_hash, password_salt, role, status, created_at, last_login_at
        FROM users
        WHERE email = ?
    `).get(cleanEmail);

    if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
        writeActivationLog({ email: cleanEmail, eventType: 'login_failed', status: 'failed', message: 'E-posta veya şifre hatalı.' });
        return { ok: false, message: 'E-posta veya şifre hatalı.' };
    }

    if (user.status !== 'active') {
        writeActivationLog({ userId: user.id, email: user.email, eventType: 'banned_login', status: 'failed', message: 'Banlı/pasif kullanıcı giriş denemesi.' });
        return { ok: false, message: 'Bu kullanıcı pasif durumda.' };
    }

    if (user.role === 'admin') {
        cleanupAdminLicenses();
try { db.prepare("DELETE FROM activation_logs WHERE event_type = 'admin_login'").run(); } catch (error) {}
        db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        touchOnlineSession(user);
        return {
            ok: true,
            message: 'Yönetici girişi başarılı.',
            user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status }
        };
    }

    const activeLicense = getActiveLicense(user.id) || ensureTrialLicense(user.id);

    if (!activeLicense) {
        writeActivationLog({ userId: user.id, email: user.email, eventType: 'license_expired', status: 'failed', message: 'Aktif lisans bulunamadı veya lisans süresi doldu.' });
        return { ok: false, message: 'Aktif lisans bulunamadı veya lisans süresi doldu.' };
    }

    const hwidCheck = bindOrValidateHwid({ userId: user.id, licenseId: activeLicense.id });
    if (!hwidCheck.ok) {
        writeActivationLog({ userId: user.id, email: user.email, eventType: 'hwid_mismatch', status: 'failed', message: hwidCheck.message, licenseId: activeLicense.id, licenseCode: activeLicense.code });
        return hwidCheck;
    }

    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    touchOnlineSession(user);
    writeActivationLog({ userId: user.id, email: user.email, eventType: 'user_login', status: 'success', message: 'Giriş başarılı. Lisans ve cihaz doğrulandı.', licenseId: activeLicense.id, licenseCode: activeLicense.code, device: hwidCheck.device });

    return {
        ok: true,
        message: 'Giriş başarılı. Lisans ve cihaz doğrulandı.',
        user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
        license: activeLicense,
        device: hwidCheck.device
    };
}

function updatePassword({ email, newPassword }) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (String(newPassword || '').length < 6) {
        return { ok: false, message: 'Yeni şifre en az 6 karakter olmalıdır.' };
    }

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
        return { ok: false, message: 'Bu e-posta ile kayıtlı hesap bulunamadı.' };
    }

    const { passwordHash, salt } = hashPassword(newPassword);
    db.prepare(`
        UPDATE users
        SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP
        WHERE email = ?
    `).run(passwordHash, salt, cleanEmail);

    sendPasswordResetMail({ email: cleanEmail }).catch(() => {});
    return { ok: true, message: 'Şifreniz güncellendi.' };
}

function findUserByEmail(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
        return null;
    }

    return db.prepare(`
        SELECT id, name, email, role, status
        FROM users
        WHERE email = ?
        LIMIT 1
    `).get(cleanEmail);
}

function createManagedLicense({ type = 'trial_7', assignedEmail = '', note = '' } = {}) {
    const cleanEmail = String(assignedEmail || '').trim().toLowerCase();
    let assignedUserId = null;

    if (cleanEmail) {
        const user = findUserByEmail(cleanEmail);
        if (!user) {
            note = [`Hedef e-posta: ${cleanEmail}`, String(note || '').trim()].filter(Boolean).join(' | ');
            assignedUserId = null;
        } else {
            if (user.role === 'admin') {
                return { ok: false, message: 'Admin hesabına lisans atanmaz.' };
            }
            assignedUserId = user.id;
        }
    }

    const result = createLicense({ type, assignedUserId, note });
    if (result.ok) {
        writeActivationLog({
            userId: assignedUserId,
            email: cleanEmail,
            eventType: 'license_created',
            status: 'info',
            message: assignedUserId ? 'Lisans oluşturuldu ve hesaba atandı.' : 'Atanmamış lisans oluşturuldu.',
            licenseId: result.license.id,
            licenseCode: result.license.code
        });
        if (assignedUserId) {
            sendLicenseInfoMail({ licenseId: result.license.id }).catch(() => {});
        }
    }
    if (result.ok && cleanEmail && !assignedUserId) {
        return {
            ...result,
            message: `${result.license.code} oluşturuldu. E-posta kayıtlı olmadığı için lisans atanmamış bırakıldı.`
        };
    }
    return result;
}

function listManagedLicenses() {
    const now = normalizeDate(new Date());

    db.prepare(`
        UPDATE licenses
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at <= ?
    `).run(now);

    const rows = db.prepare(`
        SELECT
            l.id,
            l.license_code,
            l.license_type,
            l.status,
            l.starts_at,
            l.expires_at,
            l.created_at,
            l.note,
            u.name AS user_name,
            u.email AS user_email,
            u.role AS user_role,
            d.device_name,
            d.platform,
            d.last_seen_at
        FROM licenses l
        LEFT JOIN users u ON u.id = l.assigned_user_id
        LEFT JOIN device_hwid d ON d.license_id = l.id
        WHERE u.role IS NULL OR u.role <> 'admin'
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT 200
    `).all();

    return {
        ok: true,
        licenses: rows.map((row) => ({
            id: row.id,
            code: row.license_code,
            type: row.license_type,
            label: LICENSE_TYPES[row.license_type]?.label || row.license_type,
            status: row.status,
            startsAt: row.starts_at,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            note: row.note || '',
            assignedName: row.user_name || '',
            assignedEmail: row.user_email || '',
            deviceName: row.device_name || '',
            platform: row.platform || '',
            lastSeenAt: row.last_seen_at || ''
        }))
    };
}

function getAdminDashboardStats() {
    const now = normalizeDate(new Date());
    const sevenDaysLater = normalizeDate(addDays(new Date(), 7));

    db.prepare(`
        UPDATE licenses
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at <= ?
    `).run(now);

    const totalUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role <> 'admin'").get().count;
    const activeLicenses = db.prepare(`
        SELECT COUNT(*) AS count
        FROM licenses l
        LEFT JOIN users u ON u.id = l.assigned_user_id
        WHERE l.status = 'active'
          AND (l.expires_at IS NULL OR l.expires_at > ?)
          AND (u.role IS NULL OR u.role <> 'admin')
    `).get(now).count;
    const expiringSoon = db.prepare(`
        SELECT COUNT(*) AS count
        FROM licenses l
        LEFT JOIN users u ON u.id = l.assigned_user_id
        WHERE l.status = 'active'
          AND l.expires_at IS NOT NULL
          AND l.expires_at > ?
          AND l.expires_at <= ?
          AND (u.role IS NULL OR u.role <> 'admin')
    `).get(now, sevenDaysLater).count;
    const boundDevices = db.prepare(`
        SELECT COUNT(*) AS count
        FROM device_hwid d
        LEFT JOIN users u ON u.id = d.user_id
        WHERE u.role IS NULL OR u.role <> 'admin'
    `).get().count;

    return {
        ok: true,
        stats: {
            totalUsers,
            activeLicenses,
            expiringSoon,
            boundDevices
        }
    };
}

function listManagedUsers(search = '') {
    const q = `%${String(search || '').trim().toLowerCase()}%`;
    const rows = db.prepare(`
        SELECT
            u.id,
            u.name,
            u.email,
            u.role,
            u.status,
            u.created_at,
            u.last_login_at,
            u.admin_note,
            l.id AS license_id,
            l.license_code,
            l.license_type,
            l.status AS license_status,
            l.expires_at,
            d.device_name,
            d.platform,
            d.last_seen_at
        FROM users u
        LEFT JOIN licenses l ON l.id = (
            SELECT id FROM licenses
            WHERE assigned_user_id = u.id
            ORDER BY status = 'active' DESC, expires_at IS NULL DESC, expires_at DESC, id DESC
            LIMIT 1
        )
        LEFT JOIN device_hwid d ON d.license_id = l.id
        WHERE u.role <> 'admin'
          AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT 300
    `).all(q, q);

    return {
        ok: true,
        users: rows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            status: row.status,
            createdAt: row.created_at,
            lastLoginAt: row.last_login_at || '',
            note: row.admin_note || '',
            licenseId: row.license_id || null,
            licenseCode: row.license_code || '',
            licenseType: row.license_type || '',
            licenseLabel: row.license_type ? (LICENSE_TYPES[row.license_type]?.label || row.license_type) : '',
            licenseStatus: row.license_status || '',
            expiresAt: row.expires_at || '',
            deviceName: row.device_name || '',
            platform: row.platform || '',
            lastSeenAt: row.last_seen_at || ''
        }))
    };
}

function setManagedUserStatus(userId, status) {
    if (!['active', 'banned'].includes(status)) {
        return { ok: false, message: 'Geçersiz kullanıcı durumu.' };
    }

    const user = db.prepare('SELECT id, role, email FROM users WHERE id = ?').get(userId);
    if (!user) {
        return { ok: false, message: 'Kullanıcı bulunamadı.' };
    }
    if (user.role === 'admin') {
        return { ok: false, message: 'Admin hesabı değiştirilemez.' };
    }

    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, userId);
    const target = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    writeActivationLog({ userId, email: target?.email || '', eventType: status === 'banned' ? 'user_banned' : 'user_activated', status: 'info', message: status === 'banned' ? 'Kullanıcı banlandı.' : 'Kullanıcı aktif edildi.' });
    return { ok: true, message: status === 'banned' ? 'Kullanıcı banlandı.' : 'Kullanıcı aktif edildi.' };
}

function deleteManagedUser(userId) {
    const user = db.prepare('SELECT id, role, email FROM users WHERE id = ?').get(userId);
    if (!user) {
        return { ok: false, message: 'Kullanıcı bulunamadı.' };
    }
    if (user.role === 'admin') {
        return { ok: false, message: 'Admin hesabı silinemez.' };
    }

    writeActivationLog({ userId, email: user.email, eventType: 'user_deleted', status: 'info', message: 'Kullanıcı silindi. Lisanslar atanmamış duruma alındı.' });
    db.prepare('DELETE FROM device_hwid WHERE user_id = ?').run(userId);
    db.prepare('UPDATE licenses SET assigned_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assigned_user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return { ok: true, message: 'Kullanıcı silindi. Lisanslar atanmamış duruma alındı.' };
}

function extendManagedUserLicense({ userId, type = 'monthly_30' } = {}) {
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
        return { ok: false, message: 'Kullanıcı bulunamadı.' };
    }
    if (user.role === 'admin') {
        return { ok: false, message: 'Admin hesabına lisans uygulanmaz.' };
    }
    if (!LICENSE_TYPES[type]) {
        return { ok: false, message: 'Geçersiz lisans tipi.' };
    }

    const activeLicense = getActiveLicense(userId);
    if (!activeLicense) {
        return createLicense({ type, assignedUserId: userId });
    }

    if (type === 'lifetime') {
        db.prepare(`
            UPDATE licenses
            SET license_type = ?, expires_at = NULL, status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(type, activeLicense.id);
        const target = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
        writeActivationLog({ userId, email: target?.email || '', eventType: 'license_extended', status: 'info', message: 'Lisans süresiz olarak güncellendi.', licenseId: activeLicense.id, licenseCode: activeLicense.code });
        return { ok: true, message: 'Lisans süresiz olarak güncellendi.' };
    }

    const baseDate = activeLicense.expiresAt ? new Date(activeLicense.expiresAt.replace(' ', 'T')) : new Date();
    const now = new Date();
    const startFrom = baseDate > now ? baseDate : now;
    const newExpiresAt = normalizeDate(addDays(startFrom, LICENSE_TYPES[type].days));

    db.prepare(`
        UPDATE licenses
        SET license_type = ?, expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(type, newExpiresAt, activeLicense.id);

    const target = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    writeActivationLog({ userId, email: target?.email || '', eventType: 'license_extended', status: 'info', message: 'Lisans süresi uzatıldı.', licenseId: activeLicense.id, licenseCode: activeLicense.code });
    return { ok: true, message: 'Lisans süresi uzatıldı.' };
}


function updateManagedUser(payload = {}) {
    const userId = Number(payload.userId);
    const cleanName = String(payload.name || '').trim();
    const cleanEmail = String(payload.email || '').trim().toLowerCase();
    const newPassword = String(payload.newPassword || '');
    const note = String(payload.note || '').trim();
    const status = String(payload.status || 'active');
    const licenseType = String(payload.licenseType || 'monthly_30');
    const licenseStatus = String(payload.licenseStatus || 'active');
    const expiresAtRaw = String(payload.expiresAt || '').trim();
    const manualHwid = String(payload.manualHwid || '').trim();

    if (!cleanName || !cleanEmail) {
        return { ok: false, message: 'Ad soyad ve e-posta zorunludur.' };
    }
    if (!['active', 'banned'].includes(status)) {
        return { ok: false, message: 'Geçersiz kullanıcı durumu.' };
    }
    if (!LICENSE_TYPES[licenseType]) {
        return { ok: false, message: 'Geçersiz lisans tipi.' };
    }
    if (!['active', 'passive', 'expired'].includes(licenseStatus)) {
        return { ok: false, message: 'Geçersiz abonelik durumu.' };
    }
    if (newPassword && newPassword.length < 6) {
        return { ok: false, message: 'Yeni şifre en az 6 karakter olmalıdır.' };
    }

    const user = db.prepare('SELECT id, role, email FROM users WHERE id = ?').get(userId);
    if (!user) {
        return { ok: false, message: 'Kullanıcı bulunamadı.' };
    }
    if (user.role === 'admin') {
        return { ok: false, message: 'Admin hesabı düzenlenemez.' };
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(cleanEmail, userId);
    if (existingEmail) {
        return { ok: false, message: 'Bu e-posta başka bir kullanıcıda kayıtlı.' };
    }

    db.prepare(`
        UPDATE users
        SET name = ?, email = ?, status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(cleanName, cleanEmail, status, note, userId);

    if (newPassword) {
        const { passwordHash, salt } = hashPassword(newPassword);
        db.prepare(`
            UPDATE users
            SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(passwordHash, salt, userId);
    }

    let activeLicense = getActiveLicense(userId);
    if (!activeLicense) {
        const created = createLicense({ type: licenseType, assignedUserId: userId });
        if (!created.ok) {
            return created;
        }
        activeLicense = created.license;
    }

    const expiresAt = licenseType === 'lifetime'
        ? null
        : (expiresAtRaw ? `${expiresAtRaw.slice(0, 10)} 23:59:59` : activeLicense.expiresAt || normalizeDate(addDays(new Date(), LICENSE_TYPES[licenseType].days)));

    db.prepare(`
        UPDATE licenses
        SET license_type = ?, status = ?, expires_at = ?, assigned_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(licenseType, licenseStatus, expiresAt, userId, activeLicense.id);

    if (manualHwid) {
        const hwidHash = /^[a-f0-9]{64}$/i.test(manualHwid)
            ? manualHwid.toLowerCase()
            : crypto.createHash('sha256').update(manualHwid).digest('hex');
        const existingDevice = db.prepare('SELECT id FROM device_hwid WHERE license_id = ?').get(activeLicense.id);
        if (existingDevice) {
            db.prepare(`
                UPDATE device_hwid
                SET user_id = ?, hwid_hash = ?, device_name = ?, platform = ?, last_seen_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(userId, hwidHash, manualHwid, 'manual', existingDevice.id);
        } else {
            db.prepare(`
                INSERT INTO device_hwid (license_id, user_id, hwid_hash, device_name, platform)
                VALUES (?, ?, ?, ?, ?)
            `).run(activeLicense.id, userId, hwidHash, manualHwid, 'manual');
        }
    }

    writeActivationLog({
        userId,
        email: cleanEmail,
        eventType: 'user_updated',
        status: 'info',
        message: 'Kullanıcı bilgileri, abonelik ve cihaz bilgileri güncellendi.',
        licenseId: activeLicense.id,
        licenseCode: activeLicense.code
    });

    return { ok: true, message: 'Kullanıcı düzenlendi.' };
}



function getLicenseById(licenseId) {
    return db.prepare(`
        SELECT
            l.id,
            l.license_code,
            l.license_type,
            l.assigned_user_id,
            l.status,
            l.expires_at,
            u.email AS user_email,
            u.role AS user_role
        FROM licenses l
        LEFT JOIN users u ON u.id = l.assigned_user_id
        WHERE l.id = ?
        LIMIT 1
    `).get(licenseId);
}

function resolveAssignableUser(assignedEmail = '') {
    const cleanEmail = String(assignedEmail || '').trim().toLowerCase();
    if (!cleanEmail) {
        return { ok: true, userId: null, email: '' };
    }

    const user = findUserByEmail(cleanEmail);
    if (!user) {
        return { ok: false, message: 'Bu e-posta ile kayıtlı hesap bulunamadı.' };
    }
    if (user.role === 'admin') {
        return { ok: false, message: 'Admin hesabına lisans atanmaz.' };
    }

    return { ok: true, userId: user.id, email: user.email };
}

function updateManagedLicense(payload = {}) {
    const licenseId = Number(payload.licenseId);
    const type = String(payload.type || 'monthly_30');
    const status = String(payload.status || 'active');
    const assignedEmail = String(payload.assignedEmail || '').trim().toLowerCase();
    const expiresAtRaw = String(payload.expiresAt || '').trim();

    if (!LICENSE_TYPES[type]) {
        return { ok: false, message: 'Geçersiz lisans tipi.' };
    }
    if (!['active', 'passive', 'expired'].includes(status)) {
        return { ok: false, message: 'Geçersiz lisans durumu.' };
    }

    const license = getLicenseById(licenseId);
    if (!license) {
        return { ok: false, message: 'Lisans bulunamadı.' };
    }
    if (license.user_role === 'admin') {
        return { ok: false, message: 'Admin lisansı düzenlenemez.' };
    }

    const assigned = resolveAssignableUser(assignedEmail);
    if (!assigned.ok) {
        return assigned;
    }

    const expiresAt = type === 'lifetime'
        ? null
        : (expiresAtRaw ? `${expiresAtRaw.slice(0, 10)} 23:59:59` : license.expires_at || normalizeDate(addDays(new Date(), LICENSE_TYPES[type].days)));

    db.prepare(`
        UPDATE licenses
        SET license_type = ?, assigned_user_id = ?, status = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(type, assigned.userId, status, expiresAt, licenseId);

    writeActivationLog({
        userId: assigned.userId,
        email: assigned.email,
        eventType: 'license_updated',
        status: 'info',
        message: 'Lisans bilgileri düzenlendi.',
        licenseId,
        licenseCode: license.license_code
    });

    return { ok: true, message: 'Lisans düzenlendi.' };
}


function assignManagedLicense(payload = {}) {
    const licenseId = Number(payload.licenseId);
    const assignedEmail = String(payload.assignedEmail || '').trim().toLowerCase();

    const license = getLicenseById(licenseId);
    if (!license) {
        return { ok: false, message: 'Lisans bulunamadı.' };
    }
    if (license.user_role === 'admin') {
        return { ok: false, message: 'Admin lisansı taşınamaz.' };
    }

    const assigned = resolveAssignableUser(assignedEmail);
    if (!assigned.ok) {
        return assigned;
    }

    db.prepare(`
        UPDATE licenses
        SET assigned_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(assigned.userId, licenseId);

    // Lisans farklı hesaba taşınırken eski cihaz bağını sıfırla.
    db.prepare('DELETE FROM device_hwid WHERE license_id = ?').run(licenseId);

    writeActivationLog({
        userId: assigned.userId,
        email: assigned.email,
        eventType: assigned.userId ? 'license_assigned' : 'license_unassigned',
        status: 'info',
        message: assigned.userId ? 'Lisans kullanıcıya atandı/taşındı.' : 'Lisans ataması kaldırıldı.',
        licenseId,
        licenseCode: license.license_code
    });

    if (assigned.userId) {
        sendLicenseInfoMail({ licenseId }).catch(() => {});
    }

    return { ok: true, message: assigned.userId ? 'Lisans kullanıcıya atandı/taşındı.' : 'Lisans ataması kaldırıldı.' };
}

function deleteManagedLicense(licenseId) {
    const license = getLicenseById(Number(licenseId));
    if (!license) {
        return { ok: false, message: 'Lisans bulunamadı.' };
    }
    if (license.user_role === 'admin') {
        return { ok: false, message: 'Admin lisansı silinemez.' };
    }

    writeActivationLog({
        userId: license.assigned_user_id || null,
        email: license.user_email || '',
        eventType: 'license_deleted',
        status: 'info',
        message: 'Lisans silindi.',
        licenseId: license.id,
        licenseCode: license.license_code
    });

    const deleteTransaction = db.transaction(() => {
        db.prepare('DELETE FROM device_hwid WHERE license_id = ?').run(license.id);
        db.prepare('DELETE FROM licenses WHERE id = ?').run(license.id);
    });

    deleteTransaction();

    return { ok: true, message: 'Lisans silindi.' };
}

function setManagedLicenseStatus(payload = {}) {
    const licenseId = Number(payload.licenseId);
    const status = String(payload.status || 'active');
    if (!['active', 'passive', 'expired'].includes(status)) {
        return { ok: false, message: 'Geçersiz lisans durumu.' };
    }

    const license = getLicenseById(licenseId);
    if (!license) {
        return { ok: false, message: 'Lisans bulunamadı.' };
    }
    if (license.user_role === 'admin') {
        return { ok: false, message: 'Admin lisansı değiştirilemez.' };
    }

    db.prepare('UPDATE licenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, licenseId);
    writeActivationLog({
        userId: license.assigned_user_id || null,
        email: license.user_email || '',
        eventType: status === 'passive' ? 'license_suspended' : 'license_activated',
        status: 'info',
        message: status === 'passive' ? 'Lisans askıya alındı.' : 'Lisans aktif edildi.',
        licenseId,
        licenseCode: license.license_code
    });

    return { ok: true, message: status === 'passive' ? 'Lisans askıya alındı.' : 'Lisans aktif edildi.' };
}

function extendManagedLicense(payload = {}) {
    const licenseId = Number(payload.licenseId);
    const type = String(payload.type || 'monthly_30');
    if (!LICENSE_TYPES[type]) {
        return { ok: false, message: 'Geçersiz lisans tipi.' };
    }

    const license = getLicenseById(licenseId);
    if (!license) {
        return { ok: false, message: 'Lisans bulunamadı.' };
    }
    if (license.user_role === 'admin') {
        return { ok: false, message: 'Admin lisansı uzatılamaz.' };
    }

    let newExpiresAt = null;
    if (type !== 'lifetime') {
        const currentExpire = license.expires_at ? new Date(String(license.expires_at).replace(' ', 'T')) : new Date();
        const now = new Date();
        const baseDate = currentExpire > now ? currentExpire : now;
        newExpiresAt = normalizeDate(addDays(baseDate, LICENSE_TYPES[type].days));
    }

    db.prepare(`
        UPDATE licenses
        SET license_type = ?, expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(type, newExpiresAt, licenseId);

    writeActivationLog({
        userId: license.assigned_user_id || null,
        email: license.user_email || '',
        eventType: 'license_extended',
        status: 'info',
        message: type === 'lifetime' ? 'Lisans süresiz yapıldı.' : 'Lisans süresi uzatıldı.',
        licenseId,
        licenseCode: license.license_code
    });

    return { ok: true, message: type === 'lifetime' ? 'Lisans süresiz yapıldı.' : 'Lisans süresi uzatıldı.' };
}

function listExpiringLicenses() {
    const nowDate = new Date();
    const now = normalizeDate(nowDate);
    const sevenDaysLater = normalizeDate(addDays(nowDate, 7));

    db.prepare(`
        UPDATE licenses
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at <= ?
    `).run(now);

    const rows = db.prepare(`
        SELECT
            l.id,
            l.license_code,
            l.license_type,
            l.status,
            l.expires_at,
            u.id AS user_id,
            u.name AS user_name,
            u.email AS user_email,
            d.device_name,
            d.platform
        FROM licenses l
        LEFT JOIN users u ON u.id = l.assigned_user_id
        LEFT JOIN device_hwid d ON d.license_id = l.id
        WHERE l.expires_at IS NOT NULL
          AND (u.role IS NULL OR u.role <> 'admin')
          AND (
                l.status = 'expired'
                OR (l.status = 'active' AND l.expires_at > ? AND l.expires_at <= ?)
          )
        ORDER BY
            CASE WHEN l.status = 'expired' THEN 0 ELSE 1 END,
            l.expires_at ASC,
            l.id DESC
        LIMIT 300
    `).all(now, sevenDaysLater);

    return {
        ok: true,
        licenses: rows.map((row) => {
            let dueState = '7 gün içinde';
            if (row.status === 'expired') {
                dueState = 'Süresi dolmuş';
            } else {
                const diffMs = new Date(String(row.expires_at).replace(' ', 'T')).getTime() - nowDate.getTime();
                const diffDays = Math.ceil(diffMs / 86400000);
                if (diffDays <= 1) dueState = 'Bugün bitecek';
                else if (diffDays <= 3) dueState = '3 gün içinde';
            }

            return {
                id: row.id,
                code: row.license_code,
                type: row.license_type,
                label: LICENSE_TYPES[row.license_type]?.label || row.license_type,
                status: row.status,
                dueState,
                expiresAt: row.expires_at,
                userId: row.user_id || null,
                assignedName: row.user_name || '',
                assignedEmail: row.user_email || '',
                deviceName: row.device_name || '',
                platform: row.platform || ''
            };
        })
    };
}


function ensureDemoTestData() {
    const existingCustomerCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role <> 'admin'").get().count;
    if (existingCustomerCount > 0) {
        return;
    }

    const demoEmail = 'demo@teknikservis.local';
    const demoPassword = 'Demo1234';
    const { passwordHash, salt } = hashPassword(demoPassword);

    const existingDemo = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
    const userId = existingDemo
        ? existingDemo.id
        : db.prepare(`
            INSERT INTO users (name, email, password_hash, password_salt, role, status, admin_note)
            VALUES (?, ?, ?, ?, 'customer', 'active', ?)
        `).run('Demo Kullanıcı', demoEmail, passwordHash, salt, 'Test için oluşturulan demo kullanıcı.').lastInsertRowid;

    let license = db.prepare(`
        SELECT id, license_code
        FROM licenses
        WHERE assigned_user_id = ?
        ORDER BY id DESC
        LIMIT 1
    `).get(userId);

    if (!license) {
        const created = createLicense({ type: 'monthly_30', assignedUserId: userId });
        if (created.ok) {
            license = { id: created.license.id, license_code: created.license.code };
        }
    }

    if (license) {
        const existingDevice = db.prepare('SELECT id FROM device_hwid WHERE license_id = ?').get(license.id);
        if (!existingDevice) {
            const demoHwid = crypto.createHash('sha256').update('DEMO-HWID-TEST-CIHAZI').digest('hex');
            db.prepare(`
                INSERT INTO device_hwid (license_id, user_id, hwid_hash, device_name, platform)
                VALUES (?, ?, ?, ?, ?)
            `).run(license.id, userId, demoHwid, 'Demo Test Cihazı', 'windows-demo');
        }
    }
}

try { ensureDemoTestData(); } catch (error) { console.error('Demo test verisi oluşturulamadı:', error); }
try { runAutoBackupIfNeeded(); } catch (error) { console.error('Otomatik yedek alınamadı:', error); }

module.exports = {
    createUser,
    loginUser,
    updatePassword,
    createLicense,
    createManagedLicense,
    listManagedLicenses,
    getActiveLicense,
    resetLicenseHwid,
    getAdminDashboardStats,
    listManagedUsers,
    setManagedUserStatus,
    deleteManagedUser,
    extendManagedUserLicense,
    updateManagedUser,
    updateManagedLicense,
    assignManagedLicense,
    deleteManagedLicense,
    setManagedLicenseStatus,
    extendManagedLicense,
    listActivationLogs,
    listExpiringLicenses,
    getAppSettings,
    saveAppSettings,
    testSmtpSettings,
    sendTestMail,
    sendLicenseInfoMail,
    sendPasswordResetMail,
    sendExpiringLicenseMails,
    createDatabaseBackup,
    listDatabaseBackups,
    restoreDatabaseBackup,
    runAutoBackupIfNeeded,
    listOnlineUsers,
    dbPath
};
