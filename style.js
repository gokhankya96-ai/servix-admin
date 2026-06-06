const authWrapper = document.querySelector('.auth-wrapper');
const loginTrigger = document.querySelector('.login-trigger');
const registerTrigger = document.querySelector('.register-trigger');

const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const resetPasswordForm = document.querySelector('#resetPasswordForm');

const loginEmail = document.querySelector('#loginEmail');
const loginPassword = document.querySelector('#loginPassword');
const rememberMe = document.querySelector('#rememberMe');
const loginMessage = document.querySelector('#loginMessage');
const loginSubmitButton = document.querySelector('#loginSubmitButton');
const registerMessage = document.querySelector('#registerMessage');
const resetMessage = document.querySelector('#resetMessage');

const passwordResetModal = document.querySelector('#passwordResetModal');
const forgotPasswordTrigger = document.querySelector('.forgot-password-trigger');
const modalClose = document.querySelector('.modal-close');

const adminDashboard = document.querySelector('#adminDashboard');
const logoutButton = document.querySelector('#logoutButton');
const dashboardWelcome = document.querySelector('#dashboardWelcome');
const statUsers = document.querySelector('#statUsers');
const statActiveLicenses = document.querySelector('#statActiveLicenses');
const statExpiring = document.querySelector('#statExpiring');
const statDevices = document.querySelector('#statDevices');
const openLicenseModalButton = document.querySelector('#openLicenseModal');
const licenseModal = document.querySelector('#licenseModal');
const licenseModalClose = document.querySelector('.license-modal-close');
const createLicenseForm = document.querySelector('#createLicenseForm');
const licenseMessage = document.querySelector('#licenseMessage');
const licenseCodePreview = document.querySelector('#licenseCodePreview');
const licenseTypeCards = document.querySelectorAll('.license-type-card');
const licenseTypeChoiceInputs = document.querySelectorAll('input[name="licenseTypeChoice"]');
const licenseCreateSummary = document.querySelector('#licenseCreateSummary');
const licenseTableBody = document.querySelector('#licenseTableBody');
const usersTableBody = document.querySelector('#usersTableBody');
const userSearchInput = document.querySelector('#userSearchInput');
const logsTableBody = document.querySelector('#logsTableBody');
const refreshLogsButton = document.querySelector('#refreshLogsButton');
const expiringTableBody = document.querySelector('#expiringTableBody');
const refreshExpiringButton = document.querySelector('#refreshExpiringButton');
const userEditModal = document.querySelector('#userEditModal');
const userEditModalClose = document.querySelector('.user-edit-modal-close');
const userEditForm = document.querySelector('#userEditForm');
const userEditMessage = document.querySelector('#userEditMessage');
const toastContainer = document.querySelector('#toastContainer');
const currentVersionText = document.querySelector('#currentVersionText');
const updateStatusText = document.querySelector('#updateStatusText');
const updateProgressWrap = document.querySelector('#updateProgressWrap');
const updateProgressBar = document.querySelector('#updateProgressBar');
const checkUpdateButton = document.querySelector('#checkUpdateButton');
const downloadUpdateButton = document.querySelector('#downloadUpdateButton');
const installUpdateButton = document.querySelector('#installUpdateButton');
const onlineTableBody = document.querySelector('#onlineTableBody');
const refreshOnlineButton = document.querySelector('#refreshOnlineButton');
const backupTableBody = document.querySelector('#backupTableBody');
const backupDirText = document.querySelector('#backupDirText');
const createBackupButton = document.querySelector('#createBackupButton');
const refreshBackupsButton = document.querySelector('#refreshBackupsButton');
const selectBackupDirButton = document.querySelector('#selectBackupDirButton');
const settingsForm = document.querySelector('#settingsForm');
const settingsMessage = document.querySelector('#settingsMessage');
const testSmtpButton = document.querySelector('#testSmtpButton');
const sendTestMailButton = document.querySelector('#sendTestMailButton');
const sendExpiringMailButton = document.querySelector('#sendExpiringMailButton');
let currentManagedUsers = [];

// Sidebar ikon/tıklama güvenlik bağlayıcısı.
// Sadece sol menü tıklamalarını garantiye almak için eklendi.
function activateDashboardPageSafely(pageId) {
    if (!pageId) return;

    document.querySelectorAll('.dashboard-page').forEach((page) => {
        page.classList.toggle('active', page.dataset.page === pageId);
    });

    document.querySelectorAll('.sidebar-nav a[data-nav-target]').forEach((item) => {
        item.classList.toggle('active', item.dataset.navTarget === pageId);
    });

    const content = document.querySelector('.dashboard-content');
    if (content) {
        content.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function bindSidebarIconClicks() {
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (!sidebarNav || sidebarNav.dataset.clickBound === 'true') return;

    sidebarNav.dataset.clickBound = 'true';
    sidebarNav.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-nav-target]');
        if (!link) return;

        event.preventDefault();
        event.stopPropagation();
        activateDashboardPageSafely(link.dataset.navTarget);
    });
}

bindSidebarIconClicks();
document.addEventListener('DOMContentLoaded', bindSidebarIconClicks);


const STORAGE_KEYS = {
    user: 'service_app_user',
    rememberedEmail: 'service_app_remembered_email',
    rememberEnabled: 'service_app_remember_enabled'
};

const desktopAuth = window.authAPI || null;

async function registerUser(user) {
    if (desktopAuth) {
        return desktopAuth.register(user);
    }

    saveUser(user);
    return { ok: true, message: 'Kayıt başarılı. Giriş ekranına yönlendiriliyorsunuz.', user };
}

async function loginUser(credentials) {
    if (desktopAuth) {
        return desktopAuth.login(credentials);
    }

    const savedUser = getSavedUser();
    if (!savedUser) {
        return { ok: false, message: 'Önce kayıt oluşturmanız gerekiyor.' };
    }

    if (savedUser.email !== credentials.email || savedUser.password !== credentials.password) {
        return { ok: false, message: 'E-posta veya şifre hatalı.' };
    }

    return { ok: true, message: 'Yönetici girişi başarılı.', user: savedUser };
}

async function getDashboardStats() {
    if (desktopAuth && desktopAuth.getDashboardStats) {
        return desktopAuth.getDashboardStats();
    }

    return {
        ok: true,
        stats: {
            totalUsers: getSavedUser() ? 1 : 0,
            activeLicenses: 0,
            expiringSoon: 0,
            boundDevices: 0
        }
    };
}

async function listLicenses() {
    if (desktopAuth && desktopAuth.listLicenses) {
        return desktopAuth.listLicenses();
    }

    return { ok: true, licenses: [] };
}

async function createLicense(payload) {
    if (desktopAuth && desktopAuth.createLicense) {
        return desktopAuth.createLicense(payload);
    }

    return { ok: false, message: 'Lisans sistemi masaüstü uygulamada çalışır.' };
}

async function listUsers(search = '') {
    if (desktopAuth && desktopAuth.listUsers) {
        return desktopAuth.listUsers(search);
    }

    return { ok: true, users: [] };
}

async function setUserStatus(userId, status) {
    if (desktopAuth && desktopAuth.setUserStatus) {
        return desktopAuth.setUserStatus({ userId, status });
    }

    return { ok: false, message: 'Kullanıcı yönetimi masaüstü uygulamada çalışır.' };
}

async function deleteUser(userId) {
    if (desktopAuth && desktopAuth.deleteUser) {
        return desktopAuth.deleteUser(userId);
    }

    return { ok: false, message: 'Kullanıcı silme masaüstü uygulamada çalışır.' };
}

async function extendUserLicense(userId, type) {
    if (desktopAuth && desktopAuth.extendUserLicense) {
        return desktopAuth.extendUserLicense({ userId, type });
    }

    return { ok: false, message: 'Lisans uzatma masaüstü uygulamada çalışır.' };
}

async function updateUser(payload) {
    if (desktopAuth && desktopAuth.updateUser) {
        return desktopAuth.updateUser(payload);
    }

    return { ok: false, message: 'Kullanıcı düzenleme masaüstü uygulamada çalışır.' };
}

