document.addEventListener('DOMContentLoaded', () => {
    loadProfiles();

    // Bind Add Button in section-profiles
    const addBtn = document.querySelector('#section-profiles button');
    if (addBtn) {
        addBtn.onclick = () => openProfileModal();
    }
});

let currentProfiles = [];
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
        const profiles = await window.api.send('db:get-profiles');
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

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-500 italic">
                    Chưa có profile nào. Hãy tạo mới ngay!
                </td>
            </tr>
        `;
        document.querySelector('#section-profiles .text-slate-500.text-center').innerText = '0 profiles';
        return;
    }

    tbody.innerHTML = profiles.map(p => `
        <tr class="hover:bg-white/5 transition-colors group">
            <td class="px-6 py-4 font-medium text-white">${p.name}</td>
            <td class="px-6 py-4">
                <i class="${getOSIcon(p.os)} mr-2"></i>${p.os}
            </td>
            <td class="px-6 py-4">
                <i class="${getBrowserIcon(p.browser)} mr-2"></i>${p.browser} <span class="text-xs text-slate-500">v${p.browser_version || '?'}</span>
            </td>
            <td class="px-6 py-4 text-center text-xs truncate max-w-[150px] text-slate-500" title="${p.user_agent}">
                ${p.user_agent ? p.user_agent.substring(0, 20) + '...' : 'Auto'}
            </td>
            <td class="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="editProfile(${p.id})" class="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"><i class="ri-edit-line"></i></button>
                <button onclick="deleteProfile(${p.id})" class="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-red-400 transition-colors"><i class="ri-delete-bin-line"></i></button>
            </td>
        </tr>
    `).join('');

    // Update count
    const countDiv = document.querySelector('#section-profiles .border-t');
    if (countDiv) countDiv.innerText = `Hiển thị ${profiles.length} profiles`;
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
            // Update: Cập nhật thông tin profile hiện có
            await window.api.send('db:update-profile', { ...profileData, id });
            showToast('Cập nhật profile thành công', 'success');
        } else {
            // Add: Thêm mới profile vào database
            await window.api.send('db:add-profile', profileData);
            showToast('Thêm profile mới thành công', 'success');
        }
        closeProfileModal();
        loadProfiles(); // Tải lại danh sách sau khi thay đổi
    } catch (err) {
        console.error('Save profile error:', err);
        showToast('Có lỗi xảy ra', 'error');
    }
}

/**
 * Mở modal chỉnh sửa cho một profile cụ thể
 * @param {number} id - ID của profile cần sửa
 */
async function editProfile(id) {
    const profile = currentProfiles.find(p => p.id === id);
    if (profile) {
        openProfileModal(profile);
    }
}

/**
 * Xóa một profile cụ thể (nút xóa trên từng dòng)
 * @param {number} id - ID của profile cần xóa
 */
async function deleteProfile(id) {
    if (confirm('Bạn có chắc chắn muốn xóa profile này không?')) {
        try {
            await window.api.send('db:delete-profile', id);
            showToast('Đã xóa profile', 'success');
            loadProfiles();
        } catch (err) {
            console.error(err);
            showToast('Lỗi khi xóa', 'error');
        }
    }
}

/**
 * Tự động tạo chuỗi UserAgent dựa trên OS và Browser người dùng chọn.
 * Giúp người dùng không phải tự nhập thủ công.
 */
function generateUserAgent() {
    const os = $('#profile-os').val();
    const browser = $('#profile-browser').val();
    const version = $('#profile-browser-ver').val() || '120';

    // Logic tạo UA string chuẩn (giả lập)
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
