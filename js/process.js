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

    // Listen for status updates
    if (window.api && window.api.on) {
        window.api.on('process:update-status', ({ uid, message }) => {
            if (!gridApi) return;

            // Find node by UID
            const processNode = processQueue.find(n => n.data.uid === uid);
            // Also check running nodes if not in queue (but usually activeThreads are what we care about)
            // But getting node from grid API is safer to ensure we have the node reference

            // Iterate all nodes? Or use getRowNode? 
            // gridApi.forEachNode?
            // Since we don't have rowId set to uid, we might need to search.
            // But we can optimize if we rely on processQueue, but processQueue items are shifted out when running.
            // So we need to look up in grid.

            gridApi.forEachNode(node => {
                if (node.data && node.data.uid === uid) {
                    // Check if it's currently running/active? 
                    // We probably just trust the message.
                    // But we should respect "Stopped" state if local logic stopped it?
                    // The IPC comes from Main, so it IS running.
                    updateNodeStatus(node, 'RUNNING', message);
                }
            });
        });
    }
});

function toggleProcess() {
    if (isProcessRunning) {
        stopProcess();
    } else {
        startProcess();
    }
}

// Enhanced startProcess to support manual partial runs
async function startProcess(targetNodes = null, configOverrides = {}) {
    if (!gridApi) return;

    // Load Settings (Base Config)
    try {
        const settings = await window.api.send('db:get-settings');
        if (settings) {
            PROCESS_CONFIG.maxThreads = parseInt(settings.maxThreads) || 3;
            // Launch Delay is for automation. Manual might override.
            PROCESS_CONFIG.delay = (parseInt(settings.launchDelay) || 2) * 1000;
            PROCESS_CONFIG.retry = parseInt(settings.retryCount) || 0;
            PROCESS_CONFIG.timeout = parseInt(settings.timeout) || 0;
            PROCESS_CONFIG.chromePath = settings.chromePath || '';
            PROCESS_CONFIG.autoSplit = settings.autoSplit === 'true';
            PROCESS_CONFIG.splitRows = parseInt(settings.splitRows) || 2;
            PROCESS_CONFIG.splitCols = parseInt(settings.splitCols) || 2;
            // Reset defaults that might have been overridden previously
            PROCESS_CONFIG.keepOpen = false;
            PROCESS_CONFIG.headless = settings.headless; // Read from settings

            // Facebook Settings
            PROCESS_CONFIG.fbLoginCookie = settings.fbLoginCookie;
            PROCESS_CONFIG.fbGetFriends = settings.fbGetFriends;
            PROCESS_CONFIG.fbGetInfo = settings.fbGetInfo;
            PROCESS_CONFIG.fbGetQuality = settings.fbGetQuality;
            PROCESS_CONFIG.fbGetAdAccounts = settings.fbGetAdAccounts;
        }

        if (!PROCESS_CONFIG.chromePath) {
            console.log('Chrome Path missing, attempting auto-detect...');
            const detectedPath = await window.api.send('main:get-chrome-path');
            if (detectedPath) PROCESS_CONFIG.chromePath = detectedPath;
            else { showToast('Chưa cấu hình đường dẫn Chrome!', 'error'); return; }
        }

    } catch (err) { console.error('Failed to load config', err); }

    // APPLY OVERRIDES (For Manual Open Browser)
    Object.assign(PROCESS_CONFIG, configOverrides);

    const nodesToRun = targetNodes || gridApi.getSelectedNodes();
    if (nodesToRun.length === 0) {
        showToast('Vui lòng chọn tài khoản để chạy', 'warning');
        return;
    }

    // UPDATE UI (Common for both)
    const btn = document.getElementById('btn-start-process');
    if (btn) {
        btn.classList.add('bg-red-600', 'hover:bg-red-500', '!from-red-600', '!to-red-500', 'shadow-red-900/40');
        btn.innerHTML = `<i class="ri-stop-fill text-lg"></i><span class="ml-1">Dừng lại</span>`;
        btn.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
        btn.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
    }

    isProcessRunning = true;
    forceStop = false;
    processQueue = [...nodesToRun];

    // Reset status and Assign Layout Index
    processQueue.forEach((node, index) => {
        if (node.data) {
            node.data.layoutIndex = index;
            node.setDataValue('processStatus', 'WAITING');
            node.setDataValue('processMessage', configOverrides.keepOpen ? 'Đang chờ mở...' : 'Đang chờ...');
        }
    });

    const modeLabel = configOverrides.keepOpen ? 'trình duyệt thủ công' : 'tài khoản';
    showToast(`Bắt đầu chạy với ${processQueue.length} ${modeLabel}`, 'info');
    runQueueLoop();
}