async function resetHwid(licenseId) {
    if (desktopAuth && desktopAuth.resetLicenseHwid) {
        return desktopAuth.resetLicenseHwid(licenseId);
    }

    return { ok: false, message: 'HWID reset masaüstü uygulamada çalışır.' };
}

async function deleteLicense(licenseId) {
    if (desktopAuth && desktopAuth.deleteLicense) {
        return desktopAuth.deleteLicense(licenseId);
    }
    return { ok: false, message: 'Lisans silme masaüstü uygulamada çalışır.' };
}

async function updateLicense(payload) {
    if (desktopAuth && desktopAuth.updateLicense) {
        return desktopAuth.updateLicense(payload);
    }
    return { ok: false, message: 'Lisans düzenleme masaüstü uygulamada çalışır.' };
}

async function assignLicense(payload) {
    if (desktopAuth && desktopAuth.assignLicense) {
        return desktopAuth.assignLicense(payload);
    }
    return { ok: false, message: 'Lisans atama masaüstü uygulamada çalışır.' };
}

async function extendLicense(payload) {
    if (desktopAuth && desktopAuth.extendLicense) {
        return desktopAuth.extendLicense(payload);
    }
    return { ok: false, message: 'Lisans uzatma masaüstü uygulamada çalışır.' };
}

async function setLicenseStatus(payload) {
    if (desktopAuth && desktopAuth.setLicenseStatus) {
        return desktopAuth.setLicenseStatus(payload);
    }
    return { ok: false, message: 'Lisans durumu masaüstü uygulamada çalışır.' };
}

async function listExpiringLicenses() {
    if (desktopAuth && desktopAuth.listExpiringLicenses) {
        return desktopAuth.listExpiringLicenses();
    }

    return { ok: true, licenses: [] };
}

async function listActivationLogs() {
    if (desktopAuth && desktopAuth.listActivationLogs) {
        return desktopAuth.listActivationLogs();
    }

    return { ok: true, logs: [] };
}


async function getUpdateStatus() {
    if (desktopAuth && desktopAuth.getUpdateStatus) {
        return desktopAuth.getUpdateStatus();
    }

    return { status: 'web', message: 'Güncelleme sistemi masaüstü uygulamada çalışır.', currentVersion: 'web' };
}

async function checkForUpdates() {
    if (desktopAuth && desktopAuth.checkForUpdates) {
        return desktopAuth.checkForUpdates();
    }

    return { status: 'web', message: 'Güncelleme sistemi masaüstü uygulamada çalışır.', currentVersion: 'web' };
}

async function downloadUpdate() {
    if (desktopAuth && desktopAuth.downloadUpdate) {
        return desktopAuth.downloadUpdate();
    }

    return { status: 'web', message: 'Güncelleme indirme masaüstü uygulamada çalışır.', currentVersion: 'web' };
}

async function installUpdate() {
    if (desktopAuth && desktopAuth.installUpdate) {
        return desktopAuth.installUpdate();
    }

    return { ok: false, message: 'Güncelleme kurma masaüstü uygulamada çalışır.' };
}


async function listOnlineUsers() {
    if (desktopAuth && desktopAuth.listOnlineUsers) {
        return desktopAuth.listOnlineUsers();
    }
    return { ok: true, users: [] };
}

async function listBackups() {
    if (desktopAuth && desktopAuth.listBackups) {
        return desktopAuth.listBackups();
    }
    return { ok: true, backupDir: '', backups: [] };
}

async function createBackup() {
    if (desktopAuth && desktopAuth.createBackup) {
        return desktopAuth.createBackup({ reason: 'manual' });
    }
    return { ok: false, message: 'Backup sistemi masaüstü uygulamada çalışır.' };
}

async function restoreBackup(fileName) {
    if (desktopAuth && desktopAuth.restoreBackup) {
        return desktopAuth.restoreBackup(fileName);
    }
    return { ok: false, message: 'Restore sistemi masaüstü uygulamada çalışır.' };
}

async function getSettings() {
    if (desktopAuth && desktopAuth.getSettings) {
        return desktopAuth.getSettings();
    }
    return { ok: true, settings: {} };
}

async function saveSettings(payload) {
    if (desktopAuth && desktopAuth.saveSettings) {
        return desktopAuth.saveSettings(payload);
    }
    return { ok: false, message: 'Ayarlar masaüstü uygulamada çalışır.' };
}

async function testSmtp() {
    if (desktopAuth && desktopAuth.testSmtp) {
        return desktopAuth.testSmtp();
    }
    return { ok: false, message: 'SMTP testi masaüstü uygulamada çalışır.' };
}

async function sendTestMail(payload) {
    if (desktopAuth && desktopAuth.sendTestMail) {
        return desktopAuth.sendTestMail(payload);
    }
    return { ok: false, message: 'Test mail masaüstü uygulamada çalışır.' };
}

async function sendExpiringLicenseMails() {
    if (desktopAuth && desktopAuth.sendExpiringLicenseMails) {
        return desktopAuth.sendExpiringLicenseMails();
    }
    return { ok: false, message: 'Lisans bitiş mail sistemi masaüstü uygulamada çalışır.' };
}

async function sendLicenseInfoMail(payload) {
    if (desktopAuth && desktopAuth.sendLicenseInfoMail) {
        return desktopAuth.sendLicenseInfoMail(payload);
    }
    return { ok: false, message: 'Lisans mail gönderimi masaüstü uygulamada çalışır.' };
}

async function changePassword(payload) {
    if (desktopAuth) {
        return desktopAuth.resetPassword(payload);
    }

    const savedUser = getSavedUser();
    if (!savedUser || savedUser.email !== payload.email) {
        return { ok: false, message: 'Bu e-posta ile kayıtlı hesap bulunamadı.' };
    }

    saveUser({ ...savedUser, password: payload.newPassword });
    return { ok: true, message: 'Şifreniz güncellendi.' };
}




function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatBytes(bytes = 0) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function renderOnlineUsers(users = []) {
    if (!onlineTableBody) return;
    if (!users.length) {
        onlineTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">Şu an online kullanıcı görünmüyor.</td></tr>';
        return;
    }

    onlineTableBody.innerHTML = users.map((user) => `
        <tr>
            <td><strong>${escapeHtml(user.name || 'İsimsiz')}</strong><span>${escapeHtml(user.email || '')}</span></td>
            <td>${escapeHtml(user.role || '-')}</td>
            <td><span class="status-badge ${user.status === 'active' ? 'active' : 'passive'}">${escapeHtml(user.status || '-')}</span></td>
            <td><strong>${escapeHtml(user.deviceName || '-')}</strong><span>${escapeHtml(user.platform || '')}</span></td>
            <td>${escapeHtml(user.lastSeenAt || '-')}</td>
        </tr>
    `).join('');
}

async function loadOnlineUsers() {
    const result = await listOnlineUsers();
    if (!result.ok) {
        showToast(result.message || 'Online kullanıcılar yüklenemedi.', 'error');
        return;
    }
    renderOnlineUsers(result.users || []);
}

function renderBackups(result = {}) {
    if (backupDirText) backupDirText.textContent = result.backupDir || 'Yedek klasörü bulunamadı.';
    if (!backupTableBody) return;
    const backups = result.backups || [];
    if (!backups.length) {
        backupTableBody.innerHTML = '<tr><td colspan="4" class="table-empty">Henüz yedek alınmamış.</td></tr>';
        return;
    }
    backupTableBody.innerHTML = backups.map((backup) => `
        <tr>
            <td><strong>${escapeHtml(backup.fileName)}</strong></td>
            <td>${formatBytes(backup.size)}</td>
            <td>${escapeHtml(backup.createdAt || '-')}</td>
            <td>
                <button class="table-action warning" data-restore-backup="${escapeHtml(backup.fileName)}" type="button">Geri Yükle</button>
            </td>
        </tr>
    `).join('');
}

async function loadBackups() {
    const result = await listBackups();
    if (!result.ok) {
        showToast(result.message || 'Yedekler yüklenemedi.', 'error');
        return;
    }
    renderBackups(result);
}

