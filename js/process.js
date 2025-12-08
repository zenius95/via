/* js/process.js */

// --- CẤU HÌNH (CONFIGURATION) ---
let PROCESS_CONFIG = {
    maxThreads: 3, // Số luồng chạy tối đa cùng lúc
    delay: 2000,   // Thời gian chờ giữa các lần khởi chạy luồng (ms)
    timeout: 0,    // Thời gian timeout tối đa cho mỗi profile (0 = không giới hạn)
    retry: 0       // Số lần thử lại nếu gặp lỗi
};

// --- TRẠNG THÁI (STATE) ---
let isProcessRunning = false; // Cờ báo hiệu tiến trình đang chạy
let processQueue = [];        // Hàng đợi chứa các node (tài khoản) cần xử lý
let activeThreads = 0;        // Số luồng đang hoạt động hiện tại
let forceStop = false;        // Cờ báo hiệu lệnh dừng khẩn cấp từ người dùng

// --- DOM ELEMENTS ---
// Sẽ được khởi tạo khi trang load xong
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-start-process');
    if (btn) {
        btn.addEventListener('click', toggleProcess);
    }
});

function toggleProcess() {
    if (isProcessRunning) {
        stopProcess();
    } else {
        startProcess();
    }
}

async function startProcess() {
    if (!gridApi) return;

    // 1. Tải cấu hình từ Database
    try {
        const settings = await window.api.send('db:get-settings');
        if (settings) {
            PROCESS_CONFIG.maxThreads = parseInt(settings.maxThreads) || 3;
            PROCESS_CONFIG.delay = (parseInt(settings.launchDelay) || 2) * 1000;
            PROCESS_CONFIG.retry = parseInt(settings.retryCount) || 0;
            PROCESS_CONFIG.timeout = parseInt(settings.timeout) || 0;
            PROCESS_CONFIG.chromePath = settings.chromePath || ''; // Load đường dẫn Chrome

            console.log('Loaded Config:', PROCESS_CONFIG);
        }

        // 2. Kiểm tra đường dẫn Chrome
        if (!PROCESS_CONFIG.chromePath) {
            console.log('Chrome Path missing, attempting auto-detect...');
            const detectedPath = await window.api.send('main:get-chrome-path');
            if (detectedPath) {
                PROCESS_CONFIG.chromePath = detectedPath;
                // Có thể lưu lại vào DB nếu cần thiết
            } else {
                showToast('Chưa cấu hình đường dẫn Chrome! Vui lòng vào Cài đặt.', 'error');
                return;
            }
        }

    } catch (err) {
        console.error('Failed to load process config', err);
    }

    // 3. Chuẩn bị hàng đợi (Queue) từ các dòng đang chọn
    const selectedNodes = gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
        showToast('Vui lòng chọn tài khoản để chạy', 'warning');
        return;
    }

    // Cập nhật giao diện nút Start -> Stop
    const btn = document.getElementById('btn-start-process');
    btn.classList.add('bg-red-600', 'hover:bg-red-500', '!from-red-600', '!to-red-500', 'shadow-red-900/40');

    // Thay đổi nội dung nút
    btn.innerHTML = `
        <i class="ri-stop-fill text-lg"></i>
        <span class="ml-1">Dừng lại</span>
    `;
    // Thêm style trực tiếp để đảm bảo ghi đè các class gradient cũ
    btn.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
    btn.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';

    // Khởi tạo trạng thái chạy
    isProcessRunning = true;
    forceStop = false;
    processQueue = [...selectedNodes]; // Copy danh sách node vào hàng đợi

    // Reset trạng thái trên bảng về "Waiting"
    processQueue.forEach(node => {
        if (node.data) {
            node.setDataValue('processStatus', 'WAITING');
            node.setDataValue('processMessage', 'Đang chờ...');
        }
    });

    showToast(`Bắt đầu chạy với ${processQueue.length} tài khoản`, 'info');
    runQueueLoop(); // Bắt đầu vòng lặp xử lý hàng đợi
}

function stopProcess() {
    forceStop = true;
    isProcessRunning = false;
    processQueue = []; // Xóa sạch hàng đợi

    // Revert giao diện nút về trạng thái "Bắt đầu"
    const btn = document.getElementById('btn-start-process');
    btn.innerHTML = `
        <i class="ri-play-fill text-lg"></i>
        <span class="ml-1">Bắt đầu</span>
    `;
    btn.style.background = ''; // Xóa style inline để dùng lại class mặc định
    btn.style.boxShadow = '';

    showToast('Đã dừng tiến trình', 'warning');
}

