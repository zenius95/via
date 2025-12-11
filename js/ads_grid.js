/* js/ads_grid.js */

const LS_KEY = 'ag_grid_ads_column_state_v1';
const LS_PROCESS_KEY = 'ads_process_col_state_v1'; // Unique key to avoid conflict with main grid

let saveTimeout;
let maskedColumns = new Set();

// --- KHỞI TẠO TRẠNG THÁI TỪ LOCAL STORAGE ---
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

        const isCollapsed = (this.colId === 'process' && processState.collapsed);
        label.innerHTML = params.displayName;

        // 2. Sort Icon
        const sortIcon = document.createElement('span');
        sortIcon.className = 'custom-sort-icon ml-1.5 text-xs text-blue-400';
        sortIcon.innerHTML = '';

        const updateSortIcon = () => {
            const sortState = params.column.getSort();
            if (sortState === 'asc') sortIcon.innerHTML = '<i class="ri-sort-asc"></i>';
            else if (sortState === 'desc') sortIcon.innerHTML = '<i class="ri-sort-desc"></i>';
            else sortIcon.innerHTML = '';
        };

        if (params.enableSorting && this.colId !== 'process') {
            this.eGui.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-header-action-btn')) {
                    params.progressSort();
                }
            });
            updateSortIcon();
            params.column.addEventListener('sortChanged', updateSortIcon);
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
        if (currentWidth > 150) {
            processState.savedWidth = currentWidth;
        }

        // 1. Update constraints to allow shrinking
        // Set minWidth very small to ensure resize works
        col.getColDef().minWidth = 50;
        col.getColDef().maxWidth = 150;
        col.getColDef().resizable = false;
        col.getColDef().suppressSizeToFit = true;

        // 2. Resize column
        gridApi.setColumnWidths([{ key: 'process', newWidth: 150 }], true);
    } else {
        const widthToRestore = processState.savedWidth || 300;

        // 1. Reset constraints
        col.getColDef().minWidth = 150;
        col.getColDef().maxWidth = null;
        col.getColDef().resizable = true;
        col.getColDef().suppressSizeToFit = false;

        // 2. Resize column
        gridApi.setColumnWidths([{ key: 'process', newWidth: widthToRestore }], true);
    }

    saveProcessState();
    gridApi.refreshHeader();
    setTimeout(() => {
        gridApi.refreshCells({ columns: ['process'], force: true });
        gridApi.doLayout(); // Force layout update
    }, 0);
}

function restoreProcessColDef() {
    const col = gridApi.getColumn('process');
    if (!col) return;

    if (processState.collapsed) {
        col.getColDef().minWidth = 50; // Match toggle logic
        col.getColDef().maxWidth = 150;
        col.getColDef().resizable = false;
        col.getColDef().suppressSizeToFit = true;
        gridApi.setColumnWidths([{ key: 'process', newWidth: 150 }], true);
    } else {
        col.getColDef().minWidth = 150;
        col.getColDef().maxWidth = null;
        col.getColDef().resizable = true;
        col.getColDef().suppressSizeToFit = false;
    }
    gridApi.refreshHeader();
}

// --- RENDERERS ---
const textCellRenderer = (params) => {
    if (params.data && params.data.isLoading) return `<div class="h-full flex items-center"><div class="skeleton h-3 w-32"></div></div>`;
    if (maskedColumns.has(params.colDef.colId)) return `<span class="masked-data">*******</span>`;
    const val = params.value || '';
    return `<div class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${params.colDef.cellStyleClass || ''}" title="${val}">${val}</div>`;
};

