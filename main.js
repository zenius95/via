const { app, BrowserWindow, ipcMain, BrowserView } = require('electron')
const path = require('path')

// Global references
let mainWindow;
let views = {}; // Map of id -> BrowserView
let activeViewId = null;

// IPC Handlers
// IPC Handlers
const database = require('./js/database');
const logger = require('./js/logger');

// Helper to create a view
function createView(id, url) {
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load URL
    if (url.startsWith('http')) {
        view.webContents.loadURL(url);
    } else {
        view.webContents.loadFile(path.join(__dirname, url));
    }

    // DevTools & Shortcuts
    view.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
            view.webContents.toggleDevTools({ mode: 'detach' });
            event.preventDefault();
        }
        if (input.control && input.key.toLowerCase() === 'r') {
            view.webContents.reload();
            event.preventDefault();
        }
    });

    views[id] = view;
    return view;
}

ipcMain.on('switch-view', (event, id) => {
    if (views[id] && mainWindow) {
        // Detach old, attach new
        mainWindow.setBrowserView(views[id]);
        activeViewId = id;

        // Update bounds for the new view
        updateViewBounds();

        // Focus
        views[id].webContents.focus();
    }
});

ipcMain.on('close-view', (event, id) => {
    // Cannot close account view this way (logic in renderer prevents it usually)
    if (id === 'account') return;

    if (views[id]) {
        if (activeViewId === id) {
            mainWindow.setBrowserView(null);
            activeViewId = null;
        }
        // Destroy (optional, but good for cleanup)
        // views[id].webContents.destroy(); 

        delete views[id];
    }
});

ipcMain.handle('open-settings-tab', async (event) => {
    if (mainWindow) {
        const id = 'settings';

        // Create if not exists
        if (!views[id]) {
            createView(id, 'templates/setting.html');
        }

        // Send to renderer to create tab UI AND switch
        mainWindow.webContents.send('create-tab', {
            title: 'Setting',
            icon: 'ri-settings-3-line',
            id: id,
            active: true // Tell renderer to activate immediately
        });
    }
});

ipcMain.handle('main:open-user-tab', async (event, { uid, name, avatar }) => {
    if (mainWindow) {
        const id = `user-${uid}`;
        if (!views[id]) {
            createView(id, 'templates/ads.html');
            // Wait for finish load to send data?
            views[id].webContents.once('did-finish-load', () => {
                if (views[id] && !views[id].webContents.isDestroyed()) {
                    views[id].webContents.send('setup-ads-view', { uid, name, avatar });
                }
            });
        }

        // If view already exists, maybe update it?
        if (views[id] && views[id].webContents) {
            views[id].webContents.send('setup-ads-view', { uid, name, avatar });
        }

        mainWindow.webContents.send('create-tab', {
            title: name,
            avatar: avatar,
            id: id,
            active: true
        });

        // Switch logic is handled by 'create-tab' in titlebar? No, titlebar sends 'switch-view'.
        // But we want to switch immediately.
        // Titlebar 'create-tab' handler has: if (tabData.active) activateTab(newTab) -> sends 'switch-view'.
        // So we don't strictly need to switch here IF the renderer does it.
        // However, 'switch-view' IPC handler (line 47) does the actual switching.
        // If we switch here AND renderer sends switch-view, it's double but harmless.
        // Let's rely on renderer sending 'switch-view' to keep state in sync (UI tab active class).
    }
});

// Database IPCs
ipcMain.handle('db:get-accounts', async () => await database.getAllAccounts());
ipcMain.handle('db:add-accounts', async (event, accounts) => await database.insertAccounts(accounts));
ipcMain.handle('db:update-account', async (event, account) => await database.updateAccount(account));
ipcMain.handle('db:delete-accounts', async (event, uids) => {
    const result = await database.deleteAccounts(uids);
    // Cleanup logs
    if (Array.isArray(uids)) {
        for (const uid of uids) {
            await logger.deleteLogFolder(uid);
        }
    }
    return result;
});
ipcMain.handle('db:get-folders', async () => await database.getFolders());
ipcMain.handle('db:add-folder', async (event, name, color) => await database.addFolder(name, color));
ipcMain.handle('db:delete-folder', async (event, id) => await database.deleteFolder(id));
ipcMain.handle('db:update-folder', async (event, args) => await database.updateFolder(args.id, args.newName, args.newColor, args.oldName));
ipcMain.handle('db:update-account-folder', async (event, args) => await database.updateAccountFolder(args.uids, args.folderName));

// --- SETTINGS IPC ---
ipcMain.handle('db:get-settings', async () => await database.getSettings());
ipcMain.handle('db:save-settings', async (event, settings) => await database.saveSettings(settings));

