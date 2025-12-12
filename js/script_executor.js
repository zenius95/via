async function execute(page, item, config, onLog = () => { }) {
    try {
        // Timeout handling for navigation
        const navTimeout = config.timeout && config.timeout > 0 ? config.timeout * 1000 : 30000;

        onLog('Đang truy cập Facebook...');
        // Demo nav
        await page.goto('https://www.facebook.com/', { timeout: navTimeout, waitUntil: 'domcontentloaded' });

        await page.locator('[name="email"]').fill(item.uid)
        await page.locator('[name="pass"]').fill(item.password)

        await page.locator('[name="login"]').click()

        // Wait? Or just perform check?
        // If config.timeout is set for the whole process, we might want to wait OR do specific actions.
        // For this generic "Run Profile" feature, maybe just open and wait a bit?
        // Or wait for login selector?

        // Let's verify login
        // Check for specific element

        await page.waitForTimeout(500000); // Wait 5s to see

        return;

    } catch (err) {
        throw err;
    }
}

module.exports = { execute };
