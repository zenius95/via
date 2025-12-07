/* js/main.js */

let gridApi;

// Check if user has preload.js?
// User code in ui.js used `window.api.send('checkKey'...)` in legacy code.
// I should check `d:\via\js\main.js` (Renderer) to see how it loads data.
// It seems user uses `window.api` which likely maps to `ipcRenderer.invoke`.
// I'll assume `window.api.send` returns a promise (invoke) or use `window.api.invoke` if available.
// In `ui.js` I used `window.api.send` which might be `send` (one-way) or `invoke` (two-way).
// In legacy `pasteData`, `await window.api.send('checkKey', ...)` implies it returns a promise.
// So `window.api.send` likely wraps `ipcRenderer.invoke`.

// Now update `js/main.js` (Renderer) to load accounts on startup.
document.addEventListener('DOMContentLoaded', () => {
    const gridDiv = document.querySelector('#myGrid');

    // Đảm bảo gridOptions đã được load từ file grid.js
    if (typeof gridOptions !== 'undefined') {
        gridApi = agGrid.createGrid(gridDiv, gridOptions);

        // Load data from DB on startup
        window.api.send('db:get-accounts').then(accounts => {
            if (accounts && accounts.length > 0) {
                gridApi.setGridOption('rowData', accounts);
                document.getElementById('total-rows').innerText = accounts.length;
                console.log(`Loaded ${accounts.length} accounts from DB`);
            } else {
                gridApi.setGridOption('rowData', []);
                console.log('No accounts in DB');
            }

            // Load Folders
            if (typeof loadFolders === 'function') {
                loadFolders();
            }
        }).catch(err => {
            console.error('Failed to load accounts from DB', err);
            gridApi.setGridOption('rowData', []);
        });

        // Initialize Context Menu
        // ...
    } else {
        console.error("Grid Options chưa được load. Kiểm tra lại thứ tự file JS.");
    }
});