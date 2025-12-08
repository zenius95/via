const { contextBridge, ipcRenderer } = require('electron');

// --- PRELOAD SCRIPT ---
// Kết nối an toàn giữa Renderer Process (Giao diện) vả Main Process (NodeJS)

const api = {
    // Hàm gửi tin nhắn/yêu cầu từ Renderer -> Main
    send: (channel, ...args) => {
        // Danh sách các kênh được phép (Whitelist) để đảm bảo bảo mật
        let validChannels = [
            // Database: Account
            'db:get-accounts', 'db:add-accounts', 'db:update-account', 'db:delete-accounts',
            'db:update-account-folder',

            // Database: Folder
            'db:get-folders', 'db:add-folder', 'db:delete-folder', 'db:update-folder',

            // Database: Settings
            'db:get-settings', 'db:save-settings',

            // Database: Profile
            'db:get-profiles', 'db:add-profile', 'db:update-profile', 'db:delete-profile',

            // System / Window Controls
            'window-minimize', 'window-maximize', 'window-close',
            'checkKey',
            'main:get-chrome-path', 'dialog:open-file',
            'open-settings-tab', 'switch-view',

            // Automation / Process
            'process:run-profile'
        ];

        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
    },
    // Hàm lắng nghe sự kiện từ Main -> Renderer
    on: (channel, func) => {
        let validChannels = ['window-maximized', 'window-unmaximized', 'create-tab'];
        if (validChannels.includes(channel)) {
            // Loại bỏ tham số 'event' để tránh lộ thông tin nội bộ electron
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
};

// Expose API ra global window
// Nếu contextIsolation bật (an toàn hơn) -> dùng contextBridge
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', api);
    } catch (error) {
        console.error(error);
    }
} else {
    // Nếu tắt contextIsolation (dễ dev nhưng kém bảo mật hơn) -> gán trực tiếp
    window.api = api;
}
