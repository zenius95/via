/* js/grid.js */

const LS_KEY = 'ag_grid_column_state_v1';
const LS_PROCESS_KEY = 'via_process_col_state_v1'; // Key mới lưu trạng thái cột process

let saveTimeout;
let maskedColumns = new Set();

// --- KHỞI TẠO TRẠNG THÁI TỪ LOCAL STORAGE ---
// Mặc định: chưa thu gọn, chiều rộng lưu trữ là 220
let processState = JSON.parse(localStorage.getItem(LS_PROCESS_KEY)) || { collapsed: false, savedWidth: 220 };

function saveProcessState() {
    localStorage.setItem(LS_PROCESS_KEY, JSON.stringify(processState));
}

// --- CUSTOM HEADER COMPONENT ---
class CustomHeader {
    init(params) {
        this.params = params;
        this.colId = params.column.getColId();

        this.eGui = document.createElement('div');
        this.eGui.className = 'custom-header-container';

        // 1. Label
        const label = document.createElement('span');
        label.className = 'custom-header-label';

        // Kiểm tra trạng thái từ biến global processState
        const isCollapsed = (this.colId === 'process' && processState.collapsed);
        label.innerHTML = params.displayName;

        // 2. Sort Icon
        const sortIcon = document.createElement('span');
        sortIcon.innerHTML = '';
        if (params.enableSorting && this.colId !== 'process') {
            this.eGui.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-header-action-btn')) {
                    params.progressSort();
                }
            });
        }

        // 3. Action Button
        const actionBtn = document.createElement('div');
        actionBtn.className = 'custom-header-action-btn';

        if (this.colId === 'process') {
            const iconClass = isCollapsed ? 'ri-expand-left-line' : 'ri-contract-right-line';
            const tooltip = isCollapsed ? 'Mở rộng' : 'Thu gọn';

            actionBtn.innerHTML = `<i class="${iconClass} text-lg text-blue-400"></i>`;
            actionBtn.title = tooltip;
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                toggleProcessColumn();
            };
        }
        else {
            actionBtn.innerHTML = '<i class="ri-more-2-fill text-lg"></i>';
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                if (typeof showColumnMenu === 'function') {
                    showColumnMenu(e, this.colId);
                }
            };
        }

        label.appendChild(sortIcon);
        this.eGui.appendChild(label);
        this.eGui.appendChild(actionBtn);
    }

    getGui() { return this.eGui; }
    destroy() { }
}

// --- LOGIC TOGGLE CỘT PROCESS ---
function toggleProcessColumn() {
    const col = gridApi.getColumn('process');
    const currentWidth = col.getActualWidth();

    // Đảo trạng thái
    processState.collapsed = !processState.collapsed;

    if (processState.collapsed) {
        // [THU GỌN]
        // Lưu chiều rộng hiện tại TRƯỚC KHI thu gọn (nếu nó đang > 110px)
        if (currentWidth > 110) {
            processState.savedWidth = currentWidth;
        }

        // Set width bé & Khóa resize
        gridApi.setColumnWidths([{ key: 'process', newWidth: 130 }], true);
        col.getColDef().resizable = false;
        col.getColDef().suppressSizeToFit = true;
        col.getColDef().minWidth = 130;
        col.getColDef().maxWidth = 130;
    } else {
        // [MỞ RỘNG]
        // Lấy lại chiều rộng đã lưu (hoặc mặc định 220)
        const widthToRestore = processState.savedWidth || 300;

        gridApi.setColumnWidths([{ key: 'process', newWidth: widthToRestore }], true);
        col.getColDef().resizable = true;
        col.getColDef().minWidth = 130;
        col.getColDef().maxWidth = null; // Bỏ giới hạn
    }

    saveProcessState(); // Lưu trạng thái mới vào localStorage

    gridApi.refreshHeader();
    gridApi.refreshCells({ columns: ['process'], force: true });
}

// Hàm khôi phục các thuộc tính ColDef (resizable, min/max) khi load trang
function restoreProcessColDef() {

    const col = gridApi.getColumn('process');
    if (!col) return;

    if (processState.collapsed) {
        // Nếu đang ở trạng thái thu gọn, ép lại các thuộc tính khóa
        col.getColDef().resizable = false;
        col.getColDef().suppressSizeToFit = true;
        col.getColDef().minWidth = 130;
        col.getColDef().maxWidth = 130;
        // Đảm bảo width là 100
        gridApi.setColumnWidths([{ key: 'process', newWidth: 130 }], true);
    } else {
        // Nếu đang mở rộng
        col.getColDef().resizable = true;
        col.getColDef().minWidth = 130;
        col.getColDef().maxWidth = null;
        // Width sẽ được restoreGridState lo, hoặc user đã resize
    }
    gridApi.refreshHeader();
}


