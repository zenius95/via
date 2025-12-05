/* js/ui.js */

// --- TOAST ---
let toastTimeout;
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const configs = {
        success: { title: 'Thành công', icon: '<i class="ri-checkbox-circle-fill text-xl"></i>', classes: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-50', iconBg: 'bg-emerald-500/20 text-emerald-400' },
        error: { title: 'Lỗi', icon: '<i class="ri-error-warning-fill text-xl"></i>', classes: 'bg-red-950/90 border-red-500/30 text-red-50', iconBg: 'bg-red-500/20 text-red-400' },
        info: { title: 'Thông tin', icon: '<i class="ri-information-fill text-xl"></i>', classes: 'bg-sky-950/90 border-sky-500/30 text-sky-50', iconBg: 'bg-sky-500/20 text-sky-400' }
    };
    const config = configs[type] || configs.success;
    toast.className = `fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-2xl transform translate-y-32 z-50 flex items-center gap-3 border backdrop-blur-md min-w-[300px] transition-all duration-300 ${config.classes}`;
    document.getElementById('toast-title').innerText = config.title;
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon-container').innerHTML = config.icon;
    document.getElementById('toast-icon-container').className = `p-1.5 rounded-full ${config.iconBg}`;

    clearTimeout(toastTimeout);
    requestAnimationFrame(() => toast.classList.remove('translate-y-32'));
    toastTimeout = setTimeout(() => toast.classList.add('translate-y-32'), 3000);
}

// --- CONFIRM MODAL ---
let modalConfirmCallback = null;
function showConfirmDialog(title, message, onConfirm) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = message;
    modalConfirmCallback = onConfirm;
    const m = document.getElementById('confirm-modal');
    m.classList.remove('hidden');
    requestAnimationFrame(() => { m.classList.remove('opacity-0'); m.querySelector('div.relative').classList.replace('scale-95', 'scale-100'); });
}
function closeConfirmModal() {
    const m = document.getElementById('confirm-modal');
    m.classList.add('opacity-0'); m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); modalConfirmCallback = null; }, 200);
}
document.getElementById('modal-confirm-btn').addEventListener('click', () => { if (modalConfirmCallback) modalConfirmCallback(); closeConfirmModal(); });


// --- COLUMN CONFIG MODAL & DRAG DROP ---
const colModal = document.getElementById('col-config-modal');
const colList = document.getElementById('col-config-list');
let dragSrcEl = null;

function openColumnConfig() {
    if (!gridApi) return;
    colList.innerHTML = '';
    const allCols = gridApi.getColumns();
    let displayCols = allCols.map(col => ({
        id: col.getColId(), header: col.getColDef().headerName, visible: col.isVisible(), pinned: col.isPinned()
    })).filter(c => c.header && c.id !== 'process');

    displayCols.forEach(col => {
        const div = document.createElement('div');
        div.className = "glass-sortable-item sortable-item";
        div.draggable = true;
        div.dataset.colId = col.id;
        div.innerHTML = `
            <i class="ri-draggable text-slate-500 cursor-grab active:cursor-grabbing text-lg"></i>
            <input type="checkbox" class="modal-checkbox" ${col.visible ? 'checked' : ''}>
            <span class="text-sm text-slate-300 font-medium select-none flex-1">${col.header}</span>
            ${col.pinned ? '<span class="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">PIN</span>' : ''}
        `;
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragend', handleDragEnd);
        colList.appendChild(div);
    });

    colModal.classList.remove('hidden');
    requestAnimationFrame(() => { colModal.classList.remove('opacity-0'); colModal.querySelector('.relative').classList.replace('scale-100', 'scale-100'); });
}

function closeColumnModal() {
    colModal.classList.add('opacity-0'); colModal.querySelector('.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { colModal.classList.add('hidden'); }, 200);
}

function handleDragStart(e) { dragSrcEl = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); this.classList.add('dragging'); }
function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragSrcEl !== this) { const list = dragSrcEl.parentNode; const siblings = Array.from(list.children); const s = siblings.indexOf(dragSrcEl); const t = siblings.indexOf(this); if (s < t) { this.after(dragSrcEl); } else { this.before(dragSrcEl); } } return false; }
function handleDrop(e) { if (e.stopPropagation) e.stopPropagation(); return false; }
function handleDragEnd(e) { this.classList.remove('dragging'); }


