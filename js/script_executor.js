const { authenticator } = require('otplib');

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
                    const secret = item.twoFa;
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
                await page.waitForTimeout(5000);

                // Retry logic if still on 2FA page
                if (page.url().includes('two_step_verification/two_factor')) {
                    onLog('2FA chưa thành công, thử lại...');
                    // Clear input if needed, sometimes simply refilling works or we need to clear first
                    // Assuming filling overwrites or we can clear manually if needed
                    await perform2FA();
                    await page.waitForTimeout(5000); // Wait again
                }

            } else {
                onLog('Không có mã 2FA trong dữ liệu tài khoản.');
            }
        }

        // Wait final check
        await page.waitForTimeout(5000);

        return;

    } catch (err) {
        throw err;
    }
}

module.exports = { execute };
