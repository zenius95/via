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
    // Added overflow-hidden text-ellipsis whitespace-nowrap flex-1 block
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

            const status = parseInt(params.value);
            let label = params.value;
            let badgeClass = 'badge-base ';
            let dotColor = '';
            // Map logic
            if (status === 101) { badgeClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30'; label = 'Khác'; dotColor = 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]'; }
            else if (status === 100) { badgeClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30'; label = 'Đóng'; dotColor = 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]'; }
            else if (status === 999) { badgeClass = 'bg-slate-500/20 text-slate-300 border-slate-500/30'; label = 'Hold'; dotColor = 'bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.5)]'; }
            else if (status === 1) { badgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'; label = 'Hoạt động'; dotColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'; }
            else if (status === 2) { badgeClass = 'bg-red-500/15 text-red-300 border-red-500/30'; label = 'Vô hiệu hóa'; dotColor = 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'; }
            else if (status === 3) { badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30'; label = 'Cần thanh toán'; dotColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'; }
            else if (status === 4) { badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30'; label = 'Đang kháng 3 dòng'; dotColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'; }
            else if (status === 5) { badgeClass = 'bg-red-500/15 text-red-300 border-red-500/30'; label = 'Die 3 dòng'; dotColor = 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'; }
            else if (status === 6) { badgeClass = 'bg-red-500/15 text-red-300 border-red-500/30'; label = 'Die XMDT'; dotColor = 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'; }
            else if (status === 7) { badgeClass = 'bg-red-500/15 text-red-300 border-red-500/30'; label = 'Die vĩnh viễn'; dotColor = 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'; }
            else { badgeClass = 'bg-slate-500/20 text-slate-300 border-slate-500/30'; dotColor = 'bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.5)]'; } // Default

            const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-bold uppercase tracking-wide border backdrop-blur-sm shadow-sm transition-all duration-200 whitespace-nowrap';
            return `<div class="h-full flex items-center"><span class="${baseClasses} ${badgeClass}"><span class="dot-pulse ${dotColor}"></span>${label}</span></div>`;
        },
    },
    {
        headerName: "Tài khoản", field: "name", minWidth: 230, cellClass: 'account-row', colId: 'name',
        cellRenderer: (params) => {
            if (params.data.isLoading) return `<div class="account-cell"><div class="skeleton w-[34px] h-[34px] rounded-full mr-3 flex-shrink-0"></div><div class="flex flex-col gap-1.5 w-full"><div class="skeleton h-3 w-24"></div><div class="skeleton h-2 w-16"></div></div></div>`;
            if (maskedColumns.has('name')) return `<div class="account-cell"><span class="masked-data">*******</span></div>`;

            // Avatar logic
            const avatarUrl = params.data.avatar || `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(params.data.name || 'Ad')}&size=64`;

            return `<div class="account-cell justify-between group pr-2">
                        <div class="flex items-center">
                            <img src="${avatarUrl}" class="account-avatar rounded-full w-8 h-8 mr-3 object-cover border border-white/10" onError="this.src='../assets/icons/ads_icon_placeholder.png'">
                            <div class="account-details flex flex-col justify-center">
                                <span class="account-name text-sm font-medium text-slate-200 leading-tight">${params.data.name || 'Unknown'}</span>
                                <span class="account-uid-sub text-[10px] text-slate-500 font-mono">${params.data.accountId}</span>
                            </div>
                        </div>
                    </div>`;
        },
        getQuickFilterText: (params) => { if (!params.data || params.data.isLoading) return ''; return removeVietnameseTones((params.data.name || '') + ' ' + (params.data.accountId || '')); }
    },
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
    { headerName: "Lý do khóa", field: "reason", colId: 'reason', width: 150, cellRenderer: textCellRenderer },
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

            let badgeClass = '';
            let iconHtml = '';
            const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm border transition-all duration-200 shadow-sm whitespace-nowrap';

            if (status === 'RUNNING') { badgeClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30'; iconHtml = '<i class="ri-loader-4-line icon-spin text-xs"></i>'; }
            else if (status === 'STOPPED') { badgeClass = 'bg-slate-500/20 text-slate-300 border-slate-500/30'; iconHtml = '<i class="ri-pause-circle-line text-xs"></i>'; }
            else if (status === 'READY') { badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20'; iconHtml = '<i class="ri-hourglass-line text-xs"></i>'; }
            else if (status === 'RETRY') { badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30'; iconHtml = '<i class="ri-restart-line icon-spin text-xs"></i>'; }
            else if (status === 'ERROR') { badgeClass = 'bg-red-500/30 text-red-200 border-red-500/40 text-[11px]'; iconHtml = '<i class="ri-error-warning-line text-xs"></i>'; }
            else { badgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'; iconHtml = '<i class="ri-check-double-line text-xs"></i>'; }

            // RENDER DỰA TRÊN TRẠNG THÁI
            if (processState.collapsed) {
                // Thu gọn: Icon + Text ngắn, căn giữa
                return `<div class="process-cell justify-center w-full"><span class="${baseClasses} ${badgeClass} !mr-0">${iconHtml} <span class="ml-1">${status}</span></span></div>`;
            } else {
                // Mở rộng: Full option
                // Thêm margin cho icon
                // Re-assign icon with margin for expanded view if needed, or just rely on flex gap
                // But simplified logic: use same icon, just consistent styling.

                // Container for cell with hover effect
                return `<div class="process-cell group relative flex items-center justify-between w-full h-full pr-1">
                            <div class="flex items-center overflow-hidden flex-1 min-w-0">
                                <span class="${baseClasses} ${badgeClass} flex-shrink-0">${iconHtml} <span class="ml-1">${status}</span></span>
                                <span class="process-msg truncate ml-2 text-slate-400 text-[11px]">${params.data.processMessage || ''}</span>
                            </div>
                            <button onclick="openLogViewer('${params.data.uid}')" data-tooltip="Xem nhật ký"
                                class="tooltip-left log-button opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 rounded flex-shrink-0" >
                                <i class="ri-file-list-line text-slate-300 hover:text-blue-400"></i>
                            </button>
                        </div>`;
            }
        },
        getQuickFilterText: (params) => { if (!params.data || params.data.isLoading) return ''; return removeVietnameseTones(params.value + ' ' + (params.data.processMessage || '')); }
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

// --- DATA LOADING ---
async function loadAdAccounts(uid) {
    if (!uid) return;

    try {
        const rawData = await window.api.send('db:get-ad-accounts', uid);

        if (rawData && Array.isArray(rawData)) {
            // Map DB columns to Grid fields
            const mappedData = rawData.map(item => ({
                status: item.status,
                name: item.name,
                accountId: item.ad_id,
                balance: item.balance,
                threshold: item.threshold,
                thresholdRemaining: item.remain,
                adLimit: item.account_limit,
                totalSpent: item.spend,
                currency: item.currency + '-' + item.pre_pay,
                adminCount: item.admin_number,
                ownership: item.role, // Vai trò (Admin, etc.)
                paymentMethod: item.payment,
                nextBillDate: item.next_bill_date,
                daysToBill: item.next_bill_day,
                daysToBill: item.next_bill_day,
                country: item.country,
                reason: item.reason,
                createdDate: item.created_time,
                accountType: item.type, // Loại tài khoản (Business/Cá nhân)
                bmId: item.bm_id,
                timezone: item.timezone,
                // Hidden/Extra fields
                processStatus: 'READY', // Default status for viewing
                processMessage: 'Chọn chức năng để chạy',
                uid: item.account_uid,
                // Extra data for context if needed
                users: item.users,
                cards: item.cards
            }));

            if (gridApi) {
                gridApi.setGridOption('rowData', mappedData);
                updateFooterCount();
            }
        }

    } catch (e) {
        console.error('Load Ads Error:', e);
    }
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
        minWidth: 180,
        getQuickFilterText: (p) => p.value ? removeVietnameseTones(p.value.toString()) : ''
    },
    rowHeight: 56, headerHeight: 48, pagination: false, animateRows: true, tooltipShowDelay: 0,
    rowSelection: { mode: 'multiRow', enableClickSelection: false },
    selectionColumnDef: {
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        pinned: 'left',
        lockPosition: true,
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
        headerName: '',
    },
    onCellContextMenu: (params) => { if (params.data && !params.data.isLoading && typeof showContextMenu === 'function') showContextMenu(params.event); },
    onModelUpdated: () => {
        updateFooterCount();
        if (typeof updateFilterCounts === 'function') updateFilterCounts();
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
            window.api.on('setup-ads-view', (data) => {
                if (data && data.uid) {
                    loadAdAccounts(data.uid);
                }
            });
        }
    } else {
        console.error("Grid container #myGrid not found");
    }
});