// --- CONTEXT MENU ---
const contextMenu = document.getElementById('context-menu');

function showContextMenu(event) {
    event.preventDefault();
    const selectedCount = gridApi.getSelectedRows().length;

    // Check nếu có vùng bôi đen (Range Selection)
    const ranges = gridApi ? gridApi.getCellRanges() : [];
    const hasRange = ranges && ranges.length > 0;

    // 1. Logic disable/enable cho các nút thao tác cần Selected Rows (Xuất, Xóa...)
    // Loại trừ nút select-range và submenu ra khỏi logic chung này
    contextMenu.querySelectorAll('.menu-item:not(#menu-select-range):not(.submenu .menu-item)').forEach(item => {
        if (selectedCount === 0) item.classList.add('disabled');
        else item.classList.remove('disabled');
    });

    // 2. Logic riêng cho nút "Chọn vùng bôi đen"
    const rangeBtn = document.getElementById('menu-select-range');
    if (rangeBtn) {
        if (!hasRange) rangeBtn.classList.add('disabled');
        else rangeBtn.classList.remove('disabled');
    }

    let x = event.clientX; let y = event.clientY;
    if (x + 360 > window.innerWidth) x -= 360;
    if (y + 150 > window.innerHeight) y -= 150;
    contextMenu.style.left = `${x}px`; contextMenu.style.top = `${y}px`;
    contextMenu.classList.add('active');
}

document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) contextMenu.classList.remove('active');

    // Đóng column menu khi click ra ngoài
    const colMenu = document.getElementById('column-menu');
    // FIX: Đã đổi tên class thành custom-header-action-btn
    if (colMenu && !colMenu.contains(e.target) && !e.target.closest('.custom-header-action-btn')) {
        colMenu.style.display = 'none';
    }
});

function menuAction(action) {
    contextMenu.classList.remove('active');

    // Lấy data đã chọn (cho các action export/delete)
    const selectedData = gridApi.getSelectedRows();

    if (action === 'delete') {
        if (selectedData.length === 0) return;
        showConfirmDialog("Xác nhận xóa", `Bạn có muốn xóa ${selectedData.length} tài khoản?`, () => {
            gridApi.applyTransaction({ remove: selectedData });
            showToast(`Đã xóa ${selectedData.length} tài khoản`, "success");
        });

    } else if (action === 'exportCsv') {
        if (selectedData.length === 0) return;
        gridApi.exportDataAsCsv({ fileName: 'via_data.csv' });
        showToast('Đang tải xuống CSV...', 'success');

    } else if (action === 'exportExcel') {
        if (selectedData.length === 0) return;
        gridApi.exportDataAsExcel({ fileName: 'via_data.xlsx' });
        showToast('Đã xuất Excel thành công', 'success');

    } else if (action === 'selectRange') {
        // ACTION MỚI: CHỌN VÙNG BÔI ĐEN
        const ranges = gridApi.getCellRanges();
        if (!ranges || ranges.length === 0) {
            showToast('Chưa bôi đen vùng nào đại ca ơi!', 'error');
            return;
        }

        let rowIndexes = new Set();
        ranges.forEach(range => {
            const start = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
            const end = Math.max(range.startRow.rowIndex, range.endRow.rowIndex);
            for (let i = start; i <= end; i++) {
                rowIndexes.add(i);
            }
        });

        let count = 0;
        gridApi.forEachNode((node) => {
            if (rowIndexes.has(node.rowIndex)) {
                node.setSelected(true);
                count++;
            }
        });
        showToast(`Đã tick chọn ${count} tài khoản từ vùng bôi đen`, "success");
    } else if (action === 'openBrowser') {
        if (selectedData.length === 0) {
            showToast('Vui lòng chọn 1 tài khoản', 'error');
            return;
        }
        if (selectedData.length > 5) {
            showToast('Mở từ từ thôi Bro, máy lag đấy!', 'warning');
        }

        // Duyệt qua các row đã chọn và mở tab
        selectedData.forEach(acc => {
            // Giả lập thêm dữ liệu Proxy/UA nếu trong data chưa có để test
            // acc.proxy = "http://127.0.0.1:8888"; 
            TabManager.createTab(acc);
        });
    }


}

