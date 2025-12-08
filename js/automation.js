const { chromium } = require('playwright-core');

async function runProfile(account, config) {
    let browser = null;
    let context = null;

    try {
        console.log('Launching browser for', account.uid);

        // 1. KHỞI ĐỘNG TRÌNH DUYỆT (BROWSER LAUNCH)
        // Sử dụng Chromium core để khởi chạy trình duyệt
        browser = await chromium.launch({
            executablePath: config.chromePath, // Đường dẫn đến file chrome.exe của người dùng
            headless: config.headless === 'true', // Chế độ không giao diện (Headless) hoặc có giao diện (GUI)
            args: [
                '--no-sandbox', // Tắt sandbox để tránh lỗi quyền hạn trên một số môi trường
                '--disable-setuid-sandbox',
                '--disable-infobars', // Tắt thanh thông báo "Chrome đang được điều khiển bởi phần mềm tự động"
                '--window-position=0,0', // Đặt vị trí cửa sổ ở góc trên cùng bên trái
                '--ignore-certificate-errors', // Bỏ qua lỗi SSL/TLS
                '--ignore-certificate-errors-spki-list',
                '--disable-blink-features=AutomationControlled' // QUAN TRỌNG: Cố gắng ẩn dấu hiệu automation để tránh bị phát hiện
            ]
        });

        // 2. CẤU HÌNH CONTEXT (MÔI TRƯỜNG DUYỆT WEB)
        // Tạo một context mới biệt lập, thiết lập UserAgent và Viewport
        const contextOptions = {
            viewport: { width: 1280, height: 720 }, // Kích thước màn hình giả lập
            userAgent: account.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignoreHTTPSErrors: true // Bỏ qua lỗi HTTPS
        };

        // Xử lý Proxy nếu tài khoản có cấu hình
        if (account.proxy) {
            // Định dạng proxy hỗ trợ: 
            // 1. ip:port:user:pass (phổ biến)
            // 2. protocol://user:pass@host:port (chuẩn)
            // 3. ip:port (không mật khẩu)

            let proxyServer = account.proxy;
            let username, password;

            const parts = account.proxy.split(':');
            if (parts.length === 4) {
                // Trường hợp ip:port:user:pass
                proxyServer = `${parts[0]}:${parts[1]}`;
                username = parts[2];
                password = parts[3];
            } else if (parts.length === 2) {
                // Trường hợp ip:port
                proxyServer = account.proxy;
            }

            // Gán cấu hình proxy cho context
            contextOptions.proxy = {
                server: proxyServer
            };
            if (username && password) {
                contextOptions.proxy.username = username;
                contextOptions.proxy.password = password;
            }
        }

        context = await browser.newContext(contextOptions);

        // 3. LOAD COOKIES (ĐĂNG NHẬP BẰNG COOKIE)
        if (account.cookie) {
            try {
                // Chuyển đổi chuỗi cookie thành mảng object mà Playwright hiểu được
                const cookies = parseCookies(account.cookie);
                if (cookies.length > 0) {
                    // Thêm cookie vào context, gán domain là facebook.com
                    await context.addCookies(cookies.map(c => ({ ...c, domain: '.facebook.com', path: '/' })));
                }
            } catch (err) {
                console.warn('Lỗi khi thêm cookie', err);
            }
        }

        // 4. ĐIỀU HƯỚNG & THỰC THI (NAVIGATE)
        const page = await context.newPage();

        // Thiết lập thời gian chờ (timeout) cho navigation
        const navTimeout = config.timeout && config.timeout > 0 ? config.timeout * 1000 : 30000;

        // Truy cập vào trang chủ Facebook
        await page.goto('https://www.facebook.com/', { timeout: navTimeout, waitUntil: 'domcontentloaded' });

        // Chờ thêm một khoảng thời gian để đảm bảo trang load xong hoặc để người dùng thao tác
        // TODO: Có thể thay thế bằng logic kiểm tra selector cụ thể (ví dụ: chờ avatar xuất hiện)
        await page.waitForTimeout(5000);

        const title = await page.title();

        await browser.close();

        return { status: 'SUCCESS', message: `Đã mở xong: ${title}` };

    } catch (err) {
        console.error('Automation Error', err);
        if (browser) await browser.close().catch(() => { });

        // Kiểm tra lỗi trình duyệt bị đóng (Target closed / Protocol error)
        // Đây là lỗi thường gặp khi người dùng tắt trình duyệt thủ công
        const errMsg = err.message || '';
        if (errMsg.includes('Target closed') || errMsg.includes('closed') || errMsg.includes('Protocol error')) {
            return { status: 'ERROR', message: 'BrowserClosed' };
        }

        return { status: 'ERROR', message: err.message };
    }
}

/**
 * Hàm phân tích chuỗi cookie (key=value; key2=value2) thành mảng object
 */
function parseCookies(cookieStr) {
    return cookieStr.split(';').map(pair => {
        const [name, value] = pair.trim().split('=');
        return { name, value };
    }).filter(c => c.name && c.value);
}

module.exports = { runProfile };
