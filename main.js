const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


const isDev = !app.isPackaged;
const SECURITY_MANIFEST = path.join(__dirname, 'security-manifest.json');
const sensitiveRateBuckets = new Map();

app.setAppUserModelId('com.teknikservis.authscreen');
app.commandLine.appendSwitch('disable-site-isolation-trials');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
}

function getClientKey(event, action) {
    const senderId = event && event.sender ? event.sender.id : 'unknown';
    return `${action}:${senderId}`;
}

function checkRateLimit(key, limit = 8, windowMs = 60 * 1000) {
    const now = Date.now();
    const bucket = sensitiveRateBuckets.get(key) || [];
    const active = bucket.filter((timestamp) => now - timestamp < windowMs);
    if (active.length >= limit) {
        sensitiveRateBuckets.set(key, active);
        return false;
    }
    active.push(now);
    sensitiveRateBuckets.set(key, active);
    return true;
}

function withRateLimit(channel, handler, limit = 8, windowMs = 60 * 1000) {
    ipcMain.handle(channel, async (event, payload) => {
        const key = getClientKey(event, channel);
        if (!checkRateLimit(key, limit, windowMs)) {
            return { ok: false, message: 'Çok fazla işlem denemesi yapıldı. Lütfen kısa süre sonra tekrar deneyin.' };
        }
        return handler(event, payload);
    });
}

function sha256File(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function verifySecurityManifest() {
    try {
        if (!fs.existsSync(SECURITY_MANIFEST)) {
            return { ok: isDev, message: isDev ? 'Geliştirme modunda manifest aranmadı.' : 'Güvenlik manifesti bulunamadı.' };
        }
        const manifest = JSON.parse(fs.readFileSync(SECURITY_MANIFEST, 'utf8'));
        const mismatches = [];
        Object.entries(manifest.files || {}).forEach(([relativePath, expectedHash]) => {
            const absolutePath = path.join(__dirname, relativePath);
            if (!fs.existsSync(absolutePath)) {
                mismatches.push(`${relativePath}: dosya yok`);
                return;
            }
            const actualHash = sha256File(absolutePath);
            if (actualHash !== expectedHash) {
                mismatches.push(relativePath);
            }
        });
        if (mismatches.length) {
            return { ok: false, message: `Dosya bütünlüğü doğrulanamadı: ${mismatches.join(', ')}` };
        }
        return { ok: true, message: 'Dosya bütünlüğü doğrulandı.' };
    } catch (error) {
        return { ok: isDev, message: error.message || 'Dosya bütünlüğü kontrolü başarısız.' };
    }
}

function enforceProductionSecurity(win) {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
        }
    });
    win.webContents.on('before-input-event', (event, input) => {
        if (!isDev && input.control && input.shift && String(input.key).toUpperCase() === 'I') {
            event.preventDefault();
        }
    });
}

let database;
let mainWindow = null;
let updateStatus = { status: 'idle', message: 'Güncelleme kontrolü hazır.', currentVersion: app.getVersion(), updateInfo: null };

function sendUpdateStatus(extra = {}) {
    updateStatus = { ...updateStatus, ...extra, currentVersion: app.getVersion() };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:status', updateStatus);
    }
    return updateStatus;
}

function getConfiguredUpdateUrl() {
    try {
        if (database && database.getAppSettings) {
            const result = database.getAppSettings();
            const savedUrl = result && result.settings ? String(result.settings.updateUrl || '').trim() : '';
            if (savedUrl) return savedUrl;
        }
        const pkg = require('./package.json');
        const publish = pkg.build && pkg.build.publish;
        const first = Array.isArray(publish) ? publish[0] : publish;
        return first && first.url ? String(first.url) : '';
    } catch (_error) {
        return '';
    }
}

function isUpdateConfigured() {
    const url = getConfiguredUpdateUrl();
    return Boolean(url && !url.includes('example.com'));
}

function applyUpdateFeedUrl() {
    const url = getConfiguredUpdateUrl();
    if (!url || url.includes('example.com')) return;
    try {
        autoUpdater.setFeedURL({ provider: 'generic', url });
    } catch (error) {
        sendUpdateStatus({ status: 'error', message: `Update URL uygulanamadı: ${error.message}` });
    }
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking', message: 'Güncelleme kontrol ediliyor...' });
});

autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ status: 'available', message: `Yeni sürüm mevcut: ${info.version || 'bilinmiyor'}`, updateInfo: info });
});

autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ status: 'none', message: 'Program güncel.' });
});

autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
        status: 'downloading',
        message: `Güncelleme indiriliyor: %${Math.round(progress.percent || 0)}`,
        progress: Math.round(progress.percent || 0)
    });
});

autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ status: 'downloaded', message: 'Güncelleme indirildi. Yeniden başlatıp kurabilirsiniz.', updateInfo: info, progress: 100 });
});