// --- COLUMN MENU LOGIC (UPDATED) ---
let currentTargetColId = null;

function showColumnMenu(event, colId) {
    currentTargetColId = colId;
    const menu = document.getElementById('column-menu');
    if (!menu) {
        console.error("LỖI: Chưa có <div id='column-menu'> trong file HTML Bro ơi!");
        return;
    }

    // 1. UPDATE MENU TEXT DYNAMICALLY
    // Lấy trạng thái cột hiện tại
    const col = gridApi.getColumn(colId);
    if (col) {
        // -- Pin Button --
        const isPinned = col.isPinned(); // true/false or 'left'/'right'
        const pinBtn = document.getElementById('col-menu-pin');
        if (pinBtn) {
            pinBtn.innerHTML = isPinned
                ? '<i class="ri-unpin-line text-amber-400"></i> Bỏ ghim cột'
                : '<i class="ri-pushpin-2-line text-amber-400"></i> Ghim sang trái';
        }

        // -- Mask Button (Che thông tin) --
        const maskBtn = document.getElementById('col-menu-mask');
        // Check biến maskedColumns (giả sử maskedColumns là biến global bên grid.js)
        // Nếu không access được trực tiếp, ta có thể dùng window.maskedColumns hoặc check logic khác
        if (maskBtn && typeof maskedColumns !== 'undefined') {
            const isMasked = maskedColumns.has(colId);
            maskBtn.innerHTML = isMasked
                ? '<i class="ri-eye-line text-red-400"></i> Hiện thông tin'
                : '<i class="ri-eye-close-line text-red-400"></i> Che thông tin';
        }
    }

    // 2. POSITION & SHOW
    // FIX: Update class name to 'custom-header-action-btn'
    const btn = event.target.closest('.custom-header-action-btn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        menu.style.left = (rect.left - 180) + 'px'; // Căn lùi sang trái xíu
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.display = 'block';

        menu.classList.remove('active');
        requestAnimationFrame(() => menu.classList.add('active'));
    }
}

function colMenuAction(action) {
    const menu = document.getElementById('column-menu');
    if (menu) menu.style.display = 'none';

    if (!currentTargetColId || !gridApi) return;

    if (action === 'hide') {
        gridApi.setColumnsVisible([currentTargetColId], false);
        showToast('Đã ẩn cột', 'info');
    }
    else if (action === 'copy') {
        // --- LOGIC COPY TOÀN BỘ CỘT ---
        const colDef = gridApi.getColumn(currentTargetColId).getColDef();
        const field = colDef.field;

        if (!field) {
            showToast('Cột này không có dữ liệu thô để copy', 'error');
            return;
        }

        let textToCopy = "";
        let count = 0;

        gridApi.forEachNodeAfterFilter(node => {
            if (node.data && node.data[field] !== undefined && node.data[field] !== null) {
                textToCopy += node.data[field] + "\n";
                count++;
            }
        });

        if (textToCopy) {
            copyText(textToCopy);
            showToast(`Đã copy ${count} dòng vào clipboard`, 'success');
        } else {
            showToast('Không có dữ liệu để copy', 'warning');
        }
    }
    else if (action === 'pin') {
        const col = gridApi.getColumn(currentTargetColId);
        const isPinned = col.isPinned();
        gridApi.applyColumnState({
            state: [{ colId: currentTargetColId, pinned: isPinned ? null : 'left' }]
        });
        showToast(isPinned ? 'Đã bỏ ghim' : 'Đã ghim cột sang trái', 'success');
    }
    else if (action === 'mask') {
        if (typeof maskedColumns !== 'undefined') {
            if (maskedColumns.has(currentTargetColId)) {
                maskedColumns.delete(currentTargetColId);
                showToast('Đã hiện thông tin', 'info');
            } else {
                maskedColumns.add(currentTargetColId);
                showToast('Đã che thông tin', 'success');
            }
            gridApi.refreshCells({ force: true, columns: [currentTargetColId] });
        }
    }
}

