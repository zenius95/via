const { app, BrowserWindow, ipcMain, BrowserView } = require('electron')
const path = require('path')

// --- KHAI BÁO BIẾN TOÀN CỤC ---
// mainWindow: Cửa sổ chính của ứng dụng
// views: Object lưu trữ các BrowserView con (như tab tài khoản, cài đặt...) theo ID
// activeViewId: ID của view đang được hiển thị
let mainWindow;
let views = {};
let activeViewId = null;

// --- XỬ LÝ IPC (Database) ---
// Import module database để xử lý các yêu cầu truy vấn từ Renderer
const database = require('./js/database');

/**
 * Hàm trợ giúp tạo mới một BrowserView (tương tự một tab trong trình duyệt)
 * @param {string} id - Định danh duy nhất cho view
 * @param {string} url - Đường dẫn URL hoặc file HTML cần load
 */
function createView(id, url) {
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Xác định cách load nội dung dựa trên URL
    // Nếu bắt đầu bằng http/https thì load URL web, ngược lại load file HTML nội bộ
    if (url.startsWith('http')) {
        view.webContents.loadURL(url);
    } else {
        view.webContents.loadFile(path.join(__dirname, url));
    }

    // Cấu hình phím tắt cho View (DevTools và Reload)
    view.webContents.on('before-input-event', (event, input) => {
        // F12: Mở công cụ lập trình (DevTools) chế độ tách rời
        if (input.key === 'F12') {
            view.webContents.toggleDevTools({ mode: 'detach' });
            event.preventDefault();
        }
        // Ctrl + R: Tải lại trang hiện tại
        if (input.control && input.key.toLowerCase() === 'r') {
            view.webContents.reload();
            event.preventDefault();
        }
    });

    views[id] = view;
    return view;
}

// Xử lý sự kiện chuyển đổi View (Tab)
ipcMain.on('switch-view', (event, id) => {
    if (views[id] && mainWindow) {
        // Gán view mới vào cửa sổ chính
        mainWindow.setBrowserView(views[id]);
        activeViewId = id;

        // Cập nhật lại kích thước view để khớp với cửa sổ
        updateViewBounds();

        // Focus vào view để nhận input ngay lập tức
        views[id].webContents.focus();
    }
});

// Xử lý sự kiện đóng một View (Tab)
ipcMain.on('close-view', (event, id) => {
    // Không cho phép đóng tab danh sách tài khoản chính
    if (id === 'account') return;

    if (views[id]) {
        // Nếu đang xem tab muốn đóng, gỡ nó khỏi cửa sổ chính trước
        if (activeViewId === id) {
            mainWindow.setBrowserView(null);
            activeViewId = null;
        }
        // Xóa tham chiếu khỏi danh sách views để bộ nhớ được giải phóng (Garbage Collection)
        delete views[id];
    }
});

// Xử lý mở tab Cài đặt (Settings)
ipcMain.handle('open-settings-tab', async (event) => {
    if (mainWindow) {
        const id = 'settings';

        // Nếu view settings chưa tồn tại thì tạo mới
        if (!views[id]) {
            createView(id, 'setting.html');
        }

        // Gửi lệnh xuống Renderer để tạo UI tab và kích hoạt nó
        mainWindow.webContents.send('create-tab', {
            title: 'Setting',
            icon: 'ri-settings-3-line',
            id: id,
            active: true // Báo cho Renderer biết cần active tab này ngay
        });
    }
});

// --- XỬ LÝ DATABASE (TÀI KHOẢN & THƯ MỤC) ---
// Các hàm này gọi trực tiếp vào module database.js để thực hiện CRUD
ipcMain.handle('db:get-accounts', async () => await database.getAllAccounts());
ipcMain.handle('db:add-accounts', async (event, accounts) => await database.insertAccounts(accounts));
ipcMain.handle('db:update-account', async (event, account) => await database.updateAccount(account));
ipcMain.handle('db:delete-accounts', async (event, uids) => await database.deleteAccounts(uids));
ipcMain.handle('db:get-folders', async () => await database.getFolders());
ipcMain.handle('db:add-folder', async (event, name, color) => await database.addFolder(name, color));
ipcMain.handle('db:delete-folder', async (event, id) => await database.deleteFolder(id));
ipcMain.handle('db:update-folder', async (event, args) => await database.updateFolder(args.id, args.newName, args.newColor, args.oldName));
ipcMain.handle('db:update-account-folder', async (event, args) => await database.updateAccountFolder(args.uids, args.folderName));

// --- XỬ LÝ DATABASE (SETTINGS & PROFILE) ---
ipcMain.handle('db:get-settings', async () => await database.getSettings());
ipcMain.handle('db:save-settings', async (event, settings) => await database.saveSettings(settings));

ipcMain.handle('db:get-profiles', async () => await database.getProfiles());
ipcMain.handle('db:add-profile', async (event, profile) => await database.addProfile(profile));
ipcMain.handle('db:update-profile', async (event, profile) => await database.updateProfile(profile));
ipcMain.handle('db:delete-profile', async (event, id) => await database.deleteProfile(id));

// --- XỬ LÝ AUTOMATION (TỰ ĐỘNG HÓA) ---
const automation = require('./js/automation');
// Kích hoạt chạy profile: Nhận account và config từ Renderer, chuyển cho module automation xử lý
ipcMain.handle('process:run-profile', async (event, { account, config }) => {
    return await automation.runProfile(account, config);
});

// Hệ thống tự động tìm kiếm đường dẫn Chrome trên máy người dùng (Windows)
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

// Hộp thoại chọn file (để người dùng chọn đường dẫn Chrome thủ công)
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

// --- QUẢN LÝ KÍCH THƯỚC VIEW ---
const TITLEBAR_HEIGHT = 48; // Chiều cao thanh tiêu đề tùy chỉnh (custom titlebar)

// Cập nhật vị trí và kích thước của View hiện tại để nằm ngay dưới thanh tiêu đề
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

// Tạo cửa sổ chính của ứng dụng
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Tắt khung viền mặc định của OS để dùng custom titlebar
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Cho phép dùng Node.js trong Main Window UI
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.loadFile('index.html')
    mainWindow.setMenu(null) // Ẩn menu mặc định

    // Khởi tạo tab "Tài khoản" (Account View) mặc định
    const accountView = createView('account', 'account.html');
    mainWindow.setBrowserView(accountView);
    activeViewId = 'account';

    mainWindow.once('ready-to-show', () => {
        updateViewBounds();
        mainWindow.show();
    })

    // Xử lý sự kiện resize cửa sổ để cập nhật lại kích thước View
    mainWindow.on('resize', updateViewBounds)
    mainWindow.on('maximize', updateViewBounds)
    mainWindow.on('unmaximize', updateViewBounds)

    // Phím tắt cho Cửa sổ chính
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // Ctrl + R: Reload View đang active hoặc cả cửa sổ
        if (input.control && input.key.toLowerCase() === 'r') {
            event.preventDefault()
            if (activeViewId && views[activeViewId]) {
                views[activeViewId].webContents.reload();
            } else {
                mainWindow.reload();
            }
        }
        // F12: Toggle DevTools cho cửa sổ chính
        if (input.key === 'F12') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    })

    // Xử lý các sự kiện điều khiển cửa sổ nhận từ Renderer (Nút thu nhỏ, phóng to, đóng)
    ipcMain.on('window-minimize', () => mainWindow.minimize())
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    })
    ipcMain.on('window-close', () => mainWindow.close())

    // Gửi sự kiện trạng thái maximize về Renderer để cập nhật icon nút
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
