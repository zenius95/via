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
    toast.className = `fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-2xl transform translate-y-32 z-[20000] flex items-center gap-3 border backdrop-blur-md min-w-[300px] transition-all duration-300 ${config.classes}`;
    document.getElementById('toast-title').innerText = config.title;
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon-container').innerHTML = config.icon;
    document.getElementById('toast-icon-container').className = `p-1.5 rounded-full ${config.iconBg}`;

    clearTimeout(toastTimeout);
    requestAnimationFrame(() => toast.classList.remove('translate-y-32'));
    toastTimeout = setTimeout(() => toast.classList.add('translate-y-32'), 3000);
}

// --- IMPORT MODAL ---
// --- IMPORT LOGIC ---
let importMode = 'auto'; // 'auto' | 'custom'
let customColumns = []; // ['uid', 'password', ...]

const COL_TYPES = {
    'uid': { label: 'UID', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    'password': { label: 'Mật khẩu', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    '2fa': { label: '2FA', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    'email': { label: 'Email', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    'email_pass': { label: 'Pass Email', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    'cookie': { label: 'Cookie', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
    'token': { label: 'Token', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    'email_recover': { label: 'Email KP', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
    'ignored': { label: 'Bỏ qua', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30 italic decoration-line-through' },
};

function toggleImportMode() {
    const select = document.getElementById('import-format-select');
    const controls = document.getElementById('custom-format-controls');
    importMode = select.value;

    if (importMode === 'custom') {
        controls.classList.remove('hidden');
        renderCustomColumns();
    } else {
        controls.classList.add('hidden');
    }
}

function addCustomColumn(type = 'uid') {
    customColumns.push(type);
    renderCustomColumns();
}

function removeCustomColumn(index) {
    customColumns.splice(index, 1);
    renderCustomColumns();
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('import-textarea').value = e.target.result;
        showToast(`Đã tải nội dung từ ${file.name}`);
        // Reset input so same file can be selected again if needed
        input.value = '';
    };
    reader.onerror = function () {
        showToast('Lỗi khi đọc file', 'error');
    };
    reader.readAsText(file);
}


function updateCustomColumn(index, value) {
    customColumns[index] = value;
    renderCustomColumns(); // Optional: re-render if colors change based on value
}

function resetCustomColumns() {
    customColumns = [];
    renderCustomColumns();
}

// --- DRAG & DROP LOGIC ---
let draggedColIndex = null;
let dragPlaceholder = null;

function renderCustomColumns() {
    const container = document.getElementById('custom-columns-container');
    // Save current drag placeholder if exists (to prevent re-render killing it during drag, 
    // but actually we shouldn't re-render DURING drag. Re-render only on drop/update.
    // If this function is called, it rebuilds. So we assume it's NOT called while dragging.

    container.innerHTML = '';

    customColumns.forEach((selectedType, index) => {
        // Main Container
        const div = document.createElement('div');
        div.className = 'relative flex items-center gap-0 bg-white/5 border border-white/10 hover:border-white/30 rounded-lg pr-1 animate-fade-in-up group transition-all duration-200 cursor-grab active:cursor-grabbing';
        div.draggable = true;
        div.dataset.index = index;

        // Drag Handle
        const handle = document.createElement('div');
        handle.className = 'pl-1.5 pr-0.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing flex items-center justify-center';
        handle.innerHTML = '<i class="ri-draggable text-xs"></i>';

        // Drag Events
        div.ondragstart = (e) => {
            draggedColIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index); // Firefox needs this

            // Create Placeholder
            dragPlaceholder = div.cloneNode(true);
            dragPlaceholder.classList.add('opacity-30', 'border-dashed', 'border-white/40');
            dragPlaceholder.classList.remove('animate-fade-in-up', 'cursor-grab', 'hover:border-white/30');
            dragPlaceholder.innerHTML = ''; // Clear content or keep? Let's keep empty "shadow" box sized roughly
            dragPlaceholder.style.width = `${div.offsetWidth}px`;
            dragPlaceholder.style.height = `${div.offsetHeight}px`;

            // Allow drag image to generate first
            setTimeout(() => {
                div.classList.add('hidden'); // Hide original
                // We don't insert placeholder yet, or we insert it where div was?
                // Let's replace div with placeholder in DOM
                div.parentNode.insertBefore(dragPlaceholder, div);
            }, 0);
        };

        div.ondragend = (e) => {
            div.classList.remove('hidden');
            if (dragPlaceholder && dragPlaceholder.parentNode) {
                dragPlaceholder.parentNode.removeChild(dragPlaceholder);
            }
            dragPlaceholder = null;
            draggedColIndex = null;
            renderCustomColumns(); // Ensure clean state
        };

        // Select logic
        const wrapper = document.createElement('div');
        wrapper.className = 'relative flex items-center';

        const select = document.createElement('select');
        select.className = 'bg-transparent text-xs font-medium text-slate-200 focus:text-white focus:outline-none border-none py-2 pl-2 pr-7 appearance-none cursor-pointer transition-colors';
        select.onchange = (e) => updateCustomColumn(index, e.target.value);
        select.onmousedown = (e) => e.stopPropagation(); // Allow clicking select

        for (const [key, conf] of Object.entries(COL_TYPES)) {
            const option = document.createElement('option');
            option.value = key;
            option.text = conf.label;
            option.className = 'bg-[#1a1b1e] text-slate-300 py-1';
            if (key === selectedType) option.selected = true;
            select.appendChild(option);
        }

        // Custom Arrow
        const arrow = document.createElement('i');
        arrow.className = 'ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs';

        wrapper.appendChild(select);
        wrapper.appendChild(arrow);

        // Separator
        const sep = document.createElement('div');
        sep.className = 'w-px h-3.5 bg-white/10 mx-0.5';

        // Remove Button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer';
        removeBtn.innerHTML = '<i class="ri-close-line text-xs"></i>';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeCustomColumn(index);
        };
        removeBtn.onmousedown = (e) => e.stopPropagation();

        div.appendChild(handle); // Add handle first
        div.appendChild(wrapper);
        div.appendChild(sep);
        div.appendChild(removeBtn);

        container.appendChild(div);
    });

    // Append Add Button Logic
    const addBtn = document.createElement('button');
    addBtn.className = 'h-[38px] px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center gap-2 text-sm font-medium group animate-fade-in-up';
    addBtn.onclick = () => addCustomColumn();
    addBtn.innerHTML = `
        <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <i class="ri-add-line text-xs"></i>
        </div>
        Thêm cột
    `;
    container.appendChild(addBtn);

    // Add Container Drop Listener
    container.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (!dragPlaceholder) return;

        const target = e.target.closest('div[draggable="true"]');
        if (target && target !== dragPlaceholder) {
            // Calculate position
            const rect = target.getBoundingClientRect();
            const next = (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;

            // Move placeholder
            if (next) {
                container.insertBefore(dragPlaceholder, target.nextSibling);
            } else {
                container.insertBefore(dragPlaceholder, target);
            }
        } else if (e.target === container) {
            // Append if hovering mostly empty space at end?
            container.appendChild(dragPlaceholder);
        }
    };

    container.ondrop = (e) => {
        e.preventDefault();
        if (draggedColIndex === null) return;

        // Find new index of placeholder
        // Array.from(container.children).indexOf(dragPlaceholder) -> but original is hidden in there? 
        // Original is hidden but STILL in dom? 
        // Wait, ondragstart I inserted placeholder BEFORE div. 
        // Then I moved placeholder around. DIV is stlll hidden somewhere.

        // Let's filter children to find placeholder index among items
        const children = Array.from(container.children).filter(c => c !== document.querySelector('div[draggable="true"].hidden'));
        let newIndex = Array.from(container.children).indexOf(dragPlaceholder); // This includes the hidden original?

        // It's tricky to map DOM index back to array index if we mix hidden items.
        // Easier: Remove the hidden item from DOM calculation.
        // Let's recalculate based on placeholder position relative to other *visible* items (which represent other indices).

        // Actually, simplest is:
        const items = Array.from(container.children);
        let finalIndex = items.indexOf(dragPlaceholder);
        // If the original hidden items are still in DOM, they affect index.
        // During dragstart I DID NOT remove title, I just hid it.
        const originalItemIndex = items.indexOf(container.querySelector('.hidden'));

        // Adjust for removal
        if (originalItemIndex < finalIndex) {
            finalIndex--;
        }

        if (draggedColIndex !== finalIndex) {
            const item = customColumns.splice(draggedColIndex, 1)[0];
            customColumns.splice(finalIndex, 0, item);
        }

        renderCustomColumns();
    };
}

function openImportModal() {
    const m = document.getElementById('import-modal');
    const textarea = document.getElementById('import-textarea');
    importMode = 'auto'; // Reset to auto
    document.getElementById('import-format-select').value = 'auto';
    toggleImportMode();
    if (!m) return;
    textarea.value = '';
    m.classList.remove('hidden');
    requestAnimationFrame(() => {
        m.classList.remove('opacity-0');
        m.querySelector('div.relative').classList.replace('scale-95', 'scale-100');
        textarea.focus();
    });
}

function closeImportModal() {
    const m = document.getElementById('import-modal');
    m.classList.add('opacity-0');
    m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); document.getElementById('import-textarea').value = ''; }, 200);
}

function processImportDemo() {
    processImportData();
}

// --- DUPLICATE LOGIC VARS ---
let pendingNewRows = [];
let pendingDuplicateRows = [];

function processImportData() {
    const content = document.getElementById('import-textarea').value;
    if (!content.trim()) {
        showToast('Vui lòng nhập dữ liệu vào ô trống', 'error');
        return;
    }

    const lines = content.split(/\r\n|\r|\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    pendingNewRows = [];
    pendingDuplicateRows = [];

    const existingUids = new Set();

    // Lấy danh sách UID hiện tại để check trùng
    if (gridApi) {
        gridApi.forEachNode(node => {
            if (node.data && node.data.uid) {
                existingUids.add(String(node.data.uid));
            }
        });
    }

    lines.forEach(rawLine => {
        let row = rawLine.trim();
        if (!row) return;

        // Xử lý chuẩn hóa dòng dữ liệu
        if (row.includes('c_user') && !row.includes('|')) {
            const parts = row.split(';').filter(item => item.includes('c_user')).map(item => item.trim().replace('c_user=', ''));
            if (parts.length > 0) row = parts[0] + '||||' + row;
        }

        const cols = row.split('|');
        if (cols.length < 2) return;

        let uid = '';
        let password = '';
        let twoFa = '';
        let email = '';
        let emailPassword = '';
        let emailRecover = '';
        let cookie = '';
        let token = '';

        if (importMode === 'custom') {
            // --- CUSTOM PARSING ---
            if (customColumns.length > 0) {
                customColumns.forEach((type, index) => {
                    if (index >= cols.length) return;
                    const val = cols[index].trim();
                    if (type === 'uid') uid = val;
                    else if (type === 'password') password = val;
                    else if (type === '2fa') twoFa = val;
                    else if (type === 'email') email = val;
                    else if (type === 'email_pass') emailPassword = val;
                    else if (type === 'email_recover') emailRecover = val;
                    else if (type === 'cookie') cookie = val;
                    else if (type === 'token') token = val;
                });
            }
        } else {
            // --- HEURISTIC PARSING (AUTO) ---
            // 1. UID & Pass: Cột đầu tiên là UID, cột 2 là Pass
            uid = cols[0].trim();
            password = cols[1] ? cols[1].trim() : '';

            // Handle c_user fallback for UID
            if (isNaN(uid) || !uid) {
                const cookieIndex = cols.findIndex(c => c.includes('c_user='));
                if (cookieIndex !== -1) {
                    const match = cols[cookieIndex].match(/c_user=(\d+)/);
                    if (match) uid = match[1];
                }
            }

            // 2. TIM KIẾM EMAIL (New Logic)
            /*
             * Logic:
             * - Duyệt qua từng cột để tìm Email.
             * - Nếu là (gmail, hotmail, outlook, yahoo) -> Là EMAIL CHÍNH.
             *      -> Cột bên phải (ngay sau nó) là EMAIL PASS.
             * - Tất cả email còn lại -> EMAIL KHÔI PHỤC (nối nhau bằng | hoặc lấy cái đầu tiên?)
             *   (User update: "Tất cả các email còn lại được tính là email khôi phục")
             */

            const MAIN_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
            let foundMainEmail = false;
            let recoveryEmails = [];

            // Scan all columns for emails
            for (let i = 0; i < cols.length; i++) {
                const col = cols[i].trim();
                const emailMatch = col.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);

                if (emailMatch) {
                    const currentEmail = emailMatch[0];
                    const domain = currentEmail.split('@')[1].toLowerCase();

                    // Check if it is a main email candidate
                    if (!foundMainEmail && MAIN_DOMAINS.includes(domain)) {
                        email = currentEmail;
                        foundMainEmail = true;

                        // Check password next to it
                        if (cols[i + 1]) {
                            // Simple heuristic: if next col is NOT another email (or maybe it IS the password even if it looks weird)
                            // User requirement: "bên phải Email chính sau dấu | sẽ luôn là Email Password"
                            // So we take it blindly.
                            emailPassword = cols[i + 1].trim();
                            // Skip next iteration? No, loop continues, but we should be careful not to treat emailPassword as email if it happens to be one (unlikely for pass)
                            // Actually if emailPassword is an email, it would be caught by regex in next loop.
                            // But since we consumed it as pass, we probably shouldn't treat it as recovery email?
                            // Let's increment i to skip scanning emailPassword as an email candidate?
                            // User said "Start with Main, Right is Pass". If Pass is also an email (weird), it's a pass.
                            i++;
                        }
                    } else {
                        // It's a recovery email (or main email found already)
                        recoveryEmails.push(currentEmail);
                    }
                }
            }

            // Join recovery emails if multiple? Let's just take the first one or join them?
            // DB has single text field. Let's join by | if multiple.
            emailRecover = recoveryEmails.join(' | ');

            // 3. OTHER FIELDS
            const twofaIndex = cols.findIndex(c => c.replace(/\s/g, '').length === 32 && !c.includes('@'));
            if (twofaIndex !== -1) twoFa = cols[twofaIndex].trim();

            const tokenIndex = cols.findIndex(c => c.startsWith('EAA'));
            if (tokenIndex !== -1) token = cols[tokenIndex].trim();

            const cookieIndex = cols.findIndex(c => c.includes('c_user='));
            if (cookieIndex !== -1) cookie = cols[cookieIndex].trim();
        }

        const newData = {
            isLoading: false,
            status: 'UNCHECKED',
            name: `New Via ${uid.substr(-4)}`,
            avatar: `https://ui-avatars.com/api/?name=${uid.substr(-4)}&background=random&color=fff&size=64&bold=true`,
            uid: uid,
            password: password,
            twoFa: twoFa,
            email: email,
            emailPassword: emailPassword,
            emailRecover: emailRecover,
            cookie: cookie,
            token: token,
            processStatus: 'READY',
            processMessage: 'Chọn chức năng để chạy'
        };

        // --- SEPARATE NEW VS DUPLICATE ---
        if (existingUids.has(uid)) {
            pendingDuplicateRows.push({ data: newData, raw: row });
        } else {
            pendingNewRows.push(newData);
            existingUids.add(uid); // Add to set to prevent double add in same batch
        }
    });

    // --- CHECK RESULTS ---
    if (pendingDuplicateRows.length > 0) {
        if (document.getElementById('duplicate-modal')) showDuplicateModal();
    } else {
        // No duplicates, verify and add
        finishImport(pendingNewRows, 0);
    }
}

function showDuplicateModal() {
    const m = document.getElementById('duplicate-modal');
    const textarea = document.getElementById('duplicate-textarea');

    // Close Import Modal first
    const importModal = document.getElementById('import-modal');
    if (importModal && !importModal.classList.contains('hidden')) {
        importModal.classList.add('opacity-0');
        setTimeout(() => { importModal.classList.add('hidden'); }, 200);
    }

    // Fill text area
    textarea.value = pendingDuplicateRows.map(item => item.raw).join('\n');

    m.classList.remove('hidden');
    requestAnimationFrame(() => {
        m.classList.remove('opacity-0');
        m.querySelector('div.relative').classList.replace('scale-95', 'scale-100');
    });
}

function closeDuplicateModal() {
    // Trường hợp "Bỏ tài khoản trùng" -> Chỉ add newRows
    finishImport(pendingNewRows, pendingDuplicateRows.length);

    const m = document.getElementById('duplicate-modal');
    m.classList.add('opacity-0');
    m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); }, 200);
}