// --- FILTER DROPDOWN LOGIC ---
let selectedStatuses = new Set(['LIVE', 'DIE', 'CHECKPOINT']); // Mặc định chọn tất
const statusMap = {
    'LIVE': { label: 'Hoạt động (Live)', colorClass: 'bg-live', textClass: 'text-emerald-400' },
    'DIE': { label: 'Vô hiệu (Die)', colorClass: 'bg-die', textClass: 'text-red-400' },
    'CHECKPOINT': { label: 'Checkpoint', colorClass: 'bg-checkpoint', textClass: 'text-amber-400' }
};

function toggleFilterDropdown() {
    const dropdown = document.getElementById('filter-dropdown-menu');
    const btn = document.getElementById('filter-dropdown-btn');
    const isOpen = dropdown.classList.contains('show');

    if (isOpen) {
        dropdown.classList.remove('show');
        btn.classList.remove('active');
    } else {
        renderFilterItems();
        dropdown.classList.add('show');
        btn.classList.add('active');
    }
}

document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('filter-dropdown-menu');
    const btn = document.getElementById('filter-dropdown-btn');
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('show');
        btn.classList.remove('active');
    }
});

function calculateStatusCounts() {
    const counts = { 'LIVE': 0, 'DIE': 0, 'CHECKPOINT': 0 };
    if (!gridApi) return counts;
    gridApi.forEachNode(node => {
        if (node.data && !node.data.isLoading && counts.hasOwnProperty(node.data.status)) {
            counts[node.data.status]++;
        }
    });
    return counts;
}

function updateFilterCounts() {
    const counts = calculateStatusCounts();
    const totalSelected = selectedStatuses.size;
    const badge = document.getElementById('filter-badge-count');

    if (totalSelected === 3) badge.innerText = 'All';
    else badge.innerText = totalSelected;

    const dropdown = document.getElementById('filter-dropdown-menu');
    if (dropdown.classList.contains('show')) {
        renderFilterItems();
    }
}

function renderFilterItems() {
    const container = document.getElementById('filter-list-container');
    const counts = calculateStatusCounts();
    container.innerHTML = '';

    Object.keys(statusMap).forEach(key => {
        const info = statusMap[key];
        const isChecked = selectedStatuses.has(key);
        const count = counts[key] || 0;

        const div = document.createElement('div');
        div.className = `filter-item ${isChecked ? 'active' : ''}`;
        div.onclick = (e) => toggleStatusFilter(key, e);

        div.innerHTML = `
            <div class="status-dot ${info.colorClass}"></div>
            <span class="text-slate-300 text-sm flex-1">${info.label}</span>
            <span class="text-xs font-mono font-bold badge-base badge-neutral me-3">${count}</span>
            <div class="custom-checkbox"></div>
        `;
        container.appendChild(div);
    });
}

function toggleStatusFilter(status, event) {
    event.stopPropagation();
    if (selectedStatuses.has(status)) {
        if (selectedStatuses.size > 1) selectedStatuses.delete(status);
        else showToast('Phải chọn ít nhất 1 trạng thái', 'info');
    } else {
        selectedStatuses.add(status);
    }
    renderFilterItems();
    updateFilterCounts();
    if (gridApi) gridApi.onFilterChanged();
}