function fillSettingsForm(settings = {}) {
    const map = {
        settingAppName: settings.appName,
        settingUpdateUrl: settings.updateUrl,
        settingDefaultLicenseType: settings.defaultLicenseType,
        settingAutoBackup: settings.autoBackup,
        settingBackupRetention: settings.backupRetention,
        settingBackupFrequency: settings.backupFrequency,
        settingBackupDir: settings.backupDir,
        settingSmtpHost: settings.smtpHost,
        settingSmtpPort: settings.smtpPort,
        settingSmtpSecure: settings.smtpSecure,
        settingSmtpUser: settings.smtpUser,
        settingSmtpPassword: '',
        settingSmtpFrom: settings.smtpFrom
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.querySelector(`#${id}`);
        if (el) el.value = value || '';
    });
}

async function loadSettings() {
    const result = await getSettings();
    if (result.ok) fillSettingsForm(result.settings || {});
}

function renderUpdateStatus(status = {}) {
    if (!currentVersionText || !updateStatusText) {
        return;
    }

    currentVersionText.textContent = status.currentVersion ? `v${status.currentVersion}` : 'Bilinmiyor';
    updateStatusText.textContent = status.message || 'Güncelleme durumu hazır.';

    const progress = Number(status.progress || 0);
    if (updateProgressWrap && updateProgressBar) {
        const showProgress = status.status === 'downloading' || status.status === 'downloaded';
        updateProgressWrap.hidden = !showProgress;
        updateProgressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    }

    if (downloadUpdateButton) {
        downloadUpdateButton.hidden = status.status !== 'available';
    }

    if (installUpdateButton) {
        installUpdateButton.hidden = status.status !== 'downloaded';
    }
}

async function loadUpdateStatus() {
    const status = await getUpdateStatus();
    renderUpdateStatus(status);
}

function setMessage(element, message, type = '') {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `form-message ${type}`.trim();
}

function showToast(message, type = 'success') {
    if (!toastContainer || !message) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
        <span class="toast-icon">
            <i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : type === 'info' ? 'fa-circle-info' : 'fa-check'}"></i>
        </span>
        <span class="toast-text">${message}</span>
    `;

    toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('closing');
        window.setTimeout(() => toast.remove(), 260);
    }, 3200);
}

function setLoginLoading(isLoading) {
    loginSubmitButton.disabled = isLoading;
    loginSubmitButton.classList.toggle('loading', isLoading);

    const buttonText = loginSubmitButton.querySelector('.button-text');
    buttonText.textContent = isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap';
}

function getSavedUser() {
    const rawUser = localStorage.getItem(STORAGE_KEYS.user);
    return rawUser ? JSON.parse(rawUser) : null;
}

function saveUser(user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

function openLoginPanel() {
    authWrapper.classList.remove('toggled');
}

function openRegisterPanel() {
    authWrapper.classList.add('toggled');
}

function openPasswordResetModal() {
    passwordResetModal.classList.add('active');
    passwordResetModal.setAttribute('aria-hidden', 'false');
    resetMessage.textContent = '';
}

function closePasswordResetModal() {
    passwordResetModal.classList.remove('active');
    passwordResetModal.setAttribute('aria-hidden', 'true');
    resetPasswordForm.reset();
}

function showDashboard(session) {
    authWrapper.style.display = 'none';
    adminDashboard.classList.add('active');
    adminDashboard.setAttribute('aria-hidden', 'false');

    const displayName = session?.user?.name || 'Yönetici';
    dashboardWelcome.textContent = `${displayName}, yönetici paneline hoş geldiniz.`;
    refreshDashboardStats();
    refreshLicenseTable();
    refreshUsersTable();
    refreshLogsTable();
    refreshExpiringTable();
    openDashboardPage('dashboardTop');
}

function showLogin() {
    adminDashboard.classList.remove('active');
    adminDashboard.setAttribute('aria-hidden', 'true');
    authWrapper.style.display = '';
    loginPassword.value = '';
    setMessage(loginMessage, '', '');
}

async function refreshDashboardStats() {
    const result = await getDashboardStats();
    if (!result.ok || !result.stats) {
        return;
    }

    statUsers.textContent = result.stats.totalUsers ?? 0;
    statActiveLicenses.textContent = result.stats.activeLicenses ?? 0;
    statExpiring.textContent = result.stats.expiringSoon ?? 0;
    statDevices.textContent = result.stats.boundDevices ?? 0;
}

function formatLicenseDate(value) {
    if (!value) {
        return 'Süresiz';
    }

    return String(value).slice(0, 10);
}

function formatDateTime(value) {
    if (!value) {
        return '-';
    }

    return String(value).slice(0, 16);
}


function getLogEventLabel(eventType) {
    const labels = {
        user_login: 'Kullanıcı Girişi',
        login_failed: 'Hatalı Giriş',
        banned_login: 'Banlı Giriş',
        license_expired: 'Lisans Süresi',
        hwid_mismatch: 'HWID Uyuşmazlığı',
        hwid_reset: 'HWID Reset',
        license_created: 'Lisans Oluşturma',
        license_extended: 'Lisans Uzatma',
        license_updated: 'Lisans Düzenleme',
        license_assigned: 'Lisans Atama',
        license_unassigned: 'Lisans Atama Kaldırma',
        license_deleted: 'Lisans Silme',
        license_suspended: 'Lisans Askıya Alma',
        license_activated: 'Lisans Aktif Etme',
        user_banned: 'Kullanıcı Ban',
        user_activated: 'Kullanıcı Aktif',
        user_deleted: 'Kullanıcı Silme',
        user_updated: 'Kullanıcı Düzenleme'
    };

    return labels[eventType] || eventType;
}


function renderExpiringRows(licenses = []) {
    if (!expiringTableBody) {
        return;
    }

    if (!licenses.length) {
        expiringTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">Süresi yaklaşan lisans kaydı yok.</td></tr>';
        return;
    }

    expiringTableBody.innerHTML = licenses.map((license) => {
        const account = license.assignedEmail
            ? `${license.assignedName || 'Hesap'}<small>${license.assignedEmail}</small>`
            : '<span class="muted-text">Atanmamış</span>';
        const device = license.deviceName
            ? `${license.deviceName}<small>${license.platform || ''}</small>`
            : '<span class="muted-text">Bağlı değil</span>';
        const canExtend = Boolean(license.userId);

        return `
            <tr>
                <td><code>${license.code}</code><small>${license.label || license.type}</small></td>
                <td>${account}</td>
                <td><span class="status-pill ${license.status}">${license.dueState || license.status}</span></td>
                <td>${formatLicenseDate(license.expiresAt)}</td>
                <td>${device}</td>
                <td class="user-actions">
                    <select class="table-select" data-expiring-type="${license.userId || ''}" ${canExtend ? '' : 'disabled'}>
                        <option value="monthly_30">30 gün uzat</option>
                        <option value="yearly_365">365 gün uzat</option>
                        <option value="lifetime">Süresiz yap</option>
                    </select>
                    <button class="table-action" data-expiring-extend="${license.userId || ''}" type="button" ${canExtend ? '' : 'disabled'}>Uzat</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function refreshExpiringTable() {
    if (!expiringTableBody) {
        return;
    }

    const result = await listExpiringLicenses();
    if (!result.ok) {
        expiringTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">Bitecek lisanslar yüklenemedi.</td></tr>';
        return;
    }

    renderExpiringRows(result.licenses || []);
}

function renderLogRows(logs = []) {
    if (!logsTableBody) {
        return;
    }

    if (!logs.length) {
        logsTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Henüz aktivasyon kaydı yok.</td></tr>';
        return;
    }

    logsTableBody.innerHTML = logs.map((log) => {
        const account = log.email
            ? `${log.userName || 'Hesap'}<small>${log.email}</small>`
            : '<span class="muted-text">Hesap yok</span>';
        const license = log.licenseCode ? `<code>${log.licenseCode}</code>` : '<span class="muted-text">-</span>';
        const device = log.deviceName
            ? `${log.deviceName}<small>${log.platform || ''}</small>`
            : '<span class="muted-text">-</span>';

        return `
            <tr>
                <td>${formatDateTime(log.createdAt)}</td>
                <td>${getLogEventLabel(log.eventType)}</td>
                <td>${account}</td>
                <td><span class="status-pill ${log.status}">${log.status}</span></td>
                <td>${license}</td>
                <td>${device}</td>
                <td>${log.message || '-'}</td>
            </tr>
        `;
    }).join('');
}

