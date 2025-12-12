const { authenticator } = require('otplib');
const fs = require('fs');
const path = require('path');

async function execute(page, item, config, onLog = () => { }) {
    try {
        // Timeout handling for navigation
        const navTimeout = config.timeout && config.timeout > 0 ? config.timeout * 1000 : 30000;

        onLog('Đang truy cập Facebook...');

        // Demo nav
        await page.goto('https://www.facebook.com/', { timeout: navTimeout, waitUntil: 'domcontentloaded' });

        onLog('Đang nhập thông tin tài khoản...')

        await page.locator('[name="email"]').fill(item.uid)
        await page.locator('[name="pass"]').fill(item.password)

        await page.locator('[name="login"]').click()

        // Wait for login or 2FA redirection
        try {
            await page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' });
        } catch (e) {
            // Ignore timeout if navigation doesn't happen immediately (spa or slow)
        }

        // Check for 2FA
        if (page.url().includes('two_step_verification/two_factor')) {
            onLog('Phát hiện yêu cầu 2FA...');
            if (item.twoFa) {
                const perform2FA = async () => {
                    const secret = item.twoFa.replace(/\s+/g, '');
                    const token = authenticator.generate(secret);
                    onLog(`Nhập mã 2FA: ${token}`);

                    const inputSelector = 'form input[type="text"]'; // Usually 6 digit code input

                    // Ensure element is visible
                    await page.waitForSelector(inputSelector, { timeout: 5000 });

                    await page.locator(inputSelector).fill(token);
                    await page.keyboard.press('Enter');
                };

                await perform2FA();

                // Wait to see if it worked
                await page.waitForTimeout(10000);

                // Retry logic if still on 2FA page
                if (page.url().includes('two_step_verification/two_factor')) {
                    onLog('2FA chưa thành công, thử lại...');

                    await page.waitForTimeout(2000)

                    try {
                        await perform2FA();
                        await page.waitForTimeout(5000); // Wait again
                    } catch (retryErr) {
                        onLog(`Lưu ý: Thử lại 2FA không thành công hoặc đã chuyển trang (${retryErr.message}).`);
                    }
                } else {
                    onLog('Nhập 2FA thành công.');
                }

                // Check for Remember Browser screen
                if (page.url().includes('two_factor/remember_browser')) {
                    onLog('Đang tin cậy thiết bị...');
                    // Selector: form[method="GET"] + div (The button usually is inside that div or the div itself acts as button wrapper)
                    // User said "click vào selector form[method="GET"] + div"
                    try {
                        const rememberSelector = 'form[method="GET"] + div';
                        await page.waitForSelector(rememberSelector, { timeout: 5000 });
                        await page.locator(rememberSelector).click();
                        await page.waitForTimeout(3000); // Wait for next nav
                    } catch (err) {
                        onLog(`Lỗi khi tin cậy thiết bị: ${err.message}`);
                    }
                }

            } else {
                onLog('Không có mã 2FA trong dữ liệu tài khoản.');
            }
        }

        // Wait final check
        // --- LOGIN VERIFICATION & TOKEN GET ---
        onLog('Đang kiểm tra trạng thái đăng nhập...');

        // Wait a bit for final load
        await page.waitForTimeout(5000);

        // Read FacebookAPI class source
        const apiSource = fs.readFileSync(path.join(__dirname, 'facebook_api.js'), 'utf8');

        // Execute in browser
        const loginStatus = await page.evaluate(async ({ apiSource, item }) => {
            // Inject Class Definition
            try {
                // Use window.eval to execute in global scope
                window.eval(apiSource);

                // Instantiate from window
                const FacebookAPI = window.FacebookAPI;
                const fb = new FacebookAPI(item);

                // Run check
                const status = await fb.getAccessToken();

                if (status.status === 'success') {
                    // Try getting User Info if token is valid
                    try {
                        const userData = await fb.getUserInfo();
                        if (userData) status.userData = userData;
                    } catch (e) { }
                }

                return status;
            } catch (evalErr) {
                return { status: 'error', message: 'Evaluation Error: ' + evalErr.toString() };
            }

        }, { apiSource, item });

        if (loginStatus.status === 'success') {
            onLog(`Đăng nhập thành công! Token: ${loginStatus.accessToken.substring(0, 15)}...`);

            // Get Cookies
            const cookies = await page.context().cookies();
            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            loginStatus.cookie = cookieStr;

            if (loginStatus.userData) {
                console.log(loginStatus.userData)
            }
            // You might want to save this token or return it
            return { status: 'SUCCESS', data: loginStatus };
        } else if (loginStatus.status === 'not_login') {
            onLog('Chưa đăng nhập thành công.');
            throw new Error('NotLoggedIn');
        } else if (loginStatus.status === '282') {
            onLog('Checkpoint 282!');
            throw new Error('Checkpoint 282');
        } else if (loginStatus.status === '956') {
            onLog('Checkpoint 956!');
            throw new Error('Checkpoint 956');
        } else {
            onLog(`Trạng thái không xác định: ${loginStatus.message || loginStatus.status}`);
        }

        await page.waitForTimeout(500000);

        return;

    } catch (err) {
        throw err;
    }
}

module.exports = { execute };