// --- ADS COLUMN DEFINITIONS ---
const columnDefs = [
    {
        headerName: "Trạng thái", field: "status", colId: 'status', width: 140,
        cellRenderer: (params) => {
            if (params.data.isLoading) return `<div class="h-full flex items-center"><div class="skeleton h-4 w-20 rounded"></div></div>`;
            if (maskedColumns.has('status')) return `<span class="masked-data">*******</span>`;

            const status = params.value;
            if (!status) return '';

            let badgeClass = 'badge-base '; let label = status;
            // Map Ads Status (Active, Disabled, etc.)
            // Adjust colors based on typical Ads Manager states
            if (status === 'ACTIVE' || status === 1) { badgeClass += 'badge-success'; label = 'HOẠT ĐỘNG'; }
            else if (status === 'DISABLED' || status === 2) { badgeClass += 'badge-danger'; label = 'VÔ HIỆU'; }
            else if (status === 'UNSETTLED' || status === 3) { badgeClass += 'badge-warning'; label = 'NỢ'; }
            else if (status === 'PENDING_RISK_REVIEW' || status === 7) { badgeClass += 'badge-danger'; label = 'CHECKPOINT'; }
            else if (status === 'IN_GRACE_PERIOD' || status === 9) { badgeClass += 'badge-warning'; label = 'DƯ NỢ'; }
            else if (status === 'CLOSE' || status === 100) { badgeClass += 'badge-neutral'; label = 'ĐÓNG'; }
            else { badgeClass += 'badge-neutral'; }

            return `<div class="h-full flex items-center"><span class="${badgeClass}"><span class="dot-pulse"></span>${label}</span></div>`;
        },
    },
    { headerName: "Tài khoản", field: "name", colId: 'name', minWidth: 200, cellRenderer: textCellRenderer },
    { headerName: "ID TKQC", field: "accountId", colId: 'accountId', width: 160, cellRenderer: textCellRenderer },
    { headerName: "Số dư", field: "balance", colId: 'balance', width: 120, cellRenderer: textCellRenderer },
    { headerName: "Ngưỡng", field: "threshold", colId: 'threshold', width: 120, cellRenderer: textCellRenderer },
    { headerName: "Ngưỡng còn lại", field: "thresholdRemaining", colId: 'thresholdRemaining', width: 120, cellRenderer: textCellRenderer },
    { headerName: "Limit", field: "adLimit", colId: 'adLimit', width: 100, cellRenderer: textCellRenderer },
    { headerName: "Tổng tiêu", field: "totalSpent", colId: 'totalSpent', width: 120, cellRenderer: textCellRenderer },
    { headerName: "Tiền tệ", field: "currency", colId: 'currency', width: 80, cellRenderer: textCellRenderer },
    { headerName: "SL Admin", field: "adminCount", colId: 'adminCount', width: 90, cellRenderer: textCellRenderer },
    { headerName: "Quyền sở hữu", field: "ownership", colId: 'ownership', width: 120, cellRenderer: textCellRenderer },
    { headerName: "Thanh toán", field: "paymentMethod", colId: 'paymentMethod', width: 150, cellRenderer: textCellRenderer },
    { headerName: "Ngày lập hóa đơn", field: "nextBillDate", colId: 'nextBillDate', width: 140, cellRenderer: textCellRenderer },
    { headerName: "Số ngày đến hạn TT", field: "daysToBill", colId: 'daysToBill', width: 150, cellRenderer: textCellRenderer },
    { headerName: "Quốc gia", field: "country", colId: 'country', width: 80, cellRenderer: textCellRenderer },
    { headerName: "Ngày tạo", field: "createdDate", colId: 'createdDate', width: 120, cellRenderer: textCellRenderer },
    { headerName: "Loại", field: "accountType", colId: 'accountType', width: 100, cellRenderer: textCellRenderer },
    { headerName: "BM", field: "bmId", colId: 'bmId', width: 150, cellRenderer: textCellRenderer },
    { headerName: "Múi giờ", field: "timezone", colId: 'timezone', width: 100, cellRenderer: textCellRenderer },
    {
        headerName: "Tiến trình", field: "processStatus", pinned: 'right', minWidth: 100, colId: 'process',
        cellRenderer: (params) => {
            if (params.data.isLoading) return `<div class="process-cell"><div class="skeleton h-4 w-20 rounded mr-2"></div></div>`;
            if (maskedColumns.has('process')) return `<span class="masked-data">*******</span>`;

            const status = params.value;
            if (!status) return '';

            let badgeClass = 'badge-base ';
            let iconHtml = '';

            if (status === 'running') {
                badgeClass += 'badge-primary';
                iconHtml = '<i class="ri-loader-4-line animate-spin mr-1"></i>';
            } else if (status === 'success') {
                badgeClass += 'badge-success';
                iconHtml = '<i class="ri-check-double-line mr-1"></i>';
            } else if (status === 'error') {
                badgeClass += 'badge-danger';
                iconHtml = '<i class="ri-error-warning-line mr-1"></i>';
            } else {
                badgeClass += 'badge-neutral';
            }

            return `<div class="process-cell group relative flex items-center justify-between w-full h-full pr-1">
                        <div class="flex items-center overflow-hidden flex-1 min-w-0">
                            <span class="${badgeClass} flex-shrink-0">${iconHtml}${status}</span>
                            <span class="process-msg truncate ml-2 text-slate-400 text-[11px]">${params.data.processMessage || ''}</span>
                        </div>
                    </div>`;
        }
    }
];

// --- GRID EVENTS & LOGIC ---

function generateSkeletonData(count) { return Array(count).fill({ isLoading: true }); }