async function refreshLogsTable() {
    if (!logsTableBody) {
        return;
    }

    const result = await listActivationLogs();
    if (!result.ok) {
        logsTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Aktivasyon kayıtları yüklenemedi.</td></tr>';
        return;
    }

    renderLogRows(result.logs || []);
}

function renderUserRows(users = []) {
    if (!usersTableBody) {
        return;
    }

    if (!users.length) {
        usersTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Kullanıcı kaydı bulunamadı.</td></tr>';
        return;
    }

    usersTableBody.innerHTML = users.map((user) => {
        const license = user.licenseCode
            ? `<code>${user.licenseCode}</code><small>${user.licenseLabel || user.licenseType}</small>`
            : '<span class="muted-text">Lisans yok</span>';
        const device = user.deviceName
            ? `${user.deviceName}<small>${user.platform || ''}</small>`
            : '<span class="muted-text">Bağlı değil</span>';
        const nextStatus = user.status === 'banned' ? 'active' : 'banned';
        const statusText = user.status === 'banned' ? 'Aktif Et' : 'Banla';

        return `
            <tr>
                <td><strong>${user.name}</strong><small>${user.email}</small></td>
                <td><span class="status-pill ${user.status}">${user.status}</span></td>
                <td>${license}</td>
                <td>${formatLicenseDate(user.expiresAt)}</td>
                <td>${device}</td>
                <td>${formatDateTime(user.createdAt)}<small>Son giriş: ${formatDateTime(user.lastLoginAt)}</small></td>
                <td class="user-actions user-actions-full">
                    <button class="table-action primary" data-edit-user="${user.id}" type="button" title="Kullanıcı bilgisi, e-posta, şifre, abonelik, HWID ve not düzenle"><i class="fa-solid fa-pen-to-square"></i> Düzenle</button>
                    <select class="table-select" data-extend-type="${user.id}" title="Lisans uzatma tipi">
                        <option value="monthly_30">30 gün uzat</option>
                        <option value="yearly_365">365 gün uzat</option>
                        <option value="lifetime">Süresiz yap</option>
                    </select>
                    <button class="table-action" data-extend-user="${user.id}" type="button" title="Seçili süreyle lisansı uzat"><i class="fa-solid fa-calendar-plus"></i> Uzat</button>
                    <button class="table-action" data-user-hwid-reset="${user.licenseId || ''}" type="button" ${user.licenseId ? '' : 'disabled'} title="Bu kullanıcının bağlı cihazını sıfırla"><i class="fa-solid fa-desktop"></i> HWID Reset</button>
                    <button class="table-action warning" data-user-status="${user.id}" data-next-status="${nextStatus}" type="button" title="Kullanıcı durumunu değiştir"><i class="fa-solid fa-ban"></i> ${statusText}</button>
                    <button class="table-action danger" data-delete-user="${user.id}" type="button" title="Kullanıcıyı sil"><i class="fa-solid fa-trash"></i> Sil</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function refreshUsersTable() {
    if (!usersTableBody) {
        return;
    }

    const result = await listUsers(userSearchInput?.value || '');
    if (!result.ok) {
        usersTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Kullanıcılar yüklenemedi.</td></tr>';
        return;
    }

    currentManagedUsers = result.users || [];
    renderUserRows(currentManagedUsers);
}

function renderLicenseRows(licenses = []) {
    if (!licenseTableBody) {
        return;
    }

    if (!licenses.length) {
        licenseTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Henüz lisans kaydı yok.</td></tr>';
        return;
    }

    licenseTableBody.innerHTML = licenses.map((license) => {
        const assigned = license.assignedEmail
            ? `${license.assignedName || 'Hesap'}<small>${license.assignedEmail}</small>`
            : '<span class="muted-text">Atanmamış</span>';
        const device = license.deviceName
            ? `${license.deviceName}<small>${license.platform || ''}</small>`
            : '<span class="muted-text">Bağlı değil</span>';

        return `
            <tr>
                <td><code>${license.code}</code></td>
                <td>${license.label}</td>
                <td>${assigned}</td>
                <td><span class="status-pill ${license.status}">${license.status}</span></td>
                <td>${formatLicenseDate(license.expiresAt)}</td>
                <td>${device}</td>
                <td class="license-actions-full">
                    <select class="table-select" data-license-type="${license.id}" title="Lisans tipi">
                        <option value="trial_7" ${license.type === 'trial_7' ? 'selected' : ''}>7 gün</option>
                        <option value="monthly_30" ${license.type === 'monthly_30' ? 'selected' : ''}>30 gün</option>
                        <option value="yearly_365" ${license.type === 'yearly_365' ? 'selected' : ''}>365 gün</option>
                        <option value="lifetime" ${license.type === 'lifetime' ? 'selected' : ''}>Süresiz</option>
                    </select>
                    <button class="table-action primary" data-license-edit="${license.id}" data-assigned-email="${escapeHtml(license.assignedEmail || '')}" data-expires-at="${license.expiresAt ? String(license.expiresAt).slice(0, 10) : ''}" data-status="${license.status}" type="button"><i class="fa-solid fa-pen-to-square"></i> Düzenle</button>
                    <button class="table-action" data-license-assign="${license.id}" data-assigned-email="${escapeHtml(license.assignedEmail || '')}" type="button"><i class="fa-solid fa-user-check"></i> Ata/Taşı</button>
                    <button class="table-action" data-license-mail="${license.id}" data-assigned-email="${escapeHtml(license.assignedEmail || '')}" type="button"><i class="fa-solid fa-envelope"></i> Mail Gönder</button>
                    <button class="table-action" data-license-extend="${license.id}" type="button"><i class="fa-solid fa-calendar-plus"></i> Uzat</button>
                    <button class="table-action warning" data-license-status="${license.id}" data-next-status="${license.status === 'passive' ? 'active' : 'passive'}" type="button">${license.status === 'passive' ? 'Aktif Et' : 'Askıya Al'}</button>
                    <button class="table-action" data-hwid-reset="${license.id}" type="button">HWID Reset</button>
                    <button class="table-action danger" data-license-delete="${license.id}" type="button"><i class="fa-solid fa-trash"></i> Sil</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function refreshLicenseTable() {
    const result = await listLicenses();
    if (!result.ok) {
        if (licenseTableBody) {
            licenseTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">Lisanslar yüklenemedi.</td></tr>';
        }
        return;
    }

    renderLicenseRows(result.licenses || []);
}


function openUserEditModal(user) {
    if (!userEditModal || !userEditForm) {
        return;
    }

    userEditForm.reset();
    document.querySelector('#editUserId').value = user.id;
    document.querySelector('#editUserName').value = user.name || '';
    document.querySelector('#editUserEmail').value = user.email || '';
    document.querySelector('#editUserPassword').value = '';
    document.querySelector('#editUserStatus').value = user.status || 'active';
    document.querySelector('#editLicenseType').value = user.licenseType || 'monthly_30';
    document.querySelector('#editLicenseStatus').value = user.licenseStatus || 'active';
    document.querySelector('#editExpiresAt').value = user.expiresAt ? String(user.expiresAt).slice(0, 10) : '';
    document.querySelector('#editManualHwid').value = '';
    document.querySelector('#editUserNote').value = user.note || '';
    setMessage(userEditMessage, '', '');

    userEditModal.classList.add('active');
    userEditModal.setAttribute('aria-hidden', 'false');
}


const LICENSE_CREATE_LABELS = {
    trial_7: '7 Günlük Deneme',
    monthly_30: '30 Günlük Lisans',
    yearly_365: '365 Günlük Lisans',
    lifetime: 'Süresiz Lisans'
};

const LICENSE_CREATE_PREFIX = {
    trial_7: 'TRY',
    monthly_30: 'MON',
    yearly_365: 'YRL',
    lifetime: 'LFT'
};

function makePreviewPart() {
    return Math.random().toString(16).slice(2, 6).toUpperCase().padEnd(4, '0');
}

function refreshLicenseCreatePreview() {
    const typeInput = document.querySelector('#licenseType');
    const type = typeInput?.value || 'trial_7';
    const prefix = LICENSE_CREATE_PREFIX[type] || 'LIC';
    const label = LICENSE_CREATE_LABELS[type] || 'Lisans';

    if (licenseCodePreview) {
        licenseCodePreview.textContent = `TKS-${prefix}-${makePreviewPart()}-${makePreviewPart()}`;
    }
    if (licenseCreateSummary) {
        licenseCreateSummary.textContent = `${label} oluşturulacak. Kod sistem tarafından otomatik üretilecek.`;
    }
}

function setLicenseTypeChoice(type) {
    const hiddenType = document.querySelector('#licenseType');
    if (hiddenType) {
        hiddenType.value = type;
    }
    licenseTypeCards.forEach((card) => {
        const input = card.querySelector('input[type="radio"]');
        const active = input?.value === type;
        card.classList.toggle('active', active);
        if (input) {
            input.checked = active;
        }
    });
    refreshLicenseCreatePreview();
}

function closeUserEditModal() {
    if (!userEditModal || !userEditForm) {
        return;
    }

    userEditModal.classList.remove('active');
    userEditModal.setAttribute('aria-hidden', 'true');
    userEditForm.reset();
    setMessage(userEditMessage, '', '');
}

function openLicenseCreateModal() {
    createLicenseForm?.reset();
    setLicenseTypeChoice('trial_7');
    licenseModal.classList.add('active');
    licenseModal.setAttribute('aria-hidden', 'false');
    setMessage(licenseMessage, '', '');
}

function closeLicenseCreateModal() {
    licenseModal.classList.remove('active');
    licenseModal.setAttribute('aria-hidden', 'true');
    createLicenseForm.reset();
    setLicenseTypeChoice('trial_7');
    setMessage(licenseMessage, '', '');
}

function loadRememberedLogin() {
    const rememberedEmail = localStorage.getItem(STORAGE_KEYS.rememberedEmail);
    const rememberEnabled = localStorage.getItem(STORAGE_KEYS.rememberEnabled) === 'true';

    if (rememberEnabled && rememberedEmail) {
        loginEmail.value = rememberedEmail;
        rememberMe.checked = true;
    }
}


const logoutButtonStates = {
    default: {
        '--figure-duration': '100',
        '--transform-figure': 'none',
        '--walking-duration': '100',
        '--transform-arm1': 'none',
        '--transform-wrist1': 'none',
        '--transform-arm2': 'none',
        '--transform-wrist2': 'none',
        '--transform-leg1': 'none',
        '--transform-calf1': 'none',
        '--transform-leg2': 'none',
        '--transform-calf2': 'none'
    },
    hover: {
        '--figure-duration': '100',
        '--transform-figure': 'translateX(1.5px)',
        '--walking-duration': '100',
        '--transform-arm1': 'rotate(-5deg)',
        '--transform-wrist1': 'rotate(-15deg)',
        '--transform-arm2': 'rotate(5deg)',
        '--transform-wrist2': 'rotate(6deg)',
        '--transform-leg1': 'rotate(-10deg)',
        '--transform-calf1': 'rotate(5deg)',
        '--transform-leg2': 'rotate(20deg)',
        '--transform-calf2': 'rotate(-20deg)'
    },
    walking1: {
        '--figure-duration': '300',
        '--transform-figure': 'translateX(11px)',
        '--walking-duration': '300',
        '--transform-arm1': 'translateX(-4px) translateY(-2px) rotate(120deg)',
        '--transform-wrist1': 'rotate(-5deg)',
        '--transform-arm2': 'translateX(4px) rotate(-110deg)',
        '--transform-wrist2': 'rotate(-5deg)',
        '--transform-leg1': 'translateX(-3px) rotate(80deg)',
        '--transform-calf1': 'rotate(-30deg)',
        '--transform-leg2': 'translateX(4px) rotate(-60deg)',
        '--transform-calf2': 'rotate(20deg)'
    },
    walking2: {
        '--figure-duration': '400',
        '--transform-figure': 'translateX(17px)',
        '--walking-duration': '300',
        '--transform-arm1': 'rotate(60deg)',
        '--transform-wrist1': 'rotate(-15deg)',
        '--transform-arm2': 'rotate(-45deg)',
        '--transform-wrist2': 'rotate(6deg)',
        '--transform-leg1': 'rotate(-5deg)',
        '--transform-calf1': 'rotate(10deg)',
        '--transform-leg2': 'rotate(10deg)',
        '--transform-calf2': 'rotate(-20deg)'
    },
    falling1: {
        '--figure-duration': '1600',
        '--walking-duration': '400',
        '--transform-arm1': 'rotate(-60deg)',
        '--transform-wrist1': 'none',
        '--transform-arm2': 'rotate(30deg)',
        '--transform-wrist2': 'rotate(120deg)',
        '--transform-leg1': 'rotate(-30deg)',
        '--transform-calf1': 'rotate(-20deg)',
        '--transform-leg2': 'rotate(20deg)'
    },
    falling2: {
        '--walking-duration': '300',
        '--transform-arm1': 'rotate(-100deg)',
        '--transform-arm2': 'rotate(-60deg)',
        '--transform-wrist2': 'rotate(60deg)',
        '--transform-leg1': 'rotate(80deg)',
        '--transform-calf1': 'rotate(20deg)',
        '--transform-leg2': 'rotate(-60deg)'
    },
    falling3: {
        '--walking-duration': '500',
        '--transform-arm1': 'rotate(-30deg)',
        '--transform-wrist1': 'rotate(40deg)',
        '--transform-arm2': 'rotate(50deg)',
        '--transform-wrist2': 'none',
        '--transform-leg1': 'rotate(-30deg)',
        '--transform-leg2': 'rotate(20deg)',
        '--transform-calf2': 'none'
    }
};

function updateLogoutButtonState(button, state) {
    const values = logoutButtonStates[state];
    if (!values) return;
    button.dataset.state = state;
    Object.entries(values).forEach(([key, value]) => button.style.setProperty(key, value));
}

function resetLogoutButtonAnimation() {
    logoutButton.classList.remove('clicked', 'door-slammed', 'falling');
    updateLogoutButtonState(logoutButton, 'default');
    logoutButton.disabled = false;
}

function handleAnimatedLogout() {
    const state = logoutButton.dataset.state || 'default';
    if (logoutButton.disabled || !['default', 'hover'].includes(state)) return;

    logoutButton.disabled = true;
    logoutButton.classList.add('clicked');
    updateLogoutButtonState(logoutButton, 'walking1');

    setTimeout(() => {
        logoutButton.classList.add('door-slammed');
        updateLogoutButtonState(logoutButton, 'walking2');
        setTimeout(() => {
            logoutButton.classList.add('falling');
            updateLogoutButtonState(logoutButton, 'falling1');
            setTimeout(() => {
                showLogin();
                setTimeout(resetLogoutButtonAnimation, 250);
            }, 650);
        }, Number(logoutButtonStates.walking2['--figure-duration']));
    }, Number(logoutButtonStates.walking1['--figure-duration']));
}

logoutButton.addEventListener('mouseenter', () => {
    if ((logoutButton.dataset.state || 'default') === 'default') {
        updateLogoutButtonState(logoutButton, 'hover');
    }
});

logoutButton.addEventListener('mouseleave', () => {
    if (logoutButton.dataset.state === 'hover') {
        updateLogoutButtonState(logoutButton, 'default');
    }
});

updateLogoutButtonState(logoutButton, 'default');

registerTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openRegisterPanel();
});

loginTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openLoginPanel();
});

forgotPasswordTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openPasswordResetModal();
});

modalClose.addEventListener('click', closePasswordResetModal);

logoutButton.addEventListener('click', handleAnimatedLogout);

openLicenseModalButton.addEventListener('click', openLicenseCreateModal);
licenseModalClose.addEventListener('click', closeLicenseCreateModal);

licenseTypeChoiceInputs.forEach((input) => {
    input.addEventListener('change', () => setLicenseTypeChoice(input.value));
});

licenseModal.addEventListener('click', (e) => {
    if (e.target === licenseModal) {
        closeLicenseCreateModal();
    }
});

if (userEditModalClose) {
    userEditModalClose.addEventListener('click', closeUserEditModal);
}

if (userEditModal) {
    userEditModal.addEventListener('click', (e) => {
        if (e.target === userEditModal) {
            closeUserEditModal();
        }
    });
}

if (userEditForm) {
    userEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = userEditForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Kaydediliyor...';

        const payload = {
            userId: Number(document.querySelector('#editUserId').value),
            name: document.querySelector('#editUserName').value.trim(),
            email: document.querySelector('#editUserEmail').value.trim().toLowerCase(),
            newPassword: document.querySelector('#editUserPassword').value,
            status: document.querySelector('#editUserStatus').value,
            licenseType: document.querySelector('#editLicenseType').value,
            licenseStatus: document.querySelector('#editLicenseStatus').value,
            expiresAt: document.querySelector('#editExpiresAt').value,
            manualHwid: document.querySelector('#editManualHwid').value.trim(),
            note: document.querySelector('#editUserNote').value.trim()
        };

        const result = await updateUser(payload);
        submitButton.disabled = false;
        submitButton.textContent = 'Kullanıcıyı Kaydet';

        if (!result.ok) {
            setMessage(userEditMessage, result.message, 'error');
            showToast(result.message, 'error');
            return;
        }

        setMessage(userEditMessage, result.message, 'success');
        showToast(result.message || 'Kullanıcı güncellendi.', 'success');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
        setTimeout(closeUserEditModal, 650);
    });
}

createLicenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitButton = createLicenseForm.querySelector('button[type="submit"]');
    const type = document.querySelector('#licenseType').value;
    const assignedEmail = document.querySelector('#licenseAssignedEmail').value.trim().toLowerCase();
    const note = document.querySelector('#licenseNote')?.value.trim() || '';

    if (!LICENSE_CREATE_LABELS[type]) {
        setMessage(licenseMessage, 'Lisans tipi seçilmelidir.', 'error');
        showToast('Lisans tipi seçilmelidir.', 'error');
        return;
    }

    if (assignedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedEmail)) {
        setMessage(licenseMessage, 'Geçerli bir e-posta girin veya alanı boş bırakın.', 'error');
        showToast('Geçerli bir e-posta girin.', 'error');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Oluşturuluyor...';

    const result = await createLicense({ type, assignedEmail, note });

    submitButton.disabled = false;
    submitButton.textContent = 'Lisans Oluştur';

    if (!result.ok) {
        setMessage(licenseMessage, result.message, 'error');
        showToast(result.message, 'error');
        return;
    }

    setMessage(licenseMessage, `${result.license.code} oluşturuldu.`, 'success');
    showToast(`${result.license.code} oluşturuldu.`, 'success');
    refreshLicenseCreatePreview();
    await refreshDashboardStats();
    await refreshLicenseTable();
    await refreshExpiringTable();
    await refreshLogsTable();
});

