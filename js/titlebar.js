const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
    // Window Controls
    document.getElementById('min-btn').addEventListener('click', () => {
        ipcRenderer.send('window-minimize')
    })

    document.getElementById('max-btn').addEventListener('click', () => {
        ipcRenderer.send('window-maximize')
    })

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('window-close')
    })

    // Listen for window state changes
    ipcRenderer.on('window-maximized', () => {
        const icon = document.querySelector('#max-btn i')
        icon.classList.remove('ri-checkbox-blank-line')
        icon.classList.add('ri-checkbox-multiple-blank-line')
    })

    ipcRenderer.on('window-unmaximized', () => {
        const icon = document.querySelector('#max-btn i')
        icon.classList.remove('ri-checkbox-multiple-blank-line')
        icon.classList.add('ri-checkbox-blank-line')
    })

    // --- Tab Management ---
    const tabsContainer = document.querySelector('.tabs-container');
    const accountTab = document.getElementById('main-account-tab');

    // Tab Scrolling
    tabsContainer.addEventListener('wheel', (evt) => {
        evt.preventDefault();
        tabsContainer.scrollLeft += evt.deltaY;
    });

    // Helper to update divider visibility
    function updateDividerState() {
        const hasTabs = tabsContainer.querySelectorAll('.tab').length > 0;
        if (accountTab) {
            accountTab.classList.toggle('has-divider', hasTabs);
        }
    }

    // Call initially
    updateDividerState();

    // Function to activate a tab
    function activateTab(tabEl) {
        // Deactivate all dynamic tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

        // If activating a dynamic tab
        if (tabEl && tabEl !== accountTab && tabEl.classList.contains('tab')) {
            tabEl.classList.add('active');

            // Switch View Logic
            const id = tabEl.dataset.id;
            if (id) ipcRenderer.send('switch-view', id);

        } else if (tabEl === accountTab) {
            // Account Tab Click
            ipcRenderer.send('switch-view', 'account');
        }
    }

    // Account Tab Click
    if (accountTab) {
        accountTab.addEventListener('click', () => {
            activateTab(accountTab);
        });
    }

    // Function to close a tab
    function closeTab(tabEl, event) {
        event.stopPropagation(); // Prevent activating the tab being closed

        const tabId = tabEl.dataset.id;

        // If tab is active, we need to activate the previous one
        if (tabEl.classList.contains('active')) {
            const prevSibling = tabEl.previousElementSibling;
            if (prevSibling && prevSibling.classList.contains('tab')) {
                activateTab(prevSibling);
            } else {
                // If no previous dynamic tab, activate Account Tab
                activateTab(accountTab);
            }
        }

        // Send close event to main process
        if (tabId) ipcRenderer.send('close-view', tabId);

        tabEl.remove();
        updateDividerState(); // Update divider
    }

    // Function to attach listeners to a tab
    function setupTab(tabEl) {
        tabEl.addEventListener('click', () => activateTab(tabEl));

        const closeBtn = tabEl.querySelector('.tab-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => closeTab(tabEl, e));
        }
    }

    // IPC Listener for creating tabs
    ipcRenderer.on('create-tab', (event, tabData) => {
        // Check if tab already exists
        if (tabData.id) {
            // Find by ID in dataset
            const existing = document.querySelector(`.tab[data-id="${tabData.id}"]`);
            if (existing) {
                activateTab(existing);
                return;
            }
        }

        const newTab = document.createElement('div');
        newTab.className = 'tab';
        // if (tabData.id) newTab.id = 'tab-' + tabData.id; // Optional
        newTab.dataset.id = tabData.id || ('tab-' + Date.now());

        let iconHtml = `<i class="${tabData.icon || 'ri-global-line'}"></i>`;
        if (tabData.avatar) {
            iconHtml = `<img src="${tabData.avatar}" class="w-4 h-4 rounded-full object-cover mr-2" />`;
        }

        newTab.innerHTML = `
            <div class="tab-content">
                ${iconHtml}
                <span class="tab-title">${tabData.title || 'New Tab'}</span>
            </div>
            <i class="ri-close-line tab-close-btn"></i>
        `;

        tabsContainer.appendChild(newTab);
        setupTab(newTab);
        updateDividerState(); // Update divider

        // Auto-activate if requested
        if (tabData.active) {
            activateTab(newTab);
        }
    });

})