function updateFooterCount() {
    if (!gridApi) return;
    const totalEl = document.getElementById('total-rows');
    const selectedEl = document.getElementById('selected-rows');
    const rangeEl = document.getElementById('range-rows');

    if (totalEl) totalEl.innerText = gridApi.getDisplayedRowCount();
    if (selectedEl) selectedEl.innerText = gridApi.getSelectedRows().length;

    if (rangeEl) {
        const ranges = gridApi.getCellRanges();
        let uniqueRows = new Set();
        if (ranges) ranges.forEach(range => { const s = Math.min(range.startRow.rowIndex, range.endRow.rowIndex); const e = Math.max(range.startRow.rowIndex, range.endRow.rowIndex); for (let i = s; i <= e; i++) uniqueRows.add(i); });
        rangeEl.innerText = uniqueRows.size;
    }
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
    // process state might be shared, be careful or clear strictly if needed
    // localStorage.removeItem(LS_PROCESS_KEY); 
    // For now assuming we don't want to reset process state of MAIN window when resetting ADS window

    gridApi.resetColumnState();
    restoreProcessColDef();
    if (typeof showToast === 'function') showToast('Đã khôi phục giao diện mặc định', 'info');
}

function resetGridStateInModal() {
    resetGridState();
    openColumnConfig();
}

function saveColumnConfig() {
    const list = document.getElementById('col-config-list');
    if (!list) return;
    const items = Array.from(list.children);
    const state = [];
    items.forEach((item) => {
        state.push({ colId: item.dataset.colId, hide: !item.querySelector('input').checked });
    });
    gridApi.applyColumnState({ state: state, applyOrder: true });
    onGridStateChanged();
    if (typeof showToast === 'function') showToast('Đã cập nhật & lưu cấu hình cột', 'success');
    if (typeof closeColumnModal === 'function') closeColumnModal();
}

function onQuickFilterChanged() {
    const val = document.querySelector('.search-input').value;
    // Basic tone removal
    const cleanVal = val ? val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D") : '';
    if (gridApi) gridApi.setGridOption('quickFilterText', cleanVal);
}

const gridOptions = {
    theme: "legacy", suppressContextMenu: true, enableRangeSelection: true,
    columnDefs: columnDefs, rowData: generateSkeletonData(15),
    defaultColDef: {
        resizable: true,
        sortable: true,
        filter: false,
        editable: false,
        suppressHeaderMenuButton: true,
        headerComponent: CustomHeader,
        lockPinned: true,
        minWidth: 100,
        getQuickFilterText: (p) => p.value ? (p.value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) : ''
    },
    rowHeight: 48, headerHeight: 48, pagination: false, animateRows: true, tooltipShowDelay: 0,
    rowSelection: { mode: 'multiRow', enableClickSelection: false },
    onCellContextMenu: (params) => { if (params.data && !params.data.isLoading && typeof showContextMenu === 'function') showContextMenu(params.event); },
    onModelUpdated: () => {
        updateFooterCount();
        if (typeof updateFilterCounts === 'function') updateFilterCounts(); // Might be undefined in ads view if ui.js not adapted
    },
    onSelectionChanged: updateFooterCount, onRangeSelectionChanged: updateFooterCount,
    onCellValueChanged: (params) => {
        // Ads update logic here?
    },
    onColumnResized: (params) => {
        onGridStateChanged();
        if (params.column && params.column.getColId() === 'process' && params.finished) {
            if (!processState.collapsed) {
                const currentW = params.column.getActualWidth();
                if (currentW > 110) {
                    processState.savedWidth = currentW;
                    saveProcessState();
                }
            }
        }
    },
    onColumnMoved: onGridStateChanged, onColumnVisible: onGridStateChanged, onSortChanged: onGridStateChanged, onColumnPinned: onGridStateChanged,
    onGridReady: (params) => {
        restoreGridState();
        restoreProcessColDef();
    },
    isExternalFilterPresent: () => {
        // Simplified for now
        return false;
    },
    doesExternalFilterPass: (node) => {
        return true;
    }
};

// --- INITIALIZATION ---
let gridApi;

document.addEventListener('DOMContentLoaded', () => {
    const gridDiv = document.querySelector('#myGrid');
    if (gridDiv) {
        gridApi = agGrid.createGrid(gridDiv, gridOptions);

        // Handle window resize
        window.addEventListener('resize', () => {
            if (gridApi) {
                // Adjust if needed
            }
        });

        // Listen for data from Main Process (if manual load is needed later)
        if (window.api && window.api.on) {
            window.api.on('ads-data-update', (data) => {
                if (gridApi) gridApi.setGridOption('rowData', data);
            });
        }
    } else {
        console.error("Grid container #myGrid not found");
    }
});