autoUpdater.on('error', (error) => {
    sendUpdateStatus({ status: 'error', message: error && error.message ? error.message : 'Güncelleme kontrolünde hata oluştu.' });
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 720,
        minWidth: 900,
        minHeight: 620,
        backgroundColor: '#1a1a2e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            devTools: isDev
        }
    });

    mainWindow = win;
    enforceProductionSecurity(win);
    win.loadFile(path.join(__dirname, 'index.html'));
}

async function checkForUpdatesManually() {
    applyUpdateFeedUrl();
    if (!isUpdateConfigured()) {
        return sendUpdateStatus({
            status: 'not_configured',
            message: 'Update sunucusu henüz ayarlı değil. Ayarlar > Update Sunucu Adresi alanına gerçek update adresini girin.'
        });
    }

    try {
        await autoUpdater.checkForUpdates();
        return updateStatus;
    } catch (error) {
        return sendUpdateStatus({ status: 'error', message: error.message || 'Güncelleme kontrolü başarısız.' });
    }
}

async function downloadUpdateManually() {
    try {
        await autoUpdater.downloadUpdate();
        return updateStatus;
    } catch (error) {
        return sendUpdateStatus({ status: 'error', message: error.message || 'Güncelleme indirilemedi.' });
    }
}

function installUpdateNow() {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
}


app.whenReady().then(() => {
    const integrity = verifySecurityManifest();
    if (!integrity.ok && !isDev) {
        dialog.showErrorBox('Güvenlik Hatası', integrity.message);
        app.quit();
        return;
    }

    database = require('./database');

    withRateLimit('auth:register', (_event, payload) => database.createUser(payload), 5, 60 * 1000);
    withRateLimit('auth:login', (_event, payload) => database.loginUser(payload), 8, 60 * 1000);
    withRateLimit('auth:reset-password', (_event, payload) => database.updatePassword(payload), 5, 60 * 1000);
    ipcMain.handle('license:create', (_event, payload) => database.createManagedLicense(payload));
    ipcMain.handle('license:list', () => database.listManagedLicenses());
    ipcMain.handle('license:get-active', (_event, userId) => database.getActiveLicense(userId));
    ipcMain.handle('license:reset-hwid', (_event, licenseId) => database.resetLicenseHwid(licenseId));
    ipcMain.handle('license:delete', (_event, licenseId) => database.deleteManagedLicense(licenseId));
    ipcMain.handle('license:update', (_event, payload) => database.updateManagedLicense(payload));
    ipcMain.handle('license:assign', (_event, payload) => database.assignManagedLicense(payload));
    ipcMain.handle('license:extend', (_event, payload) => database.extendManagedLicense(payload));
    ipcMain.handle('license:set-status', (_event, payload) => database.setManagedLicenseStatus(payload));
    ipcMain.handle('dashboard:get-stats', () => database.getAdminDashboardStats());
    ipcMain.handle('users:list', (_event, search) => database.listManagedUsers(search));
    ipcMain.handle('users:set-status', (_event, payload) => database.setManagedUserStatus(payload.userId, payload.status));
    ipcMain.handle('users:delete', (_event, userId) => database.deleteManagedUser(userId));
    ipcMain.handle('users:extend-license', (_event, payload) => database.extendManagedUserLicense(payload));
    ipcMain.handle('users:update', (_event, payload) => database.updateManagedUser(payload));
    ipcMain.handle('logs:list', () => database.listActivationLogs());
    ipcMain.handle('licenses:expiring', () => database.listExpiringLicenses());
    ipcMain.handle('settings:get', () => database.getAppSettings());
    ipcMain.handle('settings:save', (_event, payload) => database.saveAppSettings(payload));
    withRateLimit('settings:test-smtp', () => database.testSmtpSettings(), 6, 60 * 1000);
    withRateLimit('mail:test-send', (_event, payload) => database.sendTestMail(payload), 5, 60 * 1000);
    withRateLimit('mail:send-expiring', () => database.sendExpiringLicenseMails(), 3, 60 * 1000);
    withRateLimit('mail:send-license-info', (_event, payload) => database.sendLicenseInfoMail(payload), 10, 60 * 1000);
    ipcMain.handle('backup:create', (_event, payload) => database.createDatabaseBackup(payload));
    ipcMain.handle('backup:list', () => database.listDatabaseBackups());
    ipcMain.handle('backup:restore', (_event, fileName) => database.restoreDatabaseBackup(fileName));
    ipcMain.handle('backup:auto-run', () => database.runAutoBackupIfNeeded());
    ipcMain.handle('backup:select-dir', async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
        if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
        return { ok: true, path: result.filePaths[0] };
    });
    ipcMain.handle('online:list', () => database.listOnlineUsers());
    ipcMain.handle('security:get-report', () => verifySecurityManifest());

    ipcMain.handle('updates:get-status', () => updateStatus);
    ipcMain.handle('updates:check', () => checkForUpdatesManually());
    ipcMain.handle('updates:download', () => downloadUpdateManually());
    ipcMain.handle('updates:install', () => installUpdateNow());

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
