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

// Auto Split Elements
const elAutoSplit = document.getElementById('input-auto-split');
const elSplitRows = document.getElementById('input-split-rows');
const elSplitCols = document.getElementById('input-split-cols');
const elLayoutConfig = document.getElementById('layout-config-container');

// Facebook Settings Elements
const elFbCookie = document.getElementById('input-fb-cookie');
const elFbFriends = document.getElementById('input-fb-friends');
const elFbInfo = document.getElementById('input-fb-info');
const elFbQuality = document.getElementById('input-fb-quality');

// Data
let currentSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupListeners();
});

function toggleLayoutConfig() {
    if (elAutoSplit && elLayoutConfig) {
        if (elAutoSplit.checked) {
            elLayoutConfig.style.maxHeight = '100px';
            elLayoutConfig.style.opacity = '1';
            elLayoutConfig.style.marginTop = '1rem';
        } else {
            elLayoutConfig.style.maxHeight = '0px';
            elLayoutConfig.style.opacity = '0';
            elLayoutConfig.style.marginTop = '0';
        }
    }
}

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

        // Auto Split Loading
        if (elAutoSplit) elAutoSplit.checked = currentSettings.autoSplit === 'true';
        if (elSplitRows) elSplitRows.value = currentSettings.splitRows || 2;
        if (elSplitCols) elSplitCols.value = currentSettings.splitCols || 2;

        // Facebook Settings Loading
        if (elFbCookie) elFbCookie.checked = currentSettings.fbLoginCookie === 'true';
        if (elFbFriends) elFbFriends.checked = currentSettings.fbGetFriends === 'true';
        if (elFbInfo) elFbInfo.checked = currentSettings.fbGetInfo === 'true';
        if (elFbQuality) elFbQuality.checked = currentSettings.fbGetQuality === 'true';


        toggleLayoutConfig();

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
        headless: elHeadless ? String(elHeadless.checked) : 'false',

        // Save Auto Split
        autoSplit: elAutoSplit ? String(elAutoSplit.checked) : 'false',
        splitRows: elSplitRows ? elSplitRows.value : '2',
        splitCols: elSplitCols ? elSplitCols.value : '2',

        // Save Facebook Settings
        fbLoginCookie: elFbCookie ? String(elFbCookie.checked) : 'false',
        fbGetFriends: elFbFriends ? String(elFbFriends.checked) : 'false',
        fbGetInfo: elFbInfo ? String(elFbInfo.checked) : 'false',
        fbGetQuality: elFbQuality ? String(elFbQuality.checked) : 'false'
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
    const inputs = [elChromePath, elThreads, elDelay, elTimeout, elRetry, elSplitRows, elSplitCols];
    inputs.forEach(el => {
        if (el) el.addEventListener('input', saveSettings);
    });

    const checks = [elHeadless, elFbCookie, elFbFriends, elFbInfo, elFbQuality];
    checks.forEach(el => {
        if (el) el.addEventListener('change', saveSettings);
    });

    if (elAutoSplit) {
        elAutoSplit.addEventListener('change', () => {
            toggleLayoutConfig();
            saveSettings();
        });
    }
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