// --- TAB MANAGER SYSTEM (NEW) ---
const TabManager = {
    tabs: {}, // Lưu trữ thông tin tabs: { id: { title, webview, ... } }
    activeTabId: 'dashboard',

    // Chuyển về Dashboard
    switchToDashboard: function () {
        this.activeTabId = 'dashboard';

        // UI Tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-dashboard').classList.add('active');

        // UI Views
        document.getElementById('dashboard-view').classList.remove('hidden');
        document.getElementById('webview-container').classList.add('hidden');

        // Ẩn tất cả webview
        document.querySelectorAll('webview').forEach(wv => wv.classList.add('hidden'));
    },

    // Tạo Tab mới
    createTab: function (accountData) {
        const tabId = 'tab-' + accountData.uid;

        // Nếu tab đã tồn tại -> focus vào nó
        if (this.tabs[tabId]) {
            this.switchToTab(tabId);
            return;
        }

        // 1. Tạo Button trên Titlebar
        const tabBtn = document.createElement('div');
        tabBtn.className = 'tab';
        tabBtn.id = `btn-${tabId}`;
        tabBtn.innerHTML = `
            <div class="tab-content">
                <img src="${accountData.avatar || 'https://via.placeholder.com/20'}" class="w-5 h-5 rounded-full mr-2 border border-slate-600">
                <span class="tab-title max-w-[100px] overflow-hidden text-ellipsis">${accountData.name || accountData.uid}</span>
            </div>
            <div class="tab-close-btn" onclick="event.stopPropagation(); TabManager.closeTab('${tabId}')">
                <i class="ri-close-line"></i>
            </div>
        `;
        tabBtn.onclick = () => this.switchToTab(tabId);
        document.getElementById('tabs-container').appendChild(tabBtn);

        // 2. Tạo Webview (Browser)
        const webview = document.createElement('webview');
        webview.id = `wv-${tabId}`;
        webview.className = 'w-full h-full hidden';
        webview.src = 'https://www.facebook.com'; // Mặc định vào Facebook

        // --- QUAN TRỌNG: CẤU HÌNH USERAGENT & PARTITION (SESSION) ---
        // Partition: "persist:uid" -> Giữ cookies riêng biệt cho từng UID. Tắt app bật lại vẫn còn login.
        webview.partition = `persist:${accountData.uid}`;

        // UserAgent: Fake UA nếu cần (Bro có thể lấy từ data account)
        const userAgent = accountData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        webview.setAttribute('useragent', userAgent);

        // Append vào container
        const container = document.getElementById('webview-container');
        container.appendChild(webview);

        // 3. Cấu hình Proxy (Sau khi webview được attach)
        webview.addEventListener('dom-ready', () => {
            // Logic inject JS hoặc CSS nếu thích
            // webview.insertCSS('body { background: #000 !important; }');
        });

        // Xử lý Proxy: Webview cần truy cập Session để set Proxy
        // Lưu ý: Proxy format ví dụ: "http://user:pass@ip:port" hoặc "ip:port"
        if (accountData.proxy) {
            const session = webview.getWebContents().session;
            const proxyConfig = { proxyRules: accountData.proxy }; // Cấu hình đơn giản
            session.setProxy(proxyConfig).then(() => {
                console.log(`Đã set proxy ${accountData.proxy} cho ${accountData.uid}`);
            }).catch(console.error);
        }

        // Lưu vào memory
        this.tabs[tabId] = { id: tabId, data: accountData, webview: webview };

        // Chuyển sang tab vừa tạo
        this.switchToTab(tabId);
        showToast(`Đã mở trình duyệt cho: ${accountData.name}`, 'success');
    },

    // Chuyển Tab
    switchToTab: function (tabId) {
        if (!this.tabs[tabId]) return;
        this.activeTabId = tabId;

        // UI Tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`btn-${tabId}`).classList.add('active');

        // UI Views
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('webview-container').classList.remove('hidden');

        // Ẩn tất cả webview, chỉ hiện cái cần thiết
        document.querySelectorAll('webview').forEach(wv => wv.classList.add('hidden'));
        this.tabs[tabId].webview.classList.remove('hidden');
    },

    // Đóng Tab
    closeTab: function (tabId) {
        if (!this.tabs[tabId]) return;

        // Xóa Webview DOM
        this.tabs[tabId].webview.remove();
        // Xóa Button DOM
        document.getElementById(`btn-${tabId}`).remove();

        // Xóa khỏi memory
        delete this.tabs[tabId];

        // Nếu đang ở tab đó thì về dashboard
        if (this.activeTabId === tabId) {
            this.switchToDashboard();
        }
    }
};