function confirmDuplicateImport() {
    // Trường hợp "Vẫn thêm" -> Add cả newRows và duplicateRows
    const duplicates = pendingDuplicateRows.map(item => item.data);
    const finalRows = [...pendingNewRows, ...duplicates];
    finishImport(finalRows, 0, true);

    // Close modal manually since finishImport expects different params
    const m = document.getElementById('duplicate-modal');
    m.classList.add('opacity-0');
    m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); }, 200);
}

function finishImport(rowsToAdd, skippedCount, isMerge = false) {
    if (rowsToAdd.length > 0 && gridApi) {
        gridApi.applyTransaction({ add: rowsToAdd });

        // Save to Database
        // Only save to DB if these are genuinely new rows (not duplicates being merged)
        // The `isMerge` flag indicates if duplicates were included in `rowsToAdd`.
        // If `isMerge` is false, it means `rowsToAdd` are all new accounts.
        // If `isMerge` is true, `rowsToAdd` contains both new and duplicate accounts.
        // In this case, we only want to save the `pendingNewRows` to the DB.
        const rowsToSaveToDb = isMerge ? pendingNewRows : rowsToAdd;

        if (rowsToSaveToDb.length > 0) {
            window.api.send('db:add-accounts', rowsToSaveToDb).then(() => {
                console.log('Saved new accounts to DB');
            }).catch(err => console.error('Failed to save accounts', err));
        }
    }

    let msg = `Đã thêm ${rowsToAdd.length} tài khoản.`;
    if (skippedCount > 0) msg += ` Bỏ qua ${skippedCount} trùng lặp.`;
    if (isMerge) msg += ` (Bao gồm dữ liệu trùng)`;

    showToast(msg, rowsToAdd.length > 0 ? 'success' : 'warning');
    closeImportModal();
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
const confirmBtn = document.getElementById('modal-confirm-btn');
if (confirmBtn) {
    confirmBtn.addEventListener('click', () => { if (modalConfirmCallback) modalConfirmCallback(); closeConfirmModal(); });
}


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
    if (contextMenu && !contextMenu.contains(e.target)) contextMenu.classList.remove('active');

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
            // 1. Remove from Grid
            gridApi.applyTransaction({ remove: selectedData });

            // 2. Remove from Database
            const uidsToDelete = selectedData.map(row => row.uid);
            window.api.send('db:delete-accounts', uidsToDelete).then(res => {
                console.log('Deleted from DB:', res);
            }).catch(err => {
                console.error('Delete failed:', err);
                showToast('Lỗi khi xóa trong DB', 'error');
            });

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
    } else if (action === 'openCopyAccountModal') {
        const selectedData = gridApi.getSelectedRows();
        if (selectedData.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 tài khoản', 'warning');
            return;
        }
        openCopyAccountModal(selectedData);
    } else if (action === 'openAdsTabs') {
        const selectedData = gridApi.getSelectedRows();
        if (selectedData.length === 0) {
            showToast('Chưa chọn tài khoản nào', 'warning');
            return;
        }

        // Limit warning if too many?
        if (selectedData.length > 20) {
            showConfirmDialog('Xác nhận mở nhiều tab', `Bạn đang mở ${selectedData.length} tab cùng lúc. Điều này có thể làm chậm máy.\nTiếp tục?`, () => {
                selectedData.forEach(row => {
                    if (typeof openUserTab === 'function') openUserTab(row.uid, row.name, row.avatar);
                });
                showToast(`Đang mở ${selectedData.length} tab...`, 'success');
            });
        } else {
            selectedData.forEach(row => {
                if (typeof openUserTab === 'function') openUserTab(row.uid, row.name, row.avatar);
            });
            showToast(`Đang mở ${selectedData.length} tab...`, 'success');
        }
    }
}