async function startManualBrowser(targetNodes) {
    if (isProcessRunning) {
        showToast('Vui lòng dừng tiến trình hiện tại trước', 'error');
        return;
    }
    // Reuse startProcess with specific overrides
    await startProcess(targetNodes, {
        maxThreads: targetNodes.length,
        delay: 1000,
        keepOpen: true,
        headless: false // Force visible for manual mode
        // headless override removed to respect specific settings or global config if merged correctly above
        // But wait, startProcess loads settings which overwrites PROCESS_CONFIG values from DB
        // And then applies configOverrides (which is this object).
        // So if we don't pass headless here, it uses what startProcess loaded from DB.
        // Correct.
    });
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

            if (forceStop) throw new Error('Stopped');

            // --- INIT LOG ---
            // Format: YYYY-MM-DD_HH-mm-ss.txt
            const now = new Date();
            const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}.txt`;

            node.data.logFileName = fileName;
            await window.api.send('log:init', { uid: node.data.uid, fileName });

            updateNodeStatus(node, 'RUNNING', currentRetry > 0 ? `Bắt đầu lại (Lần ${currentRetry})...` : 'Đang khởi chạy...');

            // Create timeout promise
            const timeoutPromise = PROCESS_CONFIG.timeout > 0
                ? new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), PROCESS_CONFIG.timeout * 1000))
                : new Promise(() => { });

            // Action Promise
            const actionPromise = (async () => {
                if (forceStop) throw new Error('Stopped');

                // GUARD: Only update if this attempt is still active
                if (node.data.activeAttemptId === attemptId) {
                    updateNodeStatus(node, 'RUNNING', 'Đang mở trình duyệt...');
                }

                // Call IPC
                const result = await window.api.send('process:run-profile', {
                    account: node.data,
                    config: PROCESS_CONFIG
                });

                if (forceStop) throw new Error('Stopped');

                if (result && result.status === 'ERROR') {
                    throw new Error(result.message);
                }

                // Success - Message from automation
                if (result && result.status === 'SUCCESS' && result.data) {
                    const data = result.data;

                    // Update Node Data
                    node.data.token = data.accessToken;
                    // node.data.dtsg = data.dtsg; // Removed persistence as requested
                    // node.data.lsd = data.lsd;   // Removed persistence as requested
                    node.data.cookie = data.cookie; // Update Cookie
                    node.data.status = 'LIVE'; // Assume Live on success

                    if (data.userData) {
                        if (data.userData.name) node.data.name = data.userData.name;
                        if (data.userData.birthday) node.data.birthday = data.userData.birthday;
                        if (data.userData.friends !== undefined && data.userData.friends !== null) node.data.friends = data.userData.friends;

                        if (!node.data.email && data.userData.email) {
                            node.data.email = data.userData.email;
                        }

                        if (data.userData.picture && data.userData.picture.data) {
                            node.data.avatar = data.userData.picture.data.url;
                        }
                    }

                    // SAVE QUALITY DATA
                    if (data.qualityData) {
                        node.data.accountQuality = data.qualityData.status; // Save text status
                        // Maybe save color too? Or deduce it in UI?
                        // Let's save just the text status for now, or save full object if DB supports JSON?
                        // DB schema is flat. Let's add 'accountQuality' column.
                    }

                    // Log Ad Accounts Count (User Request) && SAVE TO DB
                    if (data.adAccounts && Array.isArray(data.adAccounts)) {
                        // Save to separate table
                        await window.api.send('db:save-ad-accounts', {
                            uid: node.data.uid,
                            adAccounts: data.adAccounts
                        });
                    }

                    // Save to DB
                    await window.api.send('db:update-account', node.data);

                    // Refresh Grid Row (to show Name/Avatar/Token/Status changes)
                    gridApi.applyTransaction({ update: [node.data] });
                }

                return;
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
            if (err.message === 'Checkpoint 282') {
                updateNodeStatus(node, 'ERROR', 'Checkpoint 282');
                node.data.status = 'Checkpoint 282';
                window.api.send('db:update-account', node.data);
                gridApi.applyTransaction({ update: [node.data] });

            } else if (err.message === 'notLogin') {
                updateNodeStatus(node, 'ERROR', 'Đăng nhập thất bại');

            } else if (err.message === 'Checkpoint 956') {
                updateNodeStatus(node, 'ERROR', 'Checkpoint 956');
                node.data.status = 'Checkpoint 956';
                window.api.send('db:update-account', node.data);
                gridApi.applyTransaction({ update: [node.data] });

            } else if (err.message === 'Timeout') {
                updateNodeStatus(node, 'ERROR', 'Lỗi: Timeout');
            } else if (err.message === 'BrowserClosed') {
                updateNodeStatus(node, 'ERROR', 'Đã tắt trình duyệt');
            } else {
                updateNodeStatus(node, 'ERROR', `Lỗi: ${err.message}`);
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
    // Direct update to avoid triggering onCellValueChanged (DB Save)
    node.data.processStatus = status;
    node.data.processMessage = msg;

    // Write Log
    if (node.data.logFileName) {
        window.api.send('log:write', {
            uid: node.data.uid,
            fileName: node.data.logFileName,
            message: `[${status}] ${msg}`
        });
    }

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
