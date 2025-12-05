const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const puppeteer = require('puppeteer-core')
const fs = require('fs')

// Store active browser instances: Map<tabId, { browser, page, uid }>
const browserInstances = new Map()

// Helper to find Chrome on Windows
function findChrome() {
    const commonPaths = [
        `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,
        `C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
        `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
    ]
    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p
    }
    return null
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Frameless window
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            // preload: path.join(__dirname, 'preload.js')
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
    ipcMain.on('window-close', () => {
        // Close all puppeteer browsers before quitting
        browserInstances.forEach(async (instance) => {
            try { await instance.browser.close() } catch (e) { }
        })
        win.close()
    })

    // Emit events to renderer when window state changes
    win.on('maximize', () => {
        win.webContents.send('window-maximized')
    })
    win.on('unmaximize', () => {
        win.webContents.send('window-unmaximized')
    })

    // --- PUPPETEER HANDLERS ---

    ipcMain.handle('puppeteer-start', async (event, data) => {
        const { uid, proxy, userAgent } = data
        const tabId = `tab-${uid}`

        if (browserInstances.has(tabId)) {
            return { success: true, msg: 'Browser already running' }
        }

        const executablePath = findChrome()
        if (!executablePath) {
            return { success: false, msg: 'Chrome not found' }
        }

        try {
            const args = [
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled'
            ]

            if (proxy) {
                args.push(`--proxy-server=${proxy}`)
            }
            if (userAgent) {
                args.push(`--user-agent=${userAgent}`)
            }

            const browser = await puppeteer.launch({
                executablePath,
                headless: data.headless === true ? true : false, // Default to false if not provided
                defaultViewport: null,
                args,
                ignoreDefaultArgs: ['--enable-automation']
            })

            const pages = await browser.pages()
            const page = pages.length > 0 ? pages[0] : await browser.newPage()

            // Navigate to something neutral or the target
            await page.goto('https://www.facebook.com')

            browserInstances.set(tabId, { browser, page, uid })

            // Handle browser close event (if user closes Chrome manually)
            browser.on('disconnected', () => {
                const b = browserInstances.get(tabId)
                if (b && b.browser === browser) {
                    browserInstances.delete(tabId)
                    // Optional: notify renderer that browser is closed?
                }
            })

            return { success: true, tabId }

        } catch (error) {
            console.error('Puppeteer Launch Error:', error)
            return { success: false, msg: error.message }
        }
    })

    ipcMain.handle('puppeteer-close', async (event, tabId) => {
        if (browserInstances.has(tabId)) {
            const { browser } = browserInstances.get(tabId)
            try {
                await browser.close()
            } catch (e) {
                console.error('Error closing browser:', e)
            }
            browserInstances.delete(tabId)
        }
        return { success: true }
    })

    ipcMain.handle('puppeteer-action', async (event, { tabId, action }) => {
        const instance = browserInstances.get(tabId)
        if (!instance) return { success: false, msg: 'Browser not found' }

        try {
            if (action === 'screenshot') {
                const screenshot = await instance.page.screenshot({ encoding: 'base64' })
                return { success: true, data: screenshot }
            }
            if (action === 'reload') {
                await instance.page.reload()
                return { success: true }
            }
            // Add more actions here (login, etc)

            return { success: false, msg: 'Unknown action' }
        } catch (error) {
            return { success: false, msg: error.message }
        }
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
