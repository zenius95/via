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
        showDuplicateModal();
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
let selectedStatuses = new Set(['LIVE', 'DIE', 'CHECKPOINT', 'UNCHECKED']); // Mặc định chọn tất
const statusMap = {
    'LIVE': { label: 'Hoạt động (Live)', colorClass: 'bg-live', textClass: 'text-emerald-400' },
    'DIE': { label: 'Vô hiệu (Die)', colorClass: 'bg-die', textClass: 'text-red-400' },
    'CHECKPOINT': { label: 'Checkpoint', colorClass: 'bg-checkpoint', textClass: 'text-amber-400' },
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