const { app, BrowserWindow, ipcMain } = require('electron')
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