// --- COLUMN MENU LOGIC (UPDATED) ---
let currentTargetColId = null;

function showColumnMenu(event, colId) {
    const menu = document.getElementById('column-menu');
    if (!menu) {
        console.error("LỖI: Chưa có <div id='column-menu'> trong file HTML Bro ơi!");
        return;
    }

    // CHECK IF ALREADY OPENED FOR THIS COLUMN
    if (menu.style.display === 'block' && currentTargetColId === colId && menu.classList.contains('active')) {
        menu.classList.remove('active');
        menu.style.display = 'none';
        currentTargetColId = null;
        return;
    }

    currentTargetColId = colId;

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

        // Reset animation
        menu.classList.remove('active');
        // Force reflow
        void menu.offsetWidth;
        menu.classList.add('active');
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
        const colDef = gridApi.getColumn(currentTargetColId).getColDef();
        const field = colDef.field;

        if (!field) {
            showToast('Cột này không có dữ liệu thô để copy', 'error');
            return;
        }

        let textToCopy = "";
        let count = 0;

        // Lấy dữ liệu của tất cả row sau khi filter
        gridApi.forEachNodeAfterFilter(node => {
            if (node.data && node.data[field] !== undefined && node.data[field] !== null) {
                textToCopy += node.data[field] + "\n";
                count++;
            }
        });

        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast(`Đã copy ${count} dòng vào clipboard`, 'success');
            }).catch(() => {
                showToast('Lỗi khi copy vào clipboard', 'error');
            });
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
// --- FILTER DROPDOWN LOGIC ---
let selectedStatuses = new Set(['LIVE', 'Checkpoint 282', 'Checkpoint 956', 'UNCHECKED']); // Mặc định chọn tất
const statusMap = {
    'LIVE': { label: 'Hoạt động (Live)', colorClass: 'bg-live', textClass: 'text-emerald-400' },
    'Checkpoint 282': { label: 'Checkpoint 282', colorClass: 'bg-die', textClass: 'text-red-400' },
    'Checkpoint 956': { label: 'Checkpoint 956', colorClass: 'bg-die', textClass: 'text-red-400' },
    'UNCHECKED': { label: 'Chưa check', colorClass: 'bg-slate-500', textClass: 'text-slate-400' }
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

    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('show');
        btn.classList.remove('active');
    }
});