licenseTableBody.addEventListener('click', async (e) => {
    const resetButton = e.target.closest('[data-hwid-reset]');
    const deleteButton = e.target.closest('[data-license-delete]');
    const editButton = e.target.closest('[data-license-edit]');
    const extendButton = e.target.closest('[data-license-extend]');
    const statusButton = e.target.closest('[data-license-status]');
    const assignButton = e.target.closest('[data-license-assign]');
    const mailButton = e.target.closest('[data-license-mail]');


    if (mailButton) {
        const licenseId = Number(mailButton.dataset.licenseMail);
        const assignedEmail = mailButton.dataset.assignedEmail || '';
        if (!assignedEmail) {
            showToast('Mail göndermek için lisans önce bir kullanıcıya atanmalı.', 'error');
            return;
        }
        const approved = confirm(`${assignedEmail} adresine lisans bilgisi gönderilsin mi?`);
        if (!approved) return;
        mailButton.disabled = true;
        const previousText = mailButton.innerHTML;
        mailButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor';
        const result = await sendLicenseInfoMail({ licenseId });
        showToast(result.message || (result.ok ? 'Lisans maili gönderildi.' : 'Lisans maili gönderilemedi.'), result.ok ? 'success' : 'error');
        mailButton.disabled = false;
        mailButton.innerHTML = previousText;
        await refreshLogsTable();
        return;
    }

    if (assignButton) {
        const licenseId = Number(assignButton.dataset.licenseAssign);
        const assignedEmail = prompt('Lisansı atamak/taşımak istediğiniz kullanıcı e-postasını yazın. Atamayı kaldırmak için boş bırakın:', assignButton.dataset.assignedEmail || '');
        if (assignedEmail === null) return;
        const previousAssignText = assignButton.innerHTML;
        assignButton.disabled = true;
        assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atanıyor';
        const result = await assignLicense({ licenseId, assignedEmail });
        assignButton.disabled = false;
        assignButton.innerHTML = previousAssignText;
        showToast(result.message || (result.ok ? 'Lisans ataması güncellendi.' : 'Lisans atanamadı.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
        return;
    }

    if (editButton) {
        const licenseId = Number(editButton.dataset.licenseEdit);
        const typeSelect = licenseTableBody.querySelector(`[data-license-type="${licenseId}"]`);
        const assignedEmail = prompt('Atanacak e-posta yazın. Atanmamış yapmak için boş bırakın:', editButton.dataset.assignedEmail || '');
        if (assignedEmail === null) return;
        const expiresAt = prompt('Bitiş tarihi yazın: YYYY-AA-GG. Süresiz için boş bırakın:', editButton.dataset.expiresAt || '');
        if (expiresAt === null) return;
        editButton.disabled = true;
        editButton.textContent = 'Kaydediliyor...';
        const result = await updateLicense({
            licenseId,
            type: typeSelect?.value || 'monthly_30',
            assignedEmail,
            expiresAt,
            status: editButton.dataset.status || 'active'
        });
        showToast(result.message || (result.ok ? 'Lisans düzenlendi.' : 'Lisans düzenlenemedi.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
        return;
    }

    if (extendButton) {
        const licenseId = Number(extendButton.dataset.licenseExtend);
        const typeSelect = licenseTableBody.querySelector(`[data-license-type="${licenseId}"]`);
        extendButton.disabled = true;
        extendButton.textContent = 'Uzatılıyor...';
        const result = await extendLicense({ licenseId, type: typeSelect?.value || 'monthly_30' });
        showToast(result.message || (result.ok ? 'Lisans uzatıldı.' : 'Lisans uzatılamadı.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
        return;
    }

    if (statusButton) {
        const licenseId = Number(statusButton.dataset.licenseStatus);
        const nextStatus = statusButton.dataset.nextStatus || 'passive';
        statusButton.disabled = true;
        const result = await setLicenseStatus({ licenseId, status: nextStatus });
        showToast(result.message || (result.ok ? 'Lisans durumu güncellendi.' : 'Lisans durumu güncellenemedi.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
        return;
    }

    if (deleteButton) {
        const licenseId = Number(deleteButton.dataset.licenseDelete);
        const approved = confirm('Bu lisans silinsin mi? Bağlı HWID kaydı da silinir.');
        if (!approved) return;
        deleteButton.disabled = true;
        deleteButton.textContent = 'Siliniyor...';
        const result = await deleteLicense(licenseId);
        showToast(result.message || (result.ok ? 'Lisans silindi.' : 'Lisans silinemedi.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
        return;
    }

    if (resetButton) {
        const licenseId = Number(resetButton.dataset.hwidReset);
        resetButton.disabled = true;
        resetButton.textContent = 'Sıfırlanıyor...';
        const result = await resetHwid(licenseId);
        showToast(result.message || (result.ok ? 'HWID resetlendi.' : 'HWID resetlenemedi.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshExpiringTable();
        await refreshLogsTable();
    }
});

if (userSearchInput) {
    userSearchInput.addEventListener('input', () => {
        refreshUsersTable();
    });
}

if (usersTableBody) {
    usersTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('[data-edit-user]');
        const extendButton = e.target.closest('[data-extend-user]');
        const hwidResetButton = e.target.closest('[data-user-hwid-reset]');
        const statusButton = e.target.closest('[data-user-status]');
        const deleteButton = e.target.closest('[data-delete-user]');


    if (editButton) {
            const userId = Number(editButton.dataset.editUser);
            const user = currentManagedUsers.find((item) => Number(item.id) === userId);
            if (user) {
                openUserEditModal(user);
            }
            return;
        }

        if (extendButton) {
            const userId = Number(extendButton.dataset.extendUser);
            const select = usersTableBody.querySelector(`[data-extend-type="${userId}"]`);
            extendButton.disabled = true;
            extendButton.textContent = 'Uzatılıyor...';
            const result = await extendUserLicense(userId, select?.value || 'monthly_30');
            showToast(result.message || (result.ok ? 'Lisans uzatıldı.' : 'Lisans uzatılamadı.'), result.ok ? 'success' : 'error');
            await refreshDashboardStats();
            await refreshLicenseTable();
            await refreshUsersTable();
            await refreshLogsTable();
            return;
        }

        if (hwidResetButton) {
            const licenseId = Number(hwidResetButton.dataset.userHwidReset);
            if (!licenseId) {
                showToast('Bu kullanıcıya bağlı aktif lisans bulunamadı.', 'error');
                return;
            }
            hwidResetButton.disabled = true;
            hwidResetButton.textContent = 'Sıfırlanıyor...';
            const result = await resetHwid(licenseId);
            showToast(result.message || (result.ok ? 'HWID resetlendi.' : 'HWID resetlenemedi.'), result.ok ? 'success' : 'error');
            await refreshDashboardStats();
            await refreshLicenseTable();
            await refreshUsersTable();
            await refreshExpiringTable();
            await refreshLogsTable();
            return;
        }

        if (statusButton) {
            const userId = Number(statusButton.dataset.userStatus);
            const nextStatus = statusButton.dataset.nextStatus;
            statusButton.disabled = true;
            const result = await setUserStatus(userId, nextStatus);
            showToast(result.message || (result.ok ? 'Kullanıcı durumu güncellendi.' : 'Kullanıcı durumu güncellenemedi.'), result.ok ? 'success' : 'error');
            await refreshUsersTable();
            await refreshLogsTable();
            return;
        }

        if (deleteButton) {
            const userId = Number(deleteButton.dataset.deleteUser);
            const approved = confirm('Bu kullanıcı silinsin mi? Lisansları atanmamış duruma alınır.');
            if (!approved) {
                return;
            }
            deleteButton.disabled = true;
            const result = await deleteUser(userId);
            showToast(result.message || (result.ok ? 'Kullanıcı silindi.' : 'Kullanıcı silinemedi.'), result.ok ? 'success' : 'error');
            await refreshDashboardStats();
            await refreshLicenseTable();
            await refreshUsersTable();
            await refreshLogsTable();
        }
    });
}

if (refreshLogsButton) {
    refreshLogsButton.addEventListener('click', refreshLogsTable);
}

if (refreshExpiringButton) {
    refreshExpiringButton.addEventListener('click', refreshExpiringTable);
}

if (sendExpiringMailButton) {
    sendExpiringMailButton.addEventListener('click', async () => {
        const confirmed = confirm('Süresi yaklaşan atanmış lisanslara mail gönderilsin mi?');
        if (!confirmed) return;
        sendExpiringMailButton.disabled = true;
        sendExpiringMailButton.textContent = 'Gönderiliyor...';
        const result = await sendExpiringLicenseMails();
        showToast(result.message, result.ok ? 'success' : 'error');
        await refreshLogsTable();
        sendExpiringMailButton.disabled = false;
        sendExpiringMailButton.textContent = 'Bitiş Maili Gönder';
    });
}

if (expiringTableBody) {
    expiringTableBody.addEventListener('click', async (e) => {
        const extendButton = e.target.closest('[data-expiring-extend]');
        if (!extendButton || !extendButton.dataset.expiringExtend) {
            return;
        }

        const userId = Number(extendButton.dataset.expiringExtend);
        const select = expiringTableBody.querySelector(`[data-expiring-type="${userId}"]`);
        extendButton.disabled = true;
        extendButton.textContent = 'Uzatılıyor...';
        const result = await extendUserLicense(userId, select?.value || 'monthly_30');
        showToast(result.message || (result.ok ? 'Lisans uzatıldı.' : 'Lisans uzatılamadı.'), result.ok ? 'success' : 'error');
        await refreshDashboardStats();
        await refreshLicenseTable();
        await refreshUsersTable();
        await refreshExpiringTable();
        await refreshLogsTable();
    });
}

passwordResetModal.addEventListener('click', (e) => {
    if (e.target === passwordResetModal) {
        closePasswordResetModal();
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.querySelector('#registerName').value.trim();
    const email = document.querySelector('#registerEmail').value.trim().toLowerCase();
    const password = document.querySelector('#registerPassword').value;

    const result = await registerUser({ name, email, password });

    if (!result.ok) {
        setMessage(registerMessage, result.message, 'error');
        return;
    }

    setMessage(registerMessage, result.message, 'success');

    setTimeout(() => {
        registerForm.reset();
        loginEmail.value = email;
        openLoginPanel();
    }, 900);
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;

    setLoginLoading(true);
    setMessage(loginMessage, '', '');

    const result = await loginUser({ email, password });

    setTimeout(() => {
        setLoginLoading(false);

        if (!result.ok) {
            setMessage(loginMessage, result.message, 'error');
            return;
        }

        if (rememberMe.checked) {
            localStorage.setItem(STORAGE_KEYS.rememberedEmail, email);
            localStorage.setItem(STORAGE_KEYS.rememberEnabled, 'true');
        } else {
            localStorage.removeItem(STORAGE_KEYS.rememberedEmail);
            localStorage.setItem(STORAGE_KEYS.rememberEnabled, 'false');
        }

        setMessage(loginMessage, result.message, 'success');
        showDashboard(result);
    }, 700);
});

resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.querySelector('#resetEmail').value.trim().toLowerCase();
    const newPassword = document.querySelector('#resetPassword').value;

    const result = await changePassword({ email, newPassword });

    if (!result.ok) {
        setMessage(resetMessage, result.message, 'error');
        showToast(result.message, 'error');
        return;
    }

    setMessage(resetMessage, result.message, 'success');
    showToast(result.message || 'Şifre güncellendi.', 'success');

    setTimeout(() => {
        closePasswordResetModal();
        loginEmail.value = email;
        loginPassword.value = '';
    }, 900);
});

loadRememberedLogin();

// Tema anahtarı: modern dark/light geçişi.
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.querySelector('#themeToggleButton');

    const applyTheme = (mode) => {
        const isLight = mode === 'light';
        document.body.classList.toggle('light-mode', isLight);
        localStorage.setItem('theme-mode', mode);

        if (themeToggleButton) {
            const icon = themeToggleButton.querySelector('i');
            themeToggleButton.setAttribute('aria-label', isLight ? 'Koyu temaya geç' : 'Açık temaya geç');
            if (icon) {
                icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
        }
    };

    applyTheme(localStorage.getItem('theme-mode') || 'dark');

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            const nextMode = document.body.classList.contains('light-mode') ? 'dark' : 'light';
            applyTheme(nextMode);
        });
    }
});


if (desktopAuth && desktopAuth.onUpdateStatus) {
    desktopAuth.onUpdateStatus((status) => {
        renderUpdateStatus(status);
        if (status.status === 'available' || status.status === 'downloaded' || status.status === 'error' || status.status === 'not_configured') {
            showToast(status.message, status.status === 'error' ? 'error' : 'info');
        }
    });
}

if (checkUpdateButton) {
    checkUpdateButton.addEventListener('click', async () => {
        checkUpdateButton.disabled = true;
        renderUpdateStatus({ currentVersion: currentVersionText ? currentVersionText.textContent.replace('v', '') : '', status: 'checking', message: 'Güncelleme kontrol ediliyor...' });
        const status = await checkForUpdates();
        renderUpdateStatus(status);
        showToast(status.message || 'Güncelleme kontrolü tamamlandı.', status.status === 'error' ? 'error' : 'info');
        checkUpdateButton.disabled = false;
    });
}

if (downloadUpdateButton) {
    downloadUpdateButton.addEventListener('click', async () => {
        downloadUpdateButton.disabled = true;
        const status = await downloadUpdate();
        renderUpdateStatus(status);
        downloadUpdateButton.disabled = false;
    });
}

if (installUpdateButton) {
    installUpdateButton.addEventListener('click', async () => {
        await installUpdate();
    });
}


if (refreshOnlineButton) {
    refreshOnlineButton.addEventListener('click', async () => {
        await loadOnlineUsers();
        showToast('Online liste yenilendi.', 'info');
    });
}

if (createBackupButton) {
    createBackupButton.addEventListener('click', async () => {
        createBackupButton.disabled = true;
        const result = await createBackup();
        showToast(result.message, result.ok ? 'success' : 'error');
        await loadBackups();
        createBackupButton.disabled = false;
    });
}

if (refreshBackupsButton) {
    refreshBackupsButton.addEventListener('click', async () => {
        await loadBackups();
        showToast('Yedek listesi yenilendi.', 'info');
    });
}

if (backupTableBody) {
    backupTableBody.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-restore-backup]');
        if (!button) return;
        const fileName = button.dataset.restoreBackup;
        const confirmed = confirm(`${fileName} yedeği geri yüklensin mi? Programı yeniden açmanız gerekecek.`);
        if (!confirmed) return;
        const result = await restoreBackup(fileName);
        showToast(result.message, result.ok ? 'success' : 'error');
        if (result.ok && result.settings) {
            fillSettingsForm(result.settings);
        }
    });
}

if (testSmtpButton) {
    testSmtpButton.addEventListener('click', async () => {
        testSmtpButton.disabled = true;
        testSmtpButton.textContent = 'Test ediliyor...';
        const result = await testSmtp();
        setMessage(settingsMessage, result.message, result.ok ? 'success' : 'error');
        showToast(result.message, result.ok ? 'success' : 'error');
        testSmtpButton.disabled = false;
        testSmtpButton.textContent = 'SMTP Bağlantı Testi';
    });
}

if (sendTestMailButton) {
    sendTestMailButton.addEventListener('click', async () => {
        sendTestMailButton.disabled = true;
        sendTestMailButton.textContent = 'Gönderiliyor...';
        const to = document.querySelector('#settingTestMailTo')?.value || document.querySelector('#settingSmtpFrom')?.value || '';
        const result = await sendTestMail({ to });
        setMessage(settingsMessage, result.message, result.ok ? 'success' : 'error');
        showToast(result.message, result.ok ? 'success' : 'error');
        sendTestMailButton.disabled = false;
        sendTestMailButton.textContent = 'Test Mail Gönder';
    });
}

if (selectBackupDirButton) {
    selectBackupDirButton.addEventListener('click', async () => {
        const result = await selectBackupDirectory();
        if (result.ok && result.path) {
            const input = document.querySelector('#settingBackupDir');
            if (input) input.value = result.path;
            showToast('Yedek klasörü seçildi.', 'success');
        } else if (!result.canceled) {
            showToast(result.message || 'Yedek klasörü seçilemedi.', 'error');
        }
    });
}

if (settingsForm) {
    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            appName: document.querySelector('#settingAppName')?.value || '',
            updateUrl: document.querySelector('#settingUpdateUrl')?.value || '',
            defaultLicenseType: document.querySelector('#settingDefaultLicenseType')?.value || 'trial_7',
            autoBackup: document.querySelector('#settingAutoBackup')?.value || 'true',
            backupRetention: document.querySelector('#settingBackupRetention')?.value || '10',
            backupFrequency: document.querySelector('#settingBackupFrequency')?.value || 'daily',
            backupDir: document.querySelector('#settingBackupDir')?.value || '',
            smtpHost: document.querySelector('#settingSmtpHost')?.value || '',
            smtpPort: document.querySelector('#settingSmtpPort')?.value || '',
            smtpSecure: document.querySelector('#settingSmtpSecure')?.value || 'false',
            smtpUser: document.querySelector('#settingSmtpUser')?.value || '',
            smtpPassword: document.querySelector('#settingSmtpPassword')?.value || '',
            smtpFrom: document.querySelector('#settingSmtpFrom')?.value || ''
        };
        const result = await saveSettings(payload);
        setMessage(settingsMessage, result.message, result.ok ? 'success' : 'error');
        showToast(result.message, result.ok ? 'success' : 'error');
        if (result.ok && result.settings) {
            fillSettingsForm(result.settings);
        }
    });
}

if (testSmtpButton) {
    testSmtpButton.addEventListener('click', async () => {
        testSmtpButton.disabled = true;
        testSmtpButton.textContent = 'Test ediliyor...';
        const result = await testSmtp();
        setMessage(settingsMessage, result.message, result.ok ? 'success' : 'error');
        showToast(result.message, result.ok ? 'success' : 'error');
        testSmtpButton.disabled = false;
        testSmtpButton.textContent = 'SMTP Test Et';
    });
}

loadOnlineUsers();
runAutoBackup().then((result) => {
    if (result && result.ok && !result.skipped) {
        showToast('Otomatik yedek alındı.', 'success');
    }
    return loadBackups();
});
loadSettings();

loadUpdateStatus();

// Sidebar gerçek sayfa sistemi.
function openDashboardPage(pageId) {
    activateDashboardPageSafely(pageId);
}

document.querySelectorAll('.sidebar-nav a[data-nav-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        openDashboardPage(link.dataset.navTarget);
    });
});

openDashboardPage('dashboardTop');

// Ata/Taşı butonu için bağımsız ve kalıcı event fix.
// Dinamik tablo yeniden çizilse bile çalışması için document seviyesinde capture kullanılır.
(function setupStableLicenseAssignButton() {
    if (window.__stableLicenseAssignButtonReady) return;
    window.__stableLicenseAssignButtonReady = true;

    function openAssignDialog(currentEmail) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'license-modal active';
            overlay.setAttribute('aria-hidden', 'false');
            overlay.innerHTML = `
                <div class="license-modal-card" role="dialog" aria-modal="true">
                    <button class="modal-close" type="button" data-assign-close aria-label="Kapat">×</button>
                    <h3>Lisans Ata / Taşı</h3>
                    <p>Kayıtlı kullanıcı e-postasını yazın. Atamayı kaldırmak için alanı boş bırakın.</p>
                    <div class="modal-field labeled-field">
                        <label for="stableAssignEmail">Kullanıcı e-postası</label>
                        <input id="stableAssignEmail" type="email" value="${escapeHtml(currentEmail || '')}" placeholder="ornek@domain.com">
                    </div>
                    <p class="form-message" data-assign-message></p>
                    <button class="submit-button" type="button" data-assign-save>Kaydet</button>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = overlay.querySelector('#stableAssignEmail');
            const save = overlay.querySelector('[data-assign-save]');
            const close = overlay.querySelector('[data-assign-close]');

            const cleanup = (value) => {
                overlay.remove();
                resolve(value);
            };

            close.addEventListener('click', () => cleanup(null));
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) cleanup(null);
            });
            save.addEventListener('click', () => cleanup(input.value.trim().toLowerCase()));
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') cleanup(input.value.trim().toLowerCase());
                if (event.key === 'Escape') cleanup(null);
            });
            setTimeout(() => input.focus(), 50);
        });
    }

    document.addEventListener('click', async (event) => {
        const assignButton = event.target.closest('[data-license-assign]');
        if (!assignButton) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const licenseId = Number(assignButton.dataset.licenseAssign);
        if (!licenseId) {
            showToast('Lisans ID bulunamadı.', 'error');
            return;
        }

        const assignedEmail = await openAssignDialog(assignButton.dataset.assignedEmail || '');
        if (assignedEmail === null) return;

        const previousText = assignButton.innerHTML;
        assignButton.disabled = true;
        assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atanıyor';

        try {
            const result = await assignLicense({ licenseId, assignedEmail });
            showToast(result.message || (result.ok ? 'Lisans ataması güncellendi.' : 'Lisans atanamadı.'), result.ok ? 'success' : 'error');
            await refreshDashboardStats();
            await refreshLicenseTable();
            await refreshUsersTable();
            await refreshExpiringTable();
            await refreshLogsTable();
        } catch (error) {
            showToast('Lisans atama işlemi başarısız oldu.', 'error');
        } finally {
            assignButton.disabled = false;
            assignButton.innerHTML = previousText;
        }
    }, true);
})();
