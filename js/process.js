/* js/process.js */

// --- CONFIGURATION ---
let PROCESS_CONFIG = {
    maxThreads: 3,
    delay: 2000,
    timeout: 0,
    retry: 0
};

// --- STATE ---
let isProcessRunning = false;
let processQueue = [];
let activeThreads = 0;
let forceStop = false;

// --- DOM ELEMENTS ---
// Will be initialized on load

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

    // Load Settings
    try {
        const settings = await window.api.send('db:get-settings');
        if (settings) {
            PROCESS_CONFIG.maxThreads = parseInt(settings.maxThreads) || 3;
            PROCESS_CONFIG.delay = (parseInt(settings.launchDelay) || 2) * 1000;
            PROCESS_CONFIG.retry = parseInt(settings.retryCount) || 0;
            PROCESS_CONFIG.timeout = parseInt(settings.timeout) || 0;

            console.log('Loaded Config:', PROCESS_CONFIG);
        }
    } catch (err) {
        console.error('Failed to load process config', err);
    }

    const selectedNodes = gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
        showToast('Vui lòng chọn tài khoản để chạy', 'warning');
        return;
    }

    // UPDATE UI
    const btn = document.getElementById('btn-start-process');
    btn.classList.add('bg-red-600', 'hover:bg-red-500', '!from-red-600', '!to-red-500', 'shadow-red-900/40');
    // Remove default gradient classes if they conflict, or override with !important via class/style
    // Simple way: Change innerHTML and style
    btn.innerHTML = `
        <i class="ri-stop-fill text-lg"></i>
        <span class="ml-1">Dừng lại</span>
    `;
    // We might need to handle the gradient background via style if classes are stubborn
    btn.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
    btn.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';

    isProcessRunning = true;
    forceStop = false;
    processQueue = [...selectedNodes]; // Copy selected nodes

    // Reset status for selected rows
    processQueue.forEach(node => {
        if (node.data) {
            node.setDataValue('processStatus', 'WAITING');
            node.setDataValue('processMessage', 'Đang chờ...');
        }
    });

    showToast(`Bắt đầu chạy với ${processQueue.length} tài khoản`, 'info');
    runQueueLoop();
}

function stopProcess() {
    forceStop = true;
    isProcessRunning = false;
    processQueue = []; // Clear queue

    // UI Revert
    const btn = document.getElementById('btn-start-process');
    btn.innerHTML = `
        <i class="ri-play-fill text-lg"></i>
        <span class="ml-1">Bắt đầu</span>
    `;
    btn.style.background = ''; // Revert to CSS default
    btn.style.boxShadow = '';

    showToast('Đã dừng tiến trình', 'warning');
}

async function runQueueLoop() {
    while (isProcessRunning) {
        if (forceStop) break;

        // Check if queue empty and no threads running
        if (processQueue.length === 0 && activeThreads === 0) {
            stopProcess();
            showToast('Đã hoàn thành tất cả tác vụ', 'success');
            break;
        }

        // Check concurrency
        if (activeThreads < PROCESS_CONFIG.maxThreads && processQueue.length > 0) {
            const node = processQueue.shift();
            if (node) {
                // Launch thread
                runThread(node);

                // Delay before next launch check? 
                // Wait delay ms before the loop continues to launch another?
                // The requirement says "Delay: thời gian delay giữa các luồng mở lên cùng lúc"
                if (PROCESS_CONFIG.delay > 0) {
                    await new Promise(r => setTimeout(r, PROCESS_CONFIG.delay));
                }
            }
        } else {
            // Wait a bit if full or empty
            await new Promise(r => setTimeout(r, 200));
        }
    }
}

async function runThread(node) {
    activeThreads++;
    let currentRetry = 0;
    const maxRetry = PROCESS_CONFIG.retry;

    // Retry Loop
    while (true) {
        // Generate unique attempt ID to prevent zombie updates
        const attemptId = Date.now() + Math.random();
        node.data.activeAttemptId = attemptId;

        try {
            if (forceStop) throw new Error('Stopped');

            updateNodeStatus(node, 'RUNNING', currentRetry > 0 ? `Bắt đầu lại (Lần ${currentRetry})...` : 'Đang khởi chạy...');

            // Create timeout promise
            const timeoutPromise = PROCESS_CONFIG.timeout > 0
                ? new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), PROCESS_CONFIG.timeout * 1000))
                : new Promise(() => { });

            // Action Promise
            const actionPromise = (async () => {
                // --- SIMULATION LOGIC ---
                await sleep(1000 + Math.random() * 2000);
                if (forceStop) throw new Error('Stopped');

                // GUARD: Only update if this attempt is still active
                if (node.data.activeAttemptId === attemptId) {
                    updateNodeStatus(node, 'RUNNING', 'Đang đăng nhập...');
                }

                await sleep(2000 + Math.random() * 3000);
                if (forceStop) throw new Error('Stopped');

                // 80% chance failure for demo to make sure we see Errors
                const isSuccess = Math.random() > 0.8;
                if (!isSuccess) throw new Error('Checkpoint');
            })();

            // Wrap logic in race
            await Promise.race([actionPromise, timeoutPromise]);

            updateNodeStatus(node, 'SUCCESS', 'Hoàn thành');
            break; // Success - Exit Loop

        } catch (err) {
            // Check if Stopped
            if (err.message === 'Stopped') {
                updateNodeStatus(node, 'STOPPED', 'Đã dừng');
                break;
            }

            // If Timeout, we shouldn't retry? (User requirement implied retry logic applies generally)
            // But let's follow standard pattern: Retry on error.

            // CHECK RETRY
            if (currentRetry < maxRetry) {
                currentRetry++;
                updateNodeStatus(node, 'RETRY', `Lỗi: ${err.message}. Đợi thử lại (${currentRetry}/${maxRetry})...`);
                await sleep(2000); // Wait before retry
                continue; // Loop again
            }

            // Final Error Status
            if (err.message === 'Checkpoint') {
                updateNodeStatus(node, 'ERROR', 'Lỗi: Checkpoint');
            } else if (err.message === 'Timeout') {
                updateNodeStatus(node, 'ERROR', 'Lỗi: Timeout');
            } else {
                updateNodeStatus(node, 'ERROR', 'Lỗi không xác định');
            }
            break; // Exit loop
        }
    }

    activeThreads--;
}

function updateNodeStatus(node, status, msg) {
    if (!node || !node.data) return;

    // Direct update to avoid triggering onCellValueChanged (DB Save)
    node.data.processStatus = status;
    node.data.processMessage = msg;

    // Force refresh cell
    gridApi.refreshCells({
        rowNodes: [node],
        columns: ['process'],
        force: true
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