// --- RENDERERS ---
const textCellRenderer = (params) => {
    if (params.data && params.data.isLoading) return `<div class="skeleton h-3 w-32"></div>`;
    if (maskedColumns.has(params.colDef.colId)) return `<span class="masked-data">*******</span>`;
    return `<span class="${params.colDef.cellStyleClass || ''}">${params.value}</span>`;
};

const columnDefs = [
    {
        headerName: "Trạng thái", field: "status", minWidth: 120, colId: 'status',
        cellRenderer: (params) => {
            if (params.data.isLoading) return `<div class="h-full flex items-center"><div class="skeleton h-4 w-20 rounded"></div></div>`;
            if (maskedColumns.has('status')) return `<span class="masked-data">*******</span>`;

            const status = params.value;
            let badgeClass = 'badge-base '; let label = status;
            if (status === 'LIVE') { badgeClass += 'badge-success'; label = 'HOẠT ĐỘNG'; }
            else if (status === 'DIE') { badgeClass += 'badge-danger'; label = 'VÔ HIỆU'; }
            else { badgeClass += 'badge-warning'; label = 'CHECKPOINT'; }
            return `<div class="h-full flex items-center"><span class="${badgeClass}"><span class="dot-pulse"></span>${label}</span></div>`;
        },
    },
    {
        headerName: "Tài khoản", field: "uid", minWidth: 230, cellClass: 'account-row', colId: 'accountInfo',
        cellRenderer: (params) => {
            if (params.data.isLoading) return `<div class="account-cell"><div class="skeleton w-[34px] h-[34px] rounded-full mr-3 flex-shrink-0"></div><div class="flex flex-col gap-1.5 w-full"><div class="skeleton h-3 w-24"></div><div class="skeleton h-2 w-16"></div></div></div>`;
            if (maskedColumns.has('accountInfo')) return `<div class="account-cell"><span class="masked-data">*******</span></div>`;

            return `<div class="account-cell"><img src="${params.data.avatar}" class="account-avatar"><div class="account-details"><span class="account-name">${params.data.name}</span><span class="account-uid-sub">${params.data.uid}</span></div></div>`;
        },
        getQuickFilterText: (params) => { if (!params.data || params.data.isLoading) return ''; return removeVietnameseTones(params.data.name + ' ' + params.data.uid); }
    },
    { headerName: "UID", field: "uid", colId: 'uidRaw', cellRenderer: textCellRenderer },
    { headerName: "Mật khẩu", field: "password", width: 120, colId: 'password', cellRenderer: textCellRenderer },
    { headerName: "Mã 2FA", field: "twoFa", colId: 'twoFa', cellRenderer: textCellRenderer },
    { headerName: "Email", field: "email", colId: 'email', cellRenderer: textCellRenderer },
    { headerName: "Cookie", field: "cookie", colId: 'cookie', cellRenderer: textCellRenderer },
    {
        headerName: "Tiến trình", field: "processStatus", pinned: 'right', minWidth: 100, colId: 'process',
        cellRenderer: (params) => {
            if (params.data.isLoading) return `<div class="process-cell"><div class="skeleton h-4 w-20 rounded mr-2"></div></div>`;
            if (maskedColumns.has('process')) return `<span class="masked-data">*******</span>`;

            const status = params.value;
            let badgeClass = 'badge-base ';
            let iconHtml = '';

            if (status === 'RUNNING') { badgeClass += 'badge-info'; iconHtml = '<i class="ri-loader-4-line icon-spin text-xs"></i>'; }
            else if (status === 'STOPPED') { badgeClass += 'badge-neutral'; iconHtml = '<i class="ri-pause-circle-line text-xs"></i>'; }
            else { badgeClass += 'badge-success'; iconHtml = '<i class="ri-check-double-line text-xs"></i>'; }

            // RENDER DỰA TRÊN TRẠNG THÁI
            if (processState.collapsed) {
                // Thu gọn: Icon + Text ngắn, căn giữa
                return `<div class="process-cell justify-center w-full"><span class="${badgeClass} !mr-0">${iconHtml} <span class="ml-1">${status}</span></span></div>`;
            } else {
                // Mở rộng: Full option
                // Thêm margin cho icon
                if (status === 'RUNNING') iconHtml = '<i class="ri-loader-4-line icon-spin text-xs mr-1"></i>';
                else if (status === 'STOPPED') iconHtml = '<i class="ri-pause-circle-line text-xs mr-1"></i>';
                else iconHtml = '<i class="ri-check-double-line text-xs mr-1"></i>';

                return `<div class="process-cell"><span class="${badgeClass}">${iconHtml}${status}</span><span class="process-msg">${params.data.processMessage}</span></div>`;
            }
        },
        getQuickFilterText: (params) => { if (!params.data || params.data.isLoading) return ''; return removeVietnameseTones(params.value + ' ' + (params.data.processMessage || '')); }
    }
];

