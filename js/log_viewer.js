let currentLogUid = null;

async function openLogViewer(uid) {
    currentLogUid = uid;
    const modal = document.getElementById('log-viewer-modal');
    modal.classList.remove('hidden');
    // Animate in
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.transform').classList.remove('scale-95');
    }, 10);

    // Initial Load
    await loadLogFiles(uid);
}

function closeLogViewer() {
    const modal = document.getElementById('log-viewer-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('log-content-view').value = '';
        document.getElementById('log-file-select').innerHTML = '';
        currentLogUid = null;
    }, 300);
}

async function loadLogFiles(uid) {
    const select = $('#log-file-select');
    select.empty();
    select.append('<option>Đang tải...</option>');

    // Initialize Select2 if not already
    if (!select.hasClass("select2-hidden-accessible")) {
        select.select2({
            dropdownParent: $('#log-viewer-modal'),
            minimumResultsForSearch: 10
        });

        // Bind Change Event (Select2)
        select.on('select2:select', function (e) {
            const fileName = e.params.data.id;
            loadLogContent(uid, fileName);
        });
    }

    document.getElementById('log-content-view').value = 'Đang tải dữ liệu...';

    try {
        const files = await window.api.send('log:get-files', { uid });
        select.empty();

        if (!files || files.length === 0) {
            select.append('<option value="">Không có nhật ký nào</option>');
            document.getElementById('log-content-view').value = 'Không có dữ liệu nhật ký cho tài khoản này.';
            return;
        }

        files.forEach(f => {
            const option = new Option(f.name, f.name, false, false);
            select.append(option);
        });

        // Load first file
        select.val(files[0].name).trigger('change');
        loadLogContent(uid, files[0].name);

    } catch (err) {
        console.error('Failed to load log files', err);
        select.empty();
        select.append('<option>Lỗi tải danh sách</option>');
    }
}

async function loadLogContent(uid, fileName) {
    const textarea = document.getElementById('log-content-view');
    // textarea.value = 'Đang tải nội dung...'; // Optional, might flicker

    try {
        const content = await window.api.send('log:read-file', { uid, fileName });
        textarea.value = content;
        // Auto scroll to bottom
        textarea.scrollTop = textarea.scrollHeight;
    } catch (err) {
        textarea.value = 'Lỗi tải nội dung file.';
    }
}