function calculateStatusCounts() {
    const counts = { 'LIVE': 0, 'Checkpoint 282': 0, 'Checkpoint 956': 0, 'UNCHECKED': 0 };
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

    // Logic fix: 4 status types
    if (totalSelected === Object.keys(statusMap).length) badge.innerText = 'All';
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

    // Action Buttons Row
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex items-center gap-2 mb-2 pb-2 border-b border-white/10';
    actionsDiv.innerHTML = `
        <button onclick="setAllFilters(true, event)" class="flex-1 text-xs py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
            Chọn tất cả
        </button>
        <button onclick="setAllFilters(false, event)" class="flex-1 text-xs py-1.5 rounded bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors">
            Bỏ chọn
        </button>
    `;
    container.appendChild(actionsDiv);

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

function setAllFilters(enable, event) {
    if (event) event.stopPropagation();
    if (enable) {
        Object.keys(statusMap).forEach(key => selectedStatuses.add(key));
    } else {
        selectedStatuses.clear();
        // Giữ lại ít nhất 1 cái? User request nut "Bỏ chọn tất cả", thường sẽ clear hết -> grid trống.
        // Tuy nhiên grid filter logic có thể cần check rỗng.
        // Ở đây mình cứ clear hết, grid filter nên handle empty. 
        // Nhưng nếu logic cũ chặn "Phải chọn ít nhất 1" thì mình nên cân nhắc.
        // User muốn "Bỏ chọn tất cả", cho phép clear hết.
    }
    renderFilterItems();
    updateFilterCounts();
    if (gridApi) gridApi.onFilterChanged();
}

function toggleStatusFilter(status, event) {
    event.stopPropagation();
    if (selectedStatuses.has(status)) {
        selectedStatuses.delete(status); // Cho phép bỏ chọn hết để đúng ý button "Bỏ chọn"
    } else {
        selectedStatuses.add(status);
    }
    renderFilterItems();
    updateFilterCounts();
    if (gridApi) gridApi.onFilterChanged();
}

// --- FOLDER LOGIC ---
let folders = [];
let currentFolderFilter = null; // null = all

// Global Click for Dropdowns
document.addEventListener('click', (e) => {
    // Close Folder Dropdown
    const folderBtn = document.getElementById('folder-dropdown-btn');
    const folderMenu = document.getElementById('folder-dropdown-menu');
    if (folderBtn && folderMenu && !folderBtn.contains(e.target) && !folderMenu.contains(e.target)) {
        folderMenu.classList.remove('show');
    }

    // Close Column Config if clicked outside (optional, usually handled by modal overlay but good to have)
    // Actually modal uses overlay, so no need.

    // Close Filter Dropdown (if implemented similarly) - Assuming 'toggleFilterDropdown' logic
    // We don't have the button ID for filter handy in snippets, but let's assume standard behavior involves a button.
    // If user asked generally, I'll stick to the Folder one first or general class approach if possible.
    // Better: Helper to close all .glass-dropdown-menu if click is outside.

    // Generic Dropdown Closer
    document.querySelectorAll('.glass-dropdown-menu.show').forEach(menu => {
        // Find the button that toggles this menu. Usually specific logic.
        // For now, handle folder menu specifically as requested.

        // Also checks if context menu is open and clicked outside
        const ctxMenu = document.getElementById('context-menu');
        if (ctxMenu && ctxMenu.classList.contains('active') && !ctxMenu.contains(e.target)) {
            ctxMenu.classList.remove('active');
        }
    });
});

function selectFolderColor(btn, color) {
    // Update UI
    const container = document.getElementById('folder-color-selector');
    container.querySelectorAll('button').forEach(b => {
        b.classList.remove('ring-2', 'ring-offset-1', 'ring-offset-[#0f172a]', 'ring-white/50');
    });
    btn.classList.add('ring-2', 'ring-offset-1', 'ring-offset-[#0f172a]', 'ring-white/50');

    // Set Value
    document.getElementById('selected-folder-color').value = color;
}

const FOLDER_COLORS = {
    slate: 'text-slate-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
};
window.FOLDER_COLORS = FOLDER_COLORS; // Expose to global for Grid

async function loadFolders() {
    try {
        folders = await window.api.send('db:get-folders');
        window.folders = folders; // Expose to global
        renderFolderDropdown();
        renderFolderCtxMenu();
        if (typeof gridApi !== 'undefined') {
            gridApi.refreshCells({ columns: ['folder'], force: true });
        }
    } catch (err) {
        showToast('Lỗi tải danh sách thư mục', 'error');
        console.error(err);
    }
}

function toggleFolderDropdown() {
    const menu = document.getElementById('folder-dropdown-menu');
    // Toggle
    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
    } else {
        // Close others
        document.querySelectorAll('.glass-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        menu.classList.add('show');
    }
}

async function createNewFolder() {
    const input = document.getElementById('new-folder-input');
    const name = input.value.trim();
    const colorInput = document.getElementById('selected-folder-color');
    const color = colorInput ? colorInput.value : 'slate';

    if (!name) return;

    if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
        showToast('Tên thư mục đã tồn tại', 'error');
        return;
    }

    try {
        await window.api.send('db:add-folder', name, color);
        showToast('Đã tạo thư mục mới');
        input.value = '';
        await loadFolders();
    } catch (err) {
        showToast('Lỗi tạo thư mục', 'error');
        console.error(err);
    }
}

function deleteFolder(id, e) {
    if (e) e.stopPropagation();
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    showConfirmDialog(
        'Xóa thư mục?',
        `Bạn có chắc muốn xóa thư mục "${folder.name}"? Các tài khoản trong thư mục sẽ không bị xóa.`,
        async () => {
            try {
                await window.api.send('db:delete-folder', id);
                showToast('Đã xóa thư mục');

                // If we are currently sorting by this folder, reset filter
                if (currentFolderFilter === folder.name) {
                    filterByFolder(null);
                }

                await loadFolders();
            } catch (err) {
                showToast('Lỗi xóa thư mục', 'error');
                console.error(err);
            }
        }
    );
}

function renderFolderDropdown() {
    const container = document.getElementById('folder-list-container');
    container.innerHTML = '';

    // "All Folders" option
    const allDiv = document.createElement('div');
    allDiv.className = `menu-item ${currentFolderFilter === null ? 'bg-blue-500/20 text-blue-300' : ''}`;
    allDiv.innerHTML = `
        <i class="ri-folders-fill ${currentFolderFilter === null ? 'text-blue-400' : 'text-slate-500'} mr-2"></i>
        <span class="flex-1">Tất cả thư mục</span>
    `;
    allDiv.onclick = () => filterByFolder(null);
    container.appendChild(allDiv);

    folders.forEach(folder => {
        const div = document.createElement('div');
        const isActive = currentFolderFilter === folder.name;
        div.className = `menu-item group ${isActive ? 'bg-amber-500/20 text-amber-300' : ''}`;

        const colorClass = FOLDER_COLORS[folder.color] || 'text-slate-500';
        div.innerHTML = `
            <i class="ri-folder-fill ${isActive ? 'text-white' : colorClass} mr-2"></i>
            <span class="flex-1 truncate ${isActive ? 'font-bold text-white' : ''}">${folder.name}</span>
            <button onclick="openEditFolderModal(${folder.id}, event)" class="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-400 transition-opacity mr-1">
                <i class="ri-edit-2-line text-xs"></i>
            </button>
            <button onclick="deleteFolder(${folder.id}, event)" class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity">
                <i class="ri-delete-bin-line text-xs"></i>
            </button>
        `;
        div.onclick = () => filterByFolder(folder.name);
        container.appendChild(div);
    });
}