async function runQueueLoop() {
    while (isProcessRunning) {
        if (forceStop) break;

        // Kiểm tra nếu hàng đợi trống và không còn luồng nào đang chạy
        if (processQueue.length === 0 && activeThreads === 0) {
            stopProcess();
            showToast('Đã hoàn thành tất cả tác vụ', 'success');
            break;
        }

        // Kiểm tra giới hạn luồng (Concurrency)
        if (activeThreads < PROCESS_CONFIG.maxThreads && processQueue.length > 0) {
            const node = processQueue.shift();
            if (node) {
                // Khởi chạy luồng mới
                runThread(node);

                // Delay trước khi khởi chạy luồng tiếp theo (tránh mở ồ ạt)
                if (PROCESS_CONFIG.delay > 0) {
                    await new Promise(r => setTimeout(r, PROCESS_CONFIG.delay));
                }
            }
        } else {
            // Nếu full luồng hoặc hết hàng đợi, chờ 200ms rồi kiểm tra lại
            await new Promise(r => setTimeout(r, 200));
        }
    }
}

async function runThread(node) {
    activeThreads++;
    let currentRetry = 0;
    const maxRetry = PROCESS_CONFIG.retry;

    // Vòng lặp thử lại (Retry Loop)
    while (true) {
        // Tạo ID duy nhất cho lần chạy này để tránh cập nhật nhầm vào node cũ nếu bị dừng
        const attemptId = Date.now() + Math.random();
        node.data.activeAttemptId = attemptId;

        try {
            if (forceStop) throw new Error('Stopped');

            updateNodeStatus(node, 'RUNNING', currentRetry > 0 ? `Bắt đầu lại (Lần ${currentRetry})...` : 'Đang khởi chạy...');

            // Tạo Promise timeout
            const timeoutPromise = PROCESS_CONFIG.timeout > 0
                ? new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), PROCESS_CONFIG.timeout * 1000))
                : new Promise(() => { });

            // Promise thực thi hành động chính
            const actionPromise = (async () => {
                if (forceStop) throw new Error('Stopped');

                // Chỉ update status nếu attempt này còn hiệu lực
                if (node.data.activeAttemptId === attemptId) {
                    updateNodeStatus(node, 'RUNNING', 'Đang mở trình duyệt...');
                }

                // Gọi IPC để chạy profile (liên lạc với Main Process)
                const result = await window.api.send('process:run-profile', {
                    account: node.data,
                    config: PROCESS_CONFIG
                });

                if (forceStop) throw new Error('Stopped');

                if (result && result.status === 'ERROR') {
                    throw new Error(result.message);
                }

                // Thành công
                return result ? result.message : 'Hoàn thành';
            })();

            // Chạy đua giữa Timeout và Hành động chính (Promise.race)
            await Promise.race([actionPromise, timeoutPromise]);

            updateNodeStatus(node, 'SUCCESS', 'Hoàn thành');
            break; // Thành công -> Thoát vòng lặp

        } catch (err) {
            // Kiểm tra lỗi dừng
            if (err.message === 'Stopped') {
                updateNodeStatus(node, 'STOPPED', 'Đã dừng');
                break;
            }

            // Kiểm tra xem có cần thử lại không
            if (currentRetry < maxRetry) {
                currentRetry++;
                updateNodeStatus(node, 'RETRY', `Lỗi: ${err.message}. Đợi thử lại (${currentRetry}/${maxRetry})...`);
                await sleep(2000); // Chờ 2s trước khi thử lại
                continue; // Quay lại đầu vòng lặp
            }

            // Nếu hết lượt thử lại, báo lỗi cuối cùng
            if (err.message === 'Checkpoint') {
                updateNodeStatus(node, 'ERROR', 'Lỗi: Checkpoint');
            } else if (err.message === 'Timeout') {
                updateNodeStatus(node, 'ERROR', 'Lỗi: Timeout');
            } else if (err.message === 'BrowserClosed') {
                updateNodeStatus(node, 'ERROR', 'Đã tắt trình duyệt');
            } else {
                updateNodeStatus(node, 'ERROR', 'Lỗi không xác định');
            }
            break; // Thoát vòng lặp
        }
    }

    activeThreads--;
}

// Cập nhật trạng thái cho node trên bảng (AG Grid)
function updateNodeStatus(node, status, msg) {
    if (!node || !node.data) return;

    // Cập nhật data trực tiếp để tránh trigger sự kiện onCellValueChanged (gây lưu DB không cần thiết)
    node.data.processStatus = status;
    node.data.processMessage = msg;

    // Buộc vẽ lại (redraw) các cell trong cột 'process' cho row này
    gridApi.refreshCells({
        rowNodes: [node],
        columns: ['process'],
        force: true
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
