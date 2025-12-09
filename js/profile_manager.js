document.addEventListener('DOMContentLoaded', () => {
    loadProfiles();

    // Bind Add Button in section-profiles
    // Logic moved to inline onclick in HTML to avoid selector issues
    // const addBtn = document.querySelector('#section-profiles button');
    // if (addBtn) {
    //     addBtn.onclick = () => openProfileModal();
    // }

    // Bind Select All Checkbox
    const selectAllCheckbox = document.getElementById('select-all-profiles');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.profile-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
            updateSelectedCount();
        });
    }

    // Delegate event for profile individual checkboxes
    const profilesTableBody = document.querySelector('#section-profiles tbody');
    if (profilesTableBody) {
        profilesTableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('profile-checkbox')) {
                updateSelectAllState();
                updateSelectedCount();
            }
        });
    }
});

let currentProfiles = [];
let isTrashView = false;
const browserVersionCache = {}; // Cache versions

async function fetchBrowserVersions(browser) {
    const versionSelect = document.getElementById('profile-browser-ver');
    if (!versionSelect) return;

    // Show loading
    versionSelect.innerHTML = '<option>Loading...</option>';
    versionSelect.disabled = true;

    // Check cache
    if (browserVersionCache[browser]) {
        populateVersionSelect(browserVersionCache[browser]);
        return;
    }

    let latestVersion = 120; // Default fallback

    try {
        if (browser === 'Chrome' || browser === 'Edge') {
            // Chrome API
            const response = await fetch('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json');
            const data = await response.json();
            latestVersion = parseInt(data.channels.Stable.version.split('.')[0]);
        } else if (browser === 'Firefox') {
            // Firefox API
            const response = await fetch('https://product-details.mozilla.org/1.0/firefox_versions.json');
            const data = await response.json();
            latestVersion = parseInt(data.LATEST_FIREFOX_VERSION.split('.')[0]);
        }
    } catch (err) {
        console.warn('Failed to fetch browser versions, using default:', err);
    }

    // Generate last 10 versions
    const versions = [];
    for (let i = 0; i < 10; i++) {
        versions.push(latestVersion - i);
    }

    // Save cache
    browserVersionCache[browser] = versions;
    populateVersionSelect(versions);
}

function populateVersionSelect(versions) {
    const versionSelect = $('#profile-browser-ver'); // Use jQuery
    versionSelect.empty();
    versions.forEach((ver, index) => {
        const option = new Option(`Version ${ver} ${index === 0 ? '(Latest)' : ''}`, ver, index === 0, index === 0);
        versionSelect.append(option);
    });
    versionSelect.prop('disabled', false);
    versionSelect.trigger('change'); // Notify Select2
    generateUserAgent();
}

async function loadProfiles() {
    try {
        let profiles;
        if (isTrashView) {
            profiles = await window.api.send('db:get-deleted-profiles');
        } else {
            profiles = await window.api.send('db:get-profiles');
        }
        currentProfiles = profiles || [];
        renderProfiles(currentProfiles);
    } catch (err) {
        console.error('Load profiles error:', err);
        showToast('Lỗi tải danh sách profile', 'error');
    }
}