function openEditFolderModal(id, e) {
    if (e) e.stopPropagation();
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    document.getElementById('edit-folder-id').value = folder.id;
    document.getElementById('edit-folder-old-name').value = folder.name;
    document.getElementById('edit-folder-name').value = folder.name;

    // Set color
    const color = folder.color || 'slate';
    document.getElementById('edit-folder-color-value').value = color;

    // Update UI highlights
    const container = document.getElementById('edit-folder-color-selector');
    container.querySelectorAll('button').forEach(b => {
        if (b.dataset.color === color) {
            b.classList.add('ring-2', 'ring-offset-1', 'ring-offset-[#0f172a]', 'ring-white/50');
        } else {
            b.classList.remove('ring-2', 'ring-offset-1', 'ring-offset-[#0f172a]', 'ring-white/50');
        }
    });

    const m = document.getElementById('edit-folder-modal');
    m.classList.remove('hidden');
    requestAnimationFrame(() => {
        m.classList.remove('opacity-0');
        m.querySelector('div.relative').classList.replace('scale-95', 'scale-100');
    });

    // Close dropdown
    const menu = document.getElementById('folder-dropdown-menu');
    if (menu) menu.classList.remove('show');
}

function closeEditFolderModal() {
    const m = document.getElementById('edit-folder-modal');
    m.classList.add('opacity-0');
    m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); }, 300);
}

function selectEditFolderColor(btn, color) {
    const container = document.getElementById('edit-folder-color-selector');
    container.querySelectorAll('button').forEach(b => {
        b.classList.remove('ring-2', 'ring-offset-1', 'ring-offset-[#0f172a]', 'ring-white/50');
    });
    btn.classList.add('ring-2', 'ring-offset-1', 'ring-offset-[#0f172a]', 'ring-white/50');
    document.getElementById('edit-folder-color-value').value = color;
}

async function saveEditFolder() {
    const id = parseInt(document.getElementById('edit-folder-id').value);
    const oldName = document.getElementById('edit-folder-old-name').value;
    const newName = document.getElementById('edit-folder-name').value.trim();
    const newColor = document.getElementById('edit-folder-color-value').value;

    if (!newName) {
        showToast('Tên thư mục không được để trống', 'error');
        return;
    }

    if (newName !== oldName && folders.some(f => f.name.toLowerCase() === newName.toLowerCase())) {
        showToast('Tên thư mục đã tồn tại', 'error');
        return;
    }

    try {
        await window.api.send('db:update-folder', { id, newName, newColor, oldName });
        showToast('Đã cập nhật thư mục');
        closeEditFolderModal();

        // If filtering by this folder, update filter name if changed
        if (currentFolderFilter === oldName) {
            currentFolderFilter = newName;
            // Update badge text right away? 
            // filterByFolder logic updates it, but we might want just re-rendering to handle it.
        }

        await loadFolders(); // Reload folders and refresh grid items

        // If name changed, we need to ensure grid rows (which store 'folder' string) are updated.
        // loadFolders calls grid refresh, but local grid data 'folder' property is still oldName!
        if (newName !== oldName && gridApi) {
            gridApi.forEachNode(node => {
                if (node.data.folder === oldName) {
                    node.setDataValue('folder', newName); // This triggers refresh too
                }
            });
        }

    } catch (err) {
        showToast('Lỗi cập nhật thư mục', 'error');
        console.error(err);
    }
}

function renderFolderCtxMenu() {
    const container = document.getElementById('ctx-menu-folders');
    container.innerHTML = '';

    if (folders.length === 0) {
        container.innerHTML = `<div class="menu-item italic text-slate-500 text-xs">Chưa có thư mục</div>`;
        return;
    }

    folders.forEach(folder => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        const colorClass = FOLDER_COLORS[folder.color] || 'text-slate-400';
        div.innerHTML = `<i class="ri-folder-fill ${colorClass}"></i> ${folder.name}`;
        div.onclick = () => assignToFolder(folder.name);
        container.appendChild(div);
    });
}

function filterByFolder(folderName) {
    currentFolderFilter = folderName;

    // Update Badge
    const badge = document.getElementById('folder-badge-count');
    badge.textContent = folderName || 'All';
    badge.className = folderName
        ? 'bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded ml-1 border border-amber-500/20'
        : 'bg-slate-500/20 text-slate-300 text-[10px] px-1.5 py-0.5 rounded ml-1 border border-slate-500/20';

    // Apply Filter to Grid
    if (gridApi) {
        gridApi.onFilterChanged();
    }

    renderFolderDropdown();
    const menu = document.getElementById('folder-dropdown-menu');
    if (menu) menu.classList.remove('show');
}

async function assignToFolder(folderName) {
    const selectedNodes = gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) return;

    const uids = selectedNodes.map(node => node.data.uid);
    try {
        await window.api.send('db:update-account-folder', { uids, folderName });
        showToast(`Đã chuyển ${uids.length} tài khoản sang "${folderName}"`);

        // Update local data in grid
        selectedNodes.forEach(node => {
            node.setDataValue('folder', folderName);
        });

        const ctxMenu = document.getElementById('context-menu');
        if (ctxMenu) ctxMenu.classList.remove('active');
    } catch (err) {
        showToast('Lỗi gán thư mục', 'error');
        console.error(err);
    }
}