// --- GRID EVENTS & LOGIC ---

function updateFooterCount() {
    if (!gridApi) return;
    document.getElementById('total-rows').innerText = gridApi.getDisplayedRowCount();
    document.getElementById('selected-rows').innerText = gridApi.getSelectedRows().length;
    const ranges = gridApi.getCellRanges();
    let uniqueRows = new Set();
    if (ranges) ranges.forEach(range => { const s = Math.min(range.startRow.rowIndex, range.endRow.rowIndex); const e = Math.max(range.startRow.rowIndex, range.endRow.rowIndex); for (let i = s; i <= e; i++) uniqueRows.add(i); });
    document.getElementById('range-rows').innerText = uniqueRows.size;
}

function onGridStateChanged() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        if (gridApi) {
            const state = gridApi.getColumnState();
            localStorage.setItem(LS_KEY, JSON.stringify(state));
        }
    }, 500);
}

function restoreGridState() {
    const savedState = localStorage.getItem(LS_KEY);
    if (savedState && gridApi) {
        try {
            const parsedState = JSON.parse(savedState);
            gridApi.applyColumnState({ state: parsedState, applyOrder: true });
        } catch (e) { console.error(e); }
    }
}

function resetGridState() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_PROCESS_KEY); // Reset cả state process
    processState = { collapsed: false, savedWidth: 220 }; // Reset biến nhớ

    gridApi.resetColumnState();
    restoreProcessColDef(); // Áp dụng lại
    showToast('Đã khôi phục giao diện mặc định', 'info');
}

function resetGridStateInModal() {
    resetGridState();
    openColumnConfig();
}

function saveColumnConfig() {
    const items = Array.from(document.getElementById('col-config-list').children);
    const state = [];
    items.forEach((item) => {
        state.push({ colId: item.dataset.colId, hide: !item.querySelector('input').checked });
    });
    gridApi.applyColumnState({ state: state, applyOrder: true });
    onGridStateChanged();
    showToast('Đã cập nhật & lưu cấu hình cột', 'success');
    closeColumnModal();
}

function onQuickFilterChanged() {
    const val = document.querySelector('.search-input').value;
    if (gridApi) gridApi.setGridOption('quickFilterText', removeVietnameseTones(val));
}

// --- GRID OPTIONS ---
const gridOptions = {
    theme: "legacy", suppressContextMenu: true, enableRangeSelection: true,
    columnDefs: columnDefs, rowData: generateSkeletonData(15),
    defaultColDef: {
        resizable: true,
        sortable: true,
        filter: false,
        suppressHeaderMenuButton: true,
        headerComponent: CustomHeader,
        lockPinned: true,
        getQuickFilterText: (p) => p.value ? removeVietnameseTones(p.value.toString()) : ''
    },
    rowHeight: 56, headerHeight: 48, pagination: false, animateRows: true, tooltipShowDelay: 0,
    rowSelection: { mode: 'multiRow', enableClickSelection: false },
    onCellContextMenu: (params) => { if (params.data && !params.data.isLoading) showContextMenu(params.event); },
    onModelUpdated: () => {
        updateFooterCount();
        if (typeof updateFilterCounts === 'function') updateFilterCounts();
    },
    onSelectionChanged: updateFooterCount, onRangeSelectionChanged: updateFooterCount,

    // BẮT SỰ KIỆN RESIZE ĐỂ LƯU CHIỀU RỘNG MỚI
    onColumnResized: (params) => {
        onGridStateChanged(); // Lưu state chung

        // Nếu resize cột process KHI ĐANG MỞ RỘNG -> Lưu width mới
        if (params.column && params.column.getColId() === 'process' && params.finished) {
            if (!processState.collapsed) {
                const currentW = params.column.getActualWidth();
                // Chỉ lưu nếu chiều rộng hợp lý (tránh trường hợp đang collapse mà bị resize nhầm)
                if (currentW > 110) {
                    processState.savedWidth = currentW;
                    saveProcessState();
                }
            }
        }
    },

    onColumnMoved: onGridStateChanged, onColumnVisible: onGridStateChanged, onSortChanged: onGridStateChanged, onColumnPinned: onGridStateChanged,

    onGridReady: (params) => {
        restoreGridState();    // 1. Restore các cột chung
        restoreProcessColDef(); // 2. Restore logic riêng của cột process
    },

    // --- EXTERNAL FILTER LOGIC ---
    isExternalFilterPresent: () => {
        if (typeof selectedStatuses === 'undefined') return false;
        return selectedStatuses.size < 3;
    },
    doesExternalFilterPass: (node) => {
        if (!node.data || node.data.isLoading) return true;
        if (typeof selectedStatuses === 'undefined') return true;
        return selectedStatuses.has(node.data.status);
    }
};