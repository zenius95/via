const { contextBridge, ipcRenderer } = require('electron');

// Since contextIsolation is false, contextBridge might not work effectively or at all in the same way.
// However, we can just assign to window if contextIsolation is false.
// But valid electron pattern usually prefers contextIsolation: true.
// Given the user config (nodeIntegration: true, contextIsolation: false), we can manually assign.

window.api = {
    send: (channel, ...args) => {
        // Allow specific channels
        let validChannels = ['db:get-accounts', 'db:add-accounts', 'db:update-account', 'db:delete-accounts', 'window-minimize', 'window-maximize', 'window-close', 'checkKey', 'db:get-folders', 'db:add-folder', 'db:delete-folder', 'db:update-account-folder'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
    },
    on: (channel, func) => {
        let validChannels = ['window-maximized', 'window-unmaximized'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
};
