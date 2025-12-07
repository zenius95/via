const { app, BrowserWindow, ipcMain, BrowserView } = require('electron')
const path = require('path')

// Global references
let mainWindow;
let views = {}; // Map of id -> BrowserView
let activeViewId = null;

// IPC Handlers
const database = require('./js/database');

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
            createView(id, 'setting.html');
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

// Database IPCs
ipcMain.handle('db:get-accounts', async () => await database.getAllAccounts());
ipcMain.handle('db:add-accounts', async (event, accounts) => await database.insertAccounts(accounts));
ipcMain.handle('db:update-account', async (event, account) => await database.updateAccount(account));
ipcMain.handle('db:delete-accounts', async (event, uids) => await database.deleteAccounts(uids));
ipcMain.handle('db:get-folders', async () => await database.getFolders());
ipcMain.handle('db:add-folder', async (event, name, color) => await database.addFolder(name, color));
ipcMain.handle('db:delete-folder', async (event, id) => await database.deleteFolder(id));
ipcMain.handle('db:update-folder', async (event, args) => await database.updateFolder(args.id, args.newName, args.newColor, args.oldName));
ipcMain.handle('db:update-account-folder', async (event, args) => await database.updateAccountFolder(args.uids, args.folderName));

// --- SETTINGS IPC ---
ipcMain.handle('db:get-settings', async () => await database.getSettings());
ipcMain.handle('db:save-settings', async (event, settings) => await database.saveSettings(settings));

// --- AUTOMATION IPC ---
const automation = require('./js/automation');
ipcMain.handle('process:run-profile', async (event, { account, config }) => {
    return await automation.runProfile(account, config);
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

    mainWindow.loadFile('index.html')
    mainWindow.setMenu(null)

    // Setup Account View
    const accountView = createView('account', 'account.html');
    mainWindow.setBrowserView(accountView);
    activeViewId = 'account';

    mainWindow.once('ready-to-show', () => {
        updateViewBounds();
        mainWindow.show();
    })

    // Bounds logic
    mainWindow.on('resize', updateViewBounds)
    mainWindow.on('maximize', updateViewBounds)
    mainWindow.on('unmaximize', updateViewBounds)

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
    ipcMain.on('window-minimize', () => mainWindow.minimize())
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    })
    ipcMain.on('window-close', () => mainWindow.close())

    // Maximize events
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized'))
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-unmaximized'))
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
