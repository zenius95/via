const { app, BrowserWindow, ipcMain, BrowserView } = require('electron')
const path = require('path')

// IPC Handlers
const database = require('./js/database');

ipcMain.handle('db:get-accounts', async () => {
    return await database.getAllAccounts();
});

ipcMain.handle('db:add-accounts', async (event, accounts) => {
    return await database.insertAccounts(accounts);
});

ipcMain.handle('db:update-account', async (event, account) => {
    return await database.updateAccount(account);
});

ipcMain.handle('db:delete-accounts', async (event, uids) => {
    return await database.deleteAccounts(uids);
});

// Folder IPC
ipcMain.handle('db:get-folders', async () => {
    return await database.getFolders();
});
ipcMain.handle('db:add-folder', async (event, name, color) => {
    return await database.addFolder(name, color);
});
ipcMain.handle('db:delete-folder', async (event, id) => {
    return await database.deleteFolder(id);
});
ipcMain.handle('db:update-folder', async (event, { id, newName, newColor, oldName }) => {
    return await database.updateFolder(id, newName, newColor, oldName);
});
ipcMain.handle('db:update-account-folder', async (event, { uids, folderName }) => {
    return await database.updateAccountFolder(uids, folderName);
});

// Settings Handlers (Existing?)
// Ensure IPC handlers are registered before app ready or inside createWindow if using webContents?
// Usually defined at top level.

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Frameless window
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile('index.html')
    win.setMenu(null) // Remove default menu

    // --- BROWSER VIEW SETUP ---
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.setBrowserView(view)

    // Calculate bounds: Titlebar height is approx 40px
    const TITLEBAR_HEIGHT = 48;

    function updateViewBounds() {
        const { width, height } = win.getBounds() // Window size (including frame if any, but frameless here)
        // With frame:false, getBounds = content size roughly. 
        // We want to fill the rest of the window.
        // Electron documentation says setBounds is relative to window's client area.
        view.setBounds({ x: 0, y: TITLEBAR_HEIGHT, width: width, height: height - TITLEBAR_HEIGHT })
    }

    view.webContents.loadFile('account.html')

    // Initial bounds
    // We might need to wait for 'show' or 'ready-to-show' mainly
    win.once('ready-to-show', () => {
        updateViewBounds();
        win.show();
    })

    // Default show is false usually? No, it's true by default.
    // If we rely on default show, update bounds immediately.
    updateViewBounds();

    // Update on resize
    win.on('resize', updateViewBounds)
    win.on('maximize', updateViewBounds)
    win.on('unmaximize', updateViewBounds)

    // win.webContents.openDevTools()
    // view.webContents.openDevTools({ mode: 'detach' })

    // Handler for BrowserView shortcuts (DevTools F12, Reload Ctrl+R)
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

    // win.webContents.openDevTools()

    // Shortcuts for development (Reload, DevTools)
    win.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key.toLowerCase() === 'r') {
            event.preventDefault()
            if (input.shift) {
                win.webContents.reloadIgnoringCache()
            } else {
                win.reload()
            }
        }
        if (input.key === 'F12') {
            win.webContents.toggleDevTools()
            event.preventDefault()
        }
    })

    // IPC listeners for window controls
    ipcMain.on('window-minimize', () => win.minimize())
    ipcMain.on('window-maximize', () => {
        if (win.isMaximized()) {
            win.unmaximize()
        } else {
            win.maximize()
        }
    })
    ipcMain.on('window-close', () => win.close())

    // Emit events to renderer when window state changes
    win.on('maximize', () => {
        win.webContents.send('window-maximized')
    })
    win.on('unmaximize', () => {
        win.webContents.send('window-unmaximized')
    })
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