// --- PROFILE IPC ---
ipcMain.handle('db:get-profiles', async () => await database.getProfiles());
ipcMain.handle('db:get-deleted-profiles', async () => await database.getDeletedProfiles());
ipcMain.handle('db:add-profile', async (event, profile) => await database.addProfile(profile));
ipcMain.handle('db:update-profile', async (event, profile) => await database.updateProfile(profile));
ipcMain.handle('db:delete-profile', async (event, id) => await database.deleteProfile(id));
ipcMain.handle('db:restore-profile', async (event, id) => await database.restoreProfile(id));
ipcMain.handle('db:permanent-delete-profile', async (event, id) => {
    const result = await database.permanentDeleteProfile(id);
    await logger.deleteLogFolder(id);
    return result;
});

// --- LOGGER IPC ---
ipcMain.handle('log:init', async (event, { uid, fileName }) => {
    return await logger.init(uid, fileName);
});
ipcMain.handle('log:write', async (event, { uid, fileName, message }) => {
    return await logger.write(uid, fileName, message);
});
ipcMain.handle('log:get-files', async (event, { uid }) => {
    return await logger.getLogFiles(uid);
});
ipcMain.handle('log:read-file', async (event, { uid, fileName }) => {
    return await logger.readLogFile(uid, fileName);
});

// --- UTILS IPC ---
const { authenticator } = require('otplib');
ipcMain.handle('util:get-2fa', async (event, secret) => {
    try {
        if (!secret) return { error: 'Secret không hợp lệ' };
        // Clean secret
        const cleanSecret = secret.replace(/\s/g, '');
        const token = authenticator.generate(cleanSecret);
        const timeRemaining = authenticator.timeRemaining();
        return { token, timeRemaining };
    } catch (err) {
        return { error: err.message };
    }
});


// --- AUTOMATION IPC ---
const automation = require('./js/automation');
const scriptExecutor = require('./js/script_executor');

ipcMain.handle('process:run-profile', async (event, { account, config }) => {
    let browserInstance = null;
    try {
        const { browser, page } = await automation.launchBrowser(account, config);
        browserInstance = browser;

        const result = await scriptExecutor.execute(page, account, config, (message) => {
            if (event.sender) {
                event.sender.send('process:update-status', { uid: account.uid, message });
            }
        });

        if (!config.keepOpen) {
            await browser.close();
        }
        return result;

    } catch (err) {
        console.error('Process Error', err);
        if (browserInstance) {
            await browserInstance.close().catch(() => { });
        }

        const errMsg = err.message || '';
        if (errMsg.includes('Target closed') || errMsg.includes('closed') || errMsg.includes('Protocol error')) {
            return { status: 'ERROR', message: 'BrowserClosed' };
        }
        return { status: 'ERROR', message: errMsg };
    }
});

ipcMain.handle('main:get-chrome-path', async () => {
    const fs = require('fs');
    const commonPaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }
    return '';
});

ipcMain.handle('dialog:open-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe'] }, { name: 'All Files', extensions: ['*'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Bounds Helper
const TITLEBAR_HEIGHT = 48;
function updateViewBounds() {
    if (mainWindow && activeViewId && views[activeViewId]) {
        const bounds = mainWindow.getContentBounds();
        views[activeViewId].setBounds({
            x: 0,
            y: TITLEBAR_HEIGHT,
            width: bounds.width,
            height: bounds.height - TITLEBAR_HEIGHT
        });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For main window UI
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.loadFile('templates/index.html')
    mainWindow.setMenu(null)

    // Setup Account View
    const accountView = createView('account', 'templates/account.html');
    mainWindow.setBrowserView(accountView);
    activeViewId = 'account';

    mainWindow.once('ready-to-show', () => {
        updateViewBounds();
        mainWindow.show();
    })

    // Bounds logic
    mainWindow.on('resize', updateViewBounds)
    // Bounds logic & Events
    mainWindow.on('resize', updateViewBounds);

    // Shortcuts for Main Window
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key.toLowerCase() === 'r') {
            event.preventDefault()
            if (activeViewId && views[activeViewId]) {
                views[activeViewId].webContents.reload();
            } else {
                mainWindow.reload();
            }
        }
        if (input.key === 'F12') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    })

    // Window Controls
    // Maximize events: send to renderer
    mainWindow.on('maximize', () => {
        updateViewBounds();
        mainWindow.webContents.send('window-maximized');
    });
    mainWindow.on('unmaximize', () => {
        updateViewBounds();
        mainWindow.webContents.send('window-unmaximized');
    });
}

// Global Window Control IPCs
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
