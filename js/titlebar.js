const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
    // --- ĐIỀU KHIỂN CỬA SỔ (WINDOW CONTROLS) ---
    document.getElementById('min-btn').addEventListener('click', () => {
        ipcRenderer.send('window-minimize')
    })

    document.getElementById('max-btn').addEventListener('click', () => {
        ipcRenderer.send('window-maximize')
    })

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('window-close')
    })

    // Lắng nghe thay đổi trạng thái cửa sổ để đổi icon Maximize/Restore
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

    // --- QUẢN LÝ TABS (TAB MANAGEMENT) ---
    const tabsContainer = document.querySelector('.tabs-container');
    const accountTab = document.getElementById('main-account-tab');

    // Cuộn ngang danh sách tab bằng chuột (Scroll)
    tabsContainer.addEventListener('wheel', (evt) => {
        evt.preventDefault();
        tabsContainer.scrollLeft += evt.deltaY;
    });

    // Cập nhật hiển thị đường kẻ ngăn cách giữa Tab tĩnh và Tab động
    function updateDividerState() {
        const hasTabs = tabsContainer.querySelectorAll('.tab').length > 0;
        if (accountTab) {
            accountTab.classList.toggle('has-divider', hasTabs);
        }
    }

    // Call initially
    updateDividerState();

    /**
     * Kích hoạt một Tab
     * @param {HTMLElement} tabEl - Element của tab cần active
     */
    function activateTab(tabEl) {
        // Deactivate tất cả các tab động
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

        // Tab Động (Dynamic Tab)
        if (tabEl && tabEl !== accountTab && tabEl.classList.contains('tab')) {
            tabEl.classList.add('active');

            // Gửi IPC yêu cầu Main Process chuyển View
            const id = tabEl.dataset.id;
            if (id) ipcRenderer.send('switch-view', id);

        } else if (tabEl === accountTab) {
            // Tab Tĩnh (Account Dashboard)
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

    // IPC Listener: Tạo tab mới khi nhận yêu cầu từ Main
    ipcRenderer.on('create-tab', (event, tabData) => {
        // Kiểm tra xem tab đã tồn tại chưa
        if (tabData.id) {
            const existing = document.querySelector(`.tab[data-id="${tabData.id}"]`);
            if (existing) {
                activateTab(existing);
                return;
            }
        }

        const newTab = document.createElement('div');
        newTab.className = 'tab';
        newTab.dataset.id = tabData.id || ('tab-' + Date.now());

        newTab.innerHTML = `
            <div class="tab-content">
                <i class="${tabData.icon || 'ri-global-line'}"></i>
                <span class="tab-title">${tabData.title || 'New Tab'}</span>
            </div>
            <i class="ri-close-line tab-close-btn"></i>
        `;

        tabsContainer.appendChild(newTab);
        setupTab(newTab);
        updateDividerState();

        // Tự động active nếu đc yêu cầu
        if (tabData.active) {
            activateTab(newTab);
        }
    });

})