// --- GLOBAL KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = [
            { id: 'confirm-modal', close: closeConfirmModal },
            { id: 'duplicate-modal', close: closeDuplicateModal },
            { id: 'import-modal', close: closeImportModal },
            { id: 'col-config-modal', close: closeColumnModal },
            { id: 'copy-account-modal', close: closeCopyAccountModal },
            { id: 'edit-folder-modal', close: closeEditFolderModal },
            { id: 'twofa-modal', close: close2FAModal },
            { id: 'log-viewer-modal', close: closeLogViewer }
        ];

        let modalClosed = false;
        for (const m of modals) {
            const el = document.getElementById(m.id);
            if (el && !el.classList.contains('hidden')) {
                m.close();
                modalClosed = true;
                break;
            }
        }

        if (modalClosed) return;

        const dropdowns = [
            'context-menu',
            'column-menu',
            'filter-dropdown-menu',
            'folder-dropdown-menu'
        ];

        dropdowns.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList.contains('active')) el.classList.remove('active');
                if (el.classList.contains('show')) el.classList.remove('show');
                if (el.style.display === 'block') el.style.display = 'none';
            }
        });

        document.getElementById('filter-dropdown-btn')?.classList.remove('active');
    }

    if (e.key === 'Enter') {
        const confirmModal = document.getElementById('confirm-modal');
        if (confirmModal && !confirmModal.classList.contains('hidden')) {
            document.getElementById('modal-confirm-btn').click();
            e.preventDefault();
            return;
        }

        const duplicateModal = document.getElementById('duplicate-modal');
        if (duplicateModal && !duplicateModal.classList.contains('hidden')) {
            confirmDuplicateImport();
            e.preventDefault();
            return;
        }

        const editFolderModal = document.getElementById('edit-folder-modal');
        if (editFolderModal && !editFolderModal.classList.contains('hidden')) {
            saveEditFolder();
            e.preventDefault();
            return;
        }
    }
});

// --- GLOBAL CLICK TO CLOSE MODALS ---
document.addEventListener('click', (e) => {
    const modals = [
        { id: 'import-modal', close: closeImportModal },
        { id: 'duplicate-modal', close: closeDuplicateModal },
        { id: 'col-config-modal', close: closeColumnModal },
        { id: 'copy-account-modal', close: closeCopyAccountModal },
        { id: 'edit-folder-modal', close: closeEditFolderModal },
        { id: 'confirm-modal', close: closeConfirmModal },
        { id: 'twofa-modal', close: close2FAModal },
        { id: 'log-viewer-modal', close: (typeof closeLogViewer !== 'undefined' ? closeLogViewer : () => { }) }
    ];

    modals.forEach(m => {
        const el = document.getElementById(m.id);
        if (el && !el.classList.contains('hidden') && e.target === el) {
            m.close();
        }
    });
});

// --- COPY ACCOUNT MODAL LOGIC (REFACTORED) ---
let currentCopyData = [];
// Default columns
let copyActiveColumns = ['uid', 'password', '2fa', 'email', 'email_pass'];

function openCopyAccountModal(data) {
    currentCopyData = data;
    const m = document.getElementById('copy-account-modal');
    if (!m) return;

    document.getElementById('copy-row-count').innerText = data.length;

    // Initial Render
    renderCopyColumnsRefactored();
    updateCopyPreviewRefactored();

    m.classList.remove('hidden');
    requestAnimationFrame(() => {
        m.classList.remove('opacity-0');
        m.querySelector('div.relative').classList.replace('scale-95', 'scale-100');
    });
}

function closeCopyAccountModal() {
    const m = document.getElementById('copy-account-modal');
    m.classList.add('opacity-0');
    m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); }, 200);
}

// Reuse COL_TYPES from Import logic
// helper to get label/color from COL_TYPES or fallback
function getColTypeInfo(key) {
    return COL_TYPES[key] || { label: key, color: 'text-slate-400' };
}

let draggedCopyColIndex = null;
let dragCopyPlaceholder = null;

function renderCopyColumnsRefactored() {
    const container = document.getElementById('copy-columns-container');
    container.innerHTML = '';

    copyActiveColumns.forEach((colType, index) => {
        // Main Item Container
        const div = document.createElement('div');
        div.className = 'relative flex items-center gap-0 bg-white/5 border border-white/10 hover:border-white/30 rounded-lg pr-1 animate-fade-in-up group transition-all duration-200 cursor-grab active:cursor-grabbing';
        div.draggable = true;
        div.dataset.index = index;

        // Drag Attributes and Events
        div.ondragstart = (e) => {
            draggedCopyColIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);

            // Placeholder
            dragCopyPlaceholder = div.cloneNode(true);
            dragCopyPlaceholder.classList.add('opacity-30', 'border-dashed', 'border-white/40');
            dragCopyPlaceholder.classList.remove('animate-fade-in-up', 'cursor-grab', 'hover:border-white/30');
            dragCopyPlaceholder.innerHTML = '';
            dragCopyPlaceholder.style.width = `${div.offsetWidth}px`;
            dragCopyPlaceholder.style.height = `${div.offsetHeight}px`;

            setTimeout(() => {
                div.classList.add('hidden');
                div.parentNode.insertBefore(dragCopyPlaceholder, div);
            }, 0);
        };

        div.ondragend = (e) => {
            div.classList.remove('hidden');
            if (dragCopyPlaceholder && dragCopyPlaceholder.parentNode) {
                dragCopyPlaceholder.parentNode.removeChild(dragCopyPlaceholder);
            }
            dragCopyPlaceholder = null;
            draggedCopyColIndex = null;
            renderCopyColumnsRefactored();
        };

        // Drag Handle
        const handle = document.createElement('div');
        handle.className = 'pl-1.5 pr-0.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing flex items-center justify-center';
        handle.innerHTML = '<i class="ri-draggable text-xs"></i>';

        // Select logic
        const wrapper = document.createElement('div');
        wrapper.className = 'relative flex items-center';

        const select = document.createElement('select');
        select.className = 'bg-transparent text-xs font-medium text-slate-200 focus:text-white focus:outline-none border-none py-2 pl-2 pr-7 appearance-none cursor-pointer transition-colors';
        select.onchange = (e) => updateCopyColumn(index, e.target.value);
        select.onmousedown = (e) => e.stopPropagation();

        // Populate options
        for (const [key, conf] of Object.entries(COL_TYPES)) {
            if (key === 'ignored') continue;
            const option = document.createElement('option');
            option.value = key;
            option.text = conf.label;
            option.className = 'bg-[#1a1b1e] text-slate-300 py-1';
            if (key === colType) option.selected = true;
            select.appendChild(option);
        }

        const arrow = document.createElement('i');
        arrow.className = 'ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs';

        wrapper.appendChild(select);
        wrapper.appendChild(arrow);

        // Separator
        const sep = document.createElement('div');
        sep.className = 'w-px h-3.5 bg-white/10 mx-0.5';

        // Remove Button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer';
        removeBtn.innerHTML = '<i class="ri-close-line text-xs"></i>';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeCopyColumn(index);
        };
        removeBtn.onmousedown = (e) => e.stopPropagation();

        div.appendChild(handle);
        div.appendChild(wrapper);
        div.appendChild(sep);
        div.appendChild(removeBtn);

        container.appendChild(div);
    });

    // Add Button
    const addBtn = document.createElement('button');
    addBtn.className = 'h-[38px] px-4 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:text-pink-300 hover:bg-pink-500/20 hover:border-pink-500/40 transition-all flex items-center gap-2 text-sm font-medium group animate-fade-in-up';
    addBtn.onclick = () => addCopyColumn();
    addBtn.innerHTML = `
        <div class="w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <i class="ri-add-line text-xs"></i>
        </div>
        Thêm cột
    `;
    container.appendChild(addBtn);

    // DropZone Logic
    container.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragCopyPlaceholder) return;

        const target = e.target.closest('div[draggable="true"]');
        if (target && target !== dragCopyPlaceholder) {
            const rect = target.getBoundingClientRect();
            const next = (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;
            if (next) container.insertBefore(dragCopyPlaceholder, target.nextSibling);
            else container.insertBefore(dragCopyPlaceholder, target);
        } else if (e.target === container) {
            container.appendChild(dragCopyPlaceholder);
        }
    };

    container.ondrop = (e) => {
        e.preventDefault();
        if (draggedCopyColIndex === null) return;

        const items = Array.from(container.children);
        let finalIndex = items.indexOf(dragCopyPlaceholder);
        const originalItemIndex = items.indexOf(container.querySelector('div[draggable="true"].hidden'));

        if (originalItemIndex < finalIndex) finalIndex--;

        if (draggedCopyColIndex !== finalIndex && finalIndex !== -1) {
            const item = copyActiveColumns.splice(draggedCopyColIndex, 1)[0];
            copyActiveColumns.splice(finalIndex, 0, item);
        }

        renderCopyColumnsRefactored();
        updateCopyPreviewRefactored();
    };
}