function renderProfiles(profiles) {
    const tbody = document.querySelector('#section-profiles tbody');
    if (!tbody) return;

    // Reset Select All
    const selectAllCheckbox = document.getElementById('select-all-profiles');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-500 italic">
                    ${isTrashView ? 'Thùng rác trống.' : 'Chưa có profile nào. Hãy tạo mới ngay!'}
                </td>
            </tr>
        `;
        const countDiv = document.querySelector('#section-profiles .border-t');
        if (countDiv) countDiv.innerText = '0 profiles';
        return;
    }

    tbody.innerHTML = profiles.map(p => `
        <tr class="hover:bg-white/5 transition-colors group profile-row" oncontextmenu="handleProfileContextMenu(event, ${p.id})">
            <td class="px-6 py-4 w-12">
                <div class="flex items-center justify-center">
                    <input type="checkbox" class="profile-checkbox w-4 h-4 rounded border-gray-600 bg-slate-700 text-blue-600 focus:ring-offset-gray-900 focus:ring-1 focus:ring-blue-500 cursor-pointer" value="${p.id}">
                </div>
            </td>
            <td class="px-6 py-4 font-medium text-white select-none">${p.name}</td>
            <td class="px-6 py-4 select-none">
                <i class="${getOSIcon(p.os)} mr-2"></i>${p.os}
            </td>
            <td class="px-6 py-4 select-none">
                <i class="${getBrowserIcon(p.browser)} mr-2"></i>${p.browser} <span class="text-xs text-slate-500">v${p.browser_version || '?'}</span>
            </td>
            <td class="px-6 py-4 text-center text-xs truncate max-w-[150px] text-slate-500 select-none" title="${p.user_agent}">
                ${p.user_agent ? p.user_agent.substring(0, 20) + '...' : 'Auto'}
            </td>
            <td class="px-6 py-4 text-right">
                ${isTrashView ? `
                    <button onclick="restoreProfile(${p.id})" title="Khôi phục" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded text-xs font-medium transition-colors border border-green-500/20">
                        <i class="ri-arrow-go-back-line"></i> Khôi phục
                    </button>
                ` : `
                    <button onclick="editProfile(${p.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded text-xs font-medium transition-colors border border-blue-500/20">
                        <i class="ri-edit-line"></i> Sửa
                    </button>
                `}
            </td>
        </tr>
    `).join('');

    // Update count
    updateSelectedCount();

    // Close context menu on click elsewhere
    document.addEventListener('click', closeContextMenu);
}

function updateSelectAllState() {
    const checkboxes = document.querySelectorAll('.profile-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.profile-checkbox:checked');
    const selectAllCheckbox = document.getElementById('select-all-profiles');

    if (selectAllCheckbox) {
        if (checkboxes.length > 0 && checkboxes.length === checkedCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}

function updateSelectedCount() {
    const profiles = currentProfiles || [];
    const checkedCheckboxes = document.querySelectorAll('.profile-checkbox:checked');
    const countDiv = document.querySelector('#section-profiles .border-t');

    if (countDiv) {
        if (checkedCheckboxes.length > 0) {
            countDiv.innerHTML = `<span class="text-blue-400 font-medium">Đã chọn ${checkedCheckboxes.length} / ${profiles.length} profiles</span>`;
        } else {
            countDiv.innerText = `Hiển thị ${profiles.length} profiles`;
        }
    }
}

// --- CONTEXT MENU ---

function handleProfileContextMenu(e, id) {
    e.preventDefault();
    closeContextMenu();

    // Select the row if not already selected (optional, but good UX)
    // Find checkbox for this id
    const checkbox = document.querySelector(`.profile-checkbox[value="${id}"]`);

    // If we have multiple selections and this row IS one of them, do NOT deselect others.
    // If this row is NOT selected, select ONLY this row (mimics standard OS behavior)
    if (checkbox && !checkbox.checked) {
        // Clear other selections
        document.querySelectorAll('.profile-checkbox').forEach(cb => cb.checked = false);
        checkbox.checked = true;
        updateSelectAllState();
        updateSelectedCount();
    }

    // Determine numbers
    const checkedCount = document.querySelectorAll('.profile-checkbox:checked').length;

    // Create Menu
    const menu = document.createElement('div');
    menu.id = 'profile-context-menu';
    menu.className = 'fixed bg-slate-800 border border-white/10 rounded-lg shadow-2xl py-1.5 z-[9999] min-w-[160px] animate-fade-in backdrop-blur-md';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const actionText = isTrashView ? 'Xóa vĩnh viễn' : 'Xóa';
    const icon = isTrashView ? 'ri-delete-bin-2-fill' : 'ri-delete-bin-line';
    const colorClass = isTrashView ? 'text-red-500' : 'text-red-400';

    let menuHtml = '';

    if (!isTrashView) {
        // Edit Option
        if (checkedCount <= 1) {
            menuHtml += `
                <button onclick="editProfile(${id})" class="w-full text-left px-4 py-2 hover:bg-white/5 text-sm text-slate-300 hover:text-white flex items-center gap-2">
                    <i class="ri-edit-line"></i> Chỉnh sửa
                </button>
            `;
        }
    } else {
        // Restore Option
        menuHtml += `
            <button onclick="restoreSelectedOrSingle(${id})" class="w-full text-left px-4 py-2 hover:bg-white/5 text-sm text-green-400 hover:text-green-300 flex items-center gap-2">
                <i class="ri-arrow-go-back-line"></i> Khôi phục ${checkedCount > 1 ? `(${checkedCount})` : ''}
            </button>
        `;
    }

    // Delete Option
    menuHtml += `
        <button onclick="deleteSelectedOrSingle(${id})" class="w-full text-left px-4 py-2 hover:bg-white/5 text-sm ${colorClass} hover:text-red-300 flex items-center gap-2">
            <i class="${icon}"></i> ${actionText} ${checkedCount > 1 ? `(${checkedCount})` : ''}
        </button>
    `;

    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);

    // Adjust position if out of bounds
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
}

function closeContextMenu() {
    const existing = document.getElementById('profile-context-menu');
    if (existing) existing.remove();
}

function deleteSelectedOrSingle(id) {
    // If checkboxes are checked, use bulk delete logic
    const checked = document.querySelectorAll('.profile-checkbox:checked');
    if (checked.length > 0) {
        deleteSelectedProfiles();
    } else {
        // Fallback to single delete (though we auto-selected above)
        if (isTrashView) permanentDeleteProfile(id);
        else deleteProfile(id);
    }
    closeContextMenu();
}

function restoreSelectedOrSingle(id) {
    const checked = document.querySelectorAll('.profile-checkbox:checked');
    if (checked.length > 0) {
        // Bulk restore
        const ids = Array.from(checked).map(cb => cb.value);
        // Reuse bulk delete logic but for restore? Need new function.
        bulkRestore(ids);
    } else {
        restoreProfile(id);
    }
    closeContextMenu();
}

async function bulkRestore(ids) {
    try {
        let count = 0;
        for (const id of ids) {
            await window.api.send('db:restore-profile', id);
            count++;
        }
        showToast(`Đã khôi phục ${count} profile`, 'success');
        loadProfiles();
    } catch (err) {
        showToast('Lỗi khôi phục', 'error');
    }
}

function getOSIcon(os) {
    if (!os) return 'ri-question-line';
    const lower = os.toLowerCase();
    if (lower.includes('win')) return 'ri-windows-fill text-blue-400';
    if (lower.includes('mac')) return 'ri-apple-fill text-slate-200';
    if (lower.includes('linux')) return 'ri-ubuntu-fill text-orange-400';
    if (lower.includes('android')) return 'ri-android-fill text-green-400';
    if (lower.includes('ios')) return 'ri-apple-fill text-slate-200';
    return 'ri-device-line';
}

function getBrowserIcon(browser) {
    if (!browser) return 'ri-earth-line';
    const lower = browser.toLowerCase();
    if (lower.includes('chrome')) return 'ri-chrome-fill text-green-400';
    if (lower.includes('firefox')) return 'ri-firefox-fill text-orange-500';
    if (lower.includes('safari')) return 'ri-safari-fill text-blue-500';
    if (lower.includes('edge')) return 'ri-edge-fill text-blue-600';
    return 'ri-global-line';
}

// --- MODAL & FORM ---

function openProfileModal(profile = null) {
    const modal = document.getElementById('modal-profile');
    const form = document.getElementById('form-profile');
    const title = document.getElementById('modal-title');

    // Reset Form
    form.reset();
    document.getElementById('profile-id').value = '';

    // Reset Select2 placeholder/values if needed (REMOVED to fix blank issue)
    // $('#profile-os, #profile-browser, #profile-browser-ver, #profile-resolution').val(null).trigger('change');

    modal.classList.remove('hidden');

    // Destroy previous instances if they exist (using robust data check)
    const $selects = $('#profile-os, #profile-browser, #profile-browser-ver, #profile-resolution');
    $selects.each(function () {
        if ($(this).data('select2')) {
            $(this).select2('destroy');
        }
    });

    // Initialize Select2 (Non-searchable)
    $('#profile-os, #profile-browser, #profile-resolution').select2({
        minimumResultsForSearch: Infinity,
        dropdownParent: $('#modal-profile')
    });

    // Initialize Select2 (Searchable - Version)
    $('#profile-browser-ver').select2({
        minimumResultsForSearch: Infinity,
        dropdownParent: $('#modal-profile')
    });

    // Re-bind events for Select2 (using jQuery)
    $('#profile-os, #profile-browser, #profile-browser-ver').off('change').on('change', function () {
        // FORCE SELECT2 TO UPDATE TEXT (Fix for stubborn UI)
        const text = $(this).find('option:selected').text();
        const $container = $(this).siblings('.select2-container');
        $container.find('.select2-selection__rendered').text(text);

        generateUserAgent();
    });

    $('#profile-browser').off('change.fetch').on('change.fetch', function () {
        fetchBrowserVersions(this.value);
    });

    if (profile) {
        title.innerText = 'Cập nhật Profile';
        document.getElementById('profile-id').value = profile.id;
        document.getElementById('profile-name').value = profile.name;
        document.getElementById('profile-ua').value = profile.user_agent || '';
        document.getElementById('profile-notes').value = profile.notes || '';

        // Update Select2 Values
        $('#profile-os').val(profile.os).trigger('change');
        $('#profile-browser').val(profile.browser).trigger('change');
        $('#profile-resolution').val(profile.screen_resolution || '1920x1080').trigger('change');

        // Fetch then set version
        fetchBrowserVersions(profile.browser).then(() => {
            $('#profile-browser-ver').val(profile.browser_version || '120').trigger('change');
        });
    } else {
        title.innerText = 'Thêm mới Profile';
        // New Profile defaults
        $('#profile-os').val('Windows').trigger('change');
        $('#profile-browser').val('Chrome').trigger('change');
        fetchBrowserVersions('Chrome');
    }
}

function closeProfileModal() {
    document.getElementById('modal-profile').classList.add('hidden');
}

async function handleProfileSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('profile-id').value;
    const name = document.getElementById('profile-name').value;
    const os = document.getElementById('profile-os').value;
    const browser = document.getElementById('profile-browser').value;
    const version = document.getElementById('profile-browser-ver').value || '120';
    const resolution = document.getElementById('profile-resolution').value;
    const notes = document.getElementById('profile-notes').value;
    const ua = document.getElementById('profile-ua').value;

    const profileData = {
        name, os, browser, browser_version: version, user_agent: ua,
        screen_resolution: resolution, notes
    };

    try {
        if (id) {
            // Update
            await window.api.send('db:update-profile', { ...profileData, id });
            showToast('Cập nhật profile thành công', 'success');
        } else {
            // Add
            await window.api.send('db:add-profile', profileData);
            showToast('Thêm profile mới thành công', 'success');
        }
        closeProfileModal();
        loadProfiles(); // Refresh
    } catch (err) {
        console.error('Save profile error:', err);
        showToast('Có lỗi xảy ra', 'error');
    }
}

async function editProfile(id) {
    const profile = currentProfiles.find(p => p.id === id);
    if (profile) {
        openProfileModal(profile);
    }
}

async function deleteProfile(id) {
    showConfirmDialog('Xóa Profile?', 'Bạn có chắc chắn muốn xóa profile này không?', async () => {
        try {
            await window.api.send('db:delete-profile', parseInt(id, 10));
            showToast('Đã xóa profile', 'success');
            loadProfiles();
        } catch (err) {
            console.error(err);
            showToast('Lỗi khi xóa', 'error');
        }
    });
}

async function deleteSelectedProfiles() {
    const checked = document.querySelectorAll('.profile-checkbox:checked');
    const ids = Array.from(checked).map(cb => cb.value);

    if (ids.length === 0) return;

    const actionText = isTrashView ? 'Xóa vĩnh viễn' : 'Xóa';
    const warningText = isTrashView
        ? 'Hành động này không thể hoàn tác! Bạn có chắc chắn muốn xóa vĩnh viễn không?'
        : 'Các profile sẽ được chuyển vào thùng rác.';

    showConfirmDialog(`${actionText} các profile đã chọn?`, `${warningText} (${ids.length} profile)`, async () => {
        try {
            let successCount = 0;
            const ipcChannel = isTrashView ? 'db:permanent-delete-profile' : 'db:delete-profile';

            // Execute deletions sequentially
            for (const id of ids) {
                const numericId = parseInt(id, 10);
                await window.api.send(ipcChannel, numericId);
                successCount++;
            }
            showToast(`Đã ${actionText.toLowerCase()} ${successCount} profile`, 'success');
            loadProfiles();

            // Hide button after action
            const btn = document.getElementById('btn-delete-selected');
            if (btn) btn.classList.add('hidden');
        } catch (err) {
            console.error('Batch delete error:', err);
            showToast('Có lỗi xảy ra khi xóa danh sách', 'error');
            loadProfiles();
        }
    });
}

function toggleTrashView() {
    isTrashView = !isTrashView;
    const btn = document.getElementById('btn-toggle-trash');
    const title = document.getElementById('profile-section-title');
    const addBtn = document.querySelector('button[onclick="openProfileModal()"]');

    if (isTrashView) {
        btn.innerHTML = '<i class="ri-arrow-go-back-line mr-1"></i> Quay lại';
        btn.className = "px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-sm font-medium transition-colors border border-blue-500/20";
        if (title) title.innerText = 'Thùng rác';
        if (addBtn) addBtn.style.display = 'none';

    } else {
        btn.innerHTML = '<i class="ri-delete-bin-2-line mr-1"></i> Thùng rác';
        btn.className = "px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-white/5";
        if (title) title.innerText = 'Quản lý Profile';
        if (addBtn) addBtn.style.display = 'inline-block';
    }

    // Reset selection state
    const selectAllCheckbox = document.getElementById('select-all-profiles');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }

    loadProfiles();
}

async function restoreProfile(id) {
    try {
        await window.api.send('db:restore-profile', id);
        showToast('Đã khôi phục profile', 'success');
        loadProfiles();
    } catch (err) {
        console.error(err);
        showToast('Lỗi khi khôi phục', 'error');
    }
}

async function permanentDeleteProfile(id) {
    showConfirmDialog('Xóa vĩnh viễn?', 'Hành động này không thể hoàn tác. Bạn có chắc chắn không?', async () => {
        try {
            await window.api.send('db:permanent-delete-profile', id);
            showToast('Đã xóa vĩnh viễn profile', 'success');
            loadProfiles();
        } catch (err) {
            console.error(err);
            showToast('Lỗi khi xóa', 'error');
        }
    });
}

function generateUserAgent() {
    const os = $('#profile-os').val();
    const browser = $('#profile-browser').val();
    const version = $('#profile-browser-ver').val() || '120';

    // Improved UA Generator
    let ua = '';

    if (browser === 'Chrome') {
        if (os === 'Windows') {
            ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
        } else if (os === 'macOS') {
            ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
        } else {
            ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
        }
    } else if (browser === 'Edge') {
        ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`;
    } else if (browser === 'Firefox') {
        if (os === 'Windows') ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;
        else ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;
    }

    document.getElementById('profile-ua').value = ua;
}
