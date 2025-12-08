// setting.js - Logic for Settings Page
// Uses window.api exposed via preload.js

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Elements
const elChromePath = document.getElementById('input-chrome-path');
const elThreads = document.getElementById('input-max-threads');
const elDelay = document.getElementById('input-launch-delay');
const elTimeout = document.getElementById('input-timeout');
const elRetry = document.getElementById('input-retry-count');
const elHeadless = document.getElementById('input-headless');

// Data
let currentSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupListeners();
});

async function loadSettings() {
    try {
        const settings = await window.api.send('db:get-settings');
        currentSettings = settings || {};

        // Populate UI
        if (elChromePath) elChromePath.value = currentSettings.chromePath || '';
        if (elThreads) elThreads.value = currentSettings.maxThreads || 3;
        if (elDelay) elDelay.value = currentSettings.launchDelay || 2;
        if (elTimeout) elTimeout.value = currentSettings.timeout || 0;
        if (elRetry) elRetry.value = currentSettings.retryCount || 0;
        if (elHeadless) elHeadless.checked = currentSettings.headless === 'true';

        // Auto detect if empty
        if (!elChromePath.value) {
            const detectedPath = await window.api.send('main:get-chrome-path');
            if (detectedPath) {
                elChromePath.value = detectedPath;
                // Auto save if detected
                saveSettings();
                if (typeof showToast === 'function') showToast('Đã tự động nhận diện Chrome', 'success');
            }
        }
    } catch (err) {
        console.error('Failed to load settings', err);
        if (typeof showToast === 'function') showToast('Lỗi tải cài đặt', 'warning');
    }
}

const saveSettings = debounce(async () => {
    const newSettings = {
        chromePath: elChromePath ? elChromePath.value : '',
        maxThreads: elThreads ? elThreads.value : '3',
        launchDelay: elDelay ? elDelay.value : '2',
        timeout: elTimeout ? elTimeout.value : '0',
        retryCount: elRetry ? elRetry.value : '0',
        headless: elHeadless ? String(elHeadless.checked) : 'false'
    };

    try {
        await window.api.send('db:save-settings', newSettings);
        console.log('Settings saved');
    } catch (err) {
        console.error('Failed to save settings', err);
        if (typeof showToast === 'function') showToast('Lỗi lưu cài đặt', 'warning');
    }
}, 500);

function setupListeners() {
    const inputs = [elChromePath, elThreads, elDelay, elTimeout, elRetry];
    inputs.forEach(el => {
        if (el) el.addEventListener('input', saveSettings);
    });

    if (elHeadless) elHeadless.addEventListener('change', saveSettings);
}

// Global function for "Browse" button
window.browseChromePath = async () => {
    try {
        const path = await window.api.send('dialog:open-file');
        if (path) {
            if (elChromePath) {
                elChromePath.value = path;
                saveSettings();
                if (typeof showToast === 'function') showToast('Đã cập nhật đường dẫn Chrome', 'success');
            }
        }
    } catch (err) {
        console.error('Browse failed', err);
    }
};
