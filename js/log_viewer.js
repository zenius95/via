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
    const select = document.getElementById('log-file-select');
    select.innerHTML = '<option>Đang tải...</option>';
    document.getElementById('log-content-view').value = 'Đang tải dữ liệu...';

    try {
        const files = await window.api.send('log:get-files', { uid });
        select.innerHTML = '';

        if (!files || files.length === 0) {
            select.innerHTML = '<option value="">Không có nhật ký nào</option>';
            document.getElementById('log-content-view').value = 'Không có dữ liệu nhật ký cho tài khoản này.';
            return;
        }

        files.forEach(f => {
            const option = document.createElement('option');
            option.value = f.name;
            // Format time nicely if possible, else just name
            option.text = f.name;
            select.appendChild(option);
        });

        // Load first file
        select.value = files[0].name;
        loadLogContent(uid, files[0].name);

        // Bind Change Event
        select.onchange = () => {
            loadLogContent(uid, select.value);
        }

    } catch (err) {
        console.error('Failed to load log files', err);
        select.innerHTML = '<option>Lỗi tải danh sách</option>';
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
