const { authenticator } = require('otplib');
const fs = require('fs');
const path = require('path');

async function execute(page, item, config, onLog = () => { }) {
    try {
        // Timeout handling for navigation
        const navTimeout = config.timeout && config.timeout > 0 ? config.timeout * 1000 : 30000;

        onLog(config.fbLoginCookie === 'true' ? 'Đang thử đăng nhập bằng Cookie...' : 'Đang truy cập Facebook...');

        // Demo nav
        await page.goto('https://www.facebook.com/', { timeout: navTimeout, waitUntil: 'domcontentloaded' });

        // Check for c_user cookie
        const currentCookies = await page.context().cookies();
        const hasCUser = currentCookies.some(c => c.name === 'c_user');

        if (hasCUser && config.fbLoginCookie === 'true') {
            onLog('Cookie hợp lệ. Đã đăng nhập.');
        }

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
        const loginStatus = await page.evaluate(async ({ apiSource, item, config }) => {
            try {

                window.eval(apiSource);
                const FacebookAPI = window.FacebookAPI;
                const fb = new FacebookAPI(item);
                // 2. Main Flow: Get Token from Page (Billing/Source)
                const status = await fb.getAccessToken();

                if (status.status === 'success') {
                    // config is now passed correctly
                    // const config = item.config || {}; // No longer needed
                    const shouldGetInfo = config.fbGetInfo === 'true';
                    const shouldGetFriends = config.fbGetFriends === 'true';
                    const shouldGetQuality = config.fbGetQuality === 'true';

                    console.log('Config received:', config);

                    // CONDITIONAL: User Info
                    if (shouldGetInfo) {
                        try {
                            const userData = await fb.getUserInfo();
                            if (userData) {
                                status.userData = status.userData || {};
                                Object.assign(status.userData, userData);
                            }
                        } catch (e) {
                            console.error("Get User Info Failed", e);
                        }
                    }

                    // CONDITIONAL: Friends
                    if (shouldGetFriends) {
                        try {
                            const friendsCount = await fb.getFriends();
                            console.log('Friends Found:', friendsCount);
                            if (friendsCount !== null && friendsCount !== undefined) {
                                status.userData = status.userData || {};
                                status.userData.friends = friendsCount;
                            }
                        } catch (e) {
                            console.error("Get Friends Failed", e);
                        }
                    }

                    // CONDITIONAL: Account Quality
                    if (shouldGetQuality) {
                        try {
                            const qualityData = await fb.getAccountQuality();
                            if (qualityData) status.qualityData = qualityData;
                        } catch (e) {
                            console.error("Check Quality Failed", e);
                        }
                    }
                }

                return status;
            } catch (evalErr) {
                return { status: 'error', message: 'Evaluation Error: ' + evalErr.toString() };
            }

        }, { apiSource, item, config });

        if (loginStatus.status === 'success') {
            onLog(`Đăng nhập thành công!`);

            // Get Cookies
            const cookies = await page.context().cookies();
            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            loginStatus.cookie = cookieStr;

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

        await page.waitForTimeout(config.keepOpen ? 100 : 2000);

        return;

    } catch (err) {
        throw err;
    }
}

module.exports = { execute };
