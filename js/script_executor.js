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

        // Check for c_user cookie
        const currentCookies = await page.context().cookies();
        const hasCUser = currentCookies.some(c => c.name === 'c_user');

        if (!hasCUser) {
            onLog('Đang nhập thông tin tài khoản...')

            await page.locator('[name="email"]').fill(item.uid)
            await page.locator('[name="pass"]').fill(item.password)

            await page.locator('[name="login"]').click()

            // Wait for login or 2FA redirection
            try {
                await page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' });
            } catch (e) {
            }

            // Check for 2FA
            if (page.url().includes('two_step_verification/two_factor')) {
                onLog('Phát hiện yêu cầu 2FA...');
                if (item.twoFa) {
                    const perform2FA = async () => {
                        const secret = item.twoFa.replace(/\s+/g, '');
                        const token = authenticator.generate(secret);
                        onLog(`Nhập mã 2FA: ${token}`);

                        const inputSelector = 'form input[type="text"]';

                        await page.waitForSelector(inputSelector, { timeout: 5000 });

                        await page.locator(inputSelector).fill(token);
                        await page.keyboard.press('Enter');
                    };

                    await perform2FA();
                    await page.waitForTimeout(10000);

                    if (page.url().includes('two_step_verification/two_factor')) {
                        onLog('2FA chưa thành công, thử lại...');
                        await page.waitForTimeout(2000)
                        try {
                            await perform2FA();
                            await page.waitForTimeout(5000);
                        } catch (retryErr) {
                            onLog(`Lưu ý: Thử lại 2FA không thành công (${retryErr.message}).`);
                        }
                    } else {
                        onLog('Nhập 2FA thành công.');
                    }

                    if (page.url().includes('two_factor/remember_browser')) {
                        onLog('Đang tin cậy thiết bị...');
                        try {
                            const rememberSelector = 'form[method="GET"] + div';
                            await page.waitForSelector(rememberSelector, { timeout: 5000 });
                            await page.locator(rememberSelector).click();
                            await page.waitForTimeout(3000);
                        } catch (err) {
                            onLog(`Lỗi khi tin cậy thiết bị: ${err.message}`);
                        }
                    }
                } else {
                    onLog('Không có mã 2FA trong dữ liệu tài khoản.');
                }
            }
        } else {
            onLog('Phát hiện cookie c_user, bỏ qua bước đăng nhập.');
        }

        // --- LOGIN VERIFICATION & TOKEN GET ---
        onLog('Đang kiểm tra trạng thái đăng nhập...');

        // Wait a bit for final load
        await page.waitForTimeout(5000);

        // Read FacebookAPI class source
        const apiSource = fs.readFileSync(path.join(__dirname, 'facebook_api.js'), 'utf8');

        // Execute in browser
        const loginStatus = await page.evaluate(async ({ apiSource, item }) => {
            try {
                window.eval(apiSource);
                const FacebookAPI = window.FacebookAPI;
                const fb = new FacebookAPI(item);

                // 1. Check Existing Token if available
                if (item.token) {
                    fb.accessToken = item.token;
                    try {
                        const userData = await fb.getUserInfo();
                        if (userData && !userData.error) {
                            // Token is valid!
                            // Get DTSG/LSD anyway? Not easy without page scrape, but 
                            // user requirement: "If item has access token -> check using fb.getUserInfo()."
                            // If success -> We can assume we don't need to re-scrape dtsg/lsd immediately 
                            // OR we should still try to scrape them if we are on a page that has them?
                            // Usually simple verify is enough.
                            // But better Return FULL Data.

                            // Let's scrape DTSG/LSD from current page context just in case, it's cheap?
                            // Actually getAccessToken does navigation. We want to avoid navigation if possible.

                            return {
                                status: 'success',
                                accessToken: item.token,
                                userData: userData,
                                source: 'cache_verify' // Flag to know we used cache
                            };
                        }
                    } catch (e) {
                        // UserInfo failed -> Token invalid -> Proceed to getAccessToken
                    }
                }

                // 2. Main Flow: Get Token from Page (Billing/Source)
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