function addCopyColumn() {
    copyActiveColumns.push('uid');
    renderCopyColumnsRefactored();
    updateCopyPreviewRefactored();
}

function removeCopyColumn(index) {
    copyActiveColumns.splice(index, 1);
    renderCopyColumnsRefactored();
    updateCopyPreviewRefactored();
}

function updateCopyColumn(index, value) {
    copyActiveColumns[index] = value;
    updateCopyPreviewRefactored();
}

function updateCopyPreviewRefactored() {
    const textarea = document.getElementById('copy-account-textarea');

    const lines = currentCopyData.map(row => {
        return copyActiveColumns.map(colType => {
            // Map colType strings (from COL_TYPES keys) to row properties
            if (colType === 'uid') return row.uid || '';
            if (colType === 'password') return row.password || '';
            if (colType === '2fa') return row.twoFa || '';
            if (colType === 'email') return row.email || '';
            if (colType === 'email_pass') return row.emailPassword || '';
            if (colType === 'email_recover') return row.emailRecover || '';
            if (colType === 'cookie') return row.cookie || '';
            if (colType === 'token') return row.token || '';
            return '';
        }).join('|');
    });

    textarea.value = lines.join('\n');
}

function copyToClipboard() {
    const textarea = document.getElementById('copy-account-textarea');
    if (!textarea.value) {
        showToast('Không có dữ liệu để copy', 'warning');
        return;
    }
    navigator.clipboard.writeText(textarea.value).then(() => {
        showToast('Đã copy vào clipboard');
    }).catch(() => showToast('Lỗi copy', 'error'));
}

// --- 2FA MODAL LOGIC ---
let twoFAInterval;
let current2FASecret = '';

function show2FAModal(secret) {
    if (!secret) return;
    current2FASecret = secret;

    const m = document.getElementById('twofa-modal');
    m.classList.remove('hidden');
    requestAnimationFrame(() => {
        m.classList.remove('opacity-0');
        m.querySelector('div.relative').classList.replace('scale-95', 'scale-100');
    });

    update2FAInfo();
    twoFAInterval = setInterval(update2FAInfo, 1000);
}

function close2FAModal() {
    clearInterval(twoFAInterval);
    const m = document.getElementById('twofa-modal');
    m.classList.add('opacity-0');
    m.querySelector('div.relative').classList.replace('scale-100', 'scale-95');
    setTimeout(() => { m.classList.add('hidden'); }, 300);
}

async function update2FAInfo() {
    if (!current2FASecret) return;
    try {
        const res = await window.api.send('util:get-2fa', current2FASecret);
        if (res.error) {
            document.getElementById('twofa-code').innerText = 'ERROR';
            return;
        }

        // Format code xxx xxx
        const token = res.token;
        const formatted = token.slice(0, 3) + ' ' + token.slice(3);
        document.getElementById('twofa-code').innerText = formatted;

        // Countdown
        const fullDuration = 30; // TOTP step usually 30s
        const remaining = res.timeRemaining;
        document.getElementById('twofa-countdown').innerText = remaining;

        // Progress Style
        const percent = (remaining / fullDuration) * 100;
        const progEl = document.getElementById('twofa-progress');
        progEl.style.width = `${percent}%`;

        // Color logic based on urgency
        if (remaining <= 5) {
            progEl.className = 'h-full bg-red-500 transition-all duration-1000 ease-linear';
        } else {
            progEl.className = 'h-full bg-purple-500 transition-all duration-1000 ease-linear';
        }

    } catch (e) {
        console.error(e);
    }
}

function copy2FACode() {
    const code = document.getElementById('twofa-code').innerText.replace(/\s/g, '');
    if (!code || code === '---' || code === 'ERROR') return;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Đã copy mã 2FA');
    }).catch(() => showToast('Lỗi copy', 'error'));
}


