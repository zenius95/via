async function execute(page, config, onLog = () => { }) {
    try {
        // Timeout handling for navigation
        const navTimeout = config.timeout && config.timeout > 0 ? config.timeout * 1000 : 30000;

        onLog('Đang truy cập Facebook...');
        // Demo nav
        await page.goto('https://www.facebook.com/', { timeout: navTimeout, waitUntil: 'domcontentloaded' });

        onLog('Đang kiểm tra tiêu đề...');

        // Wait? Or just perform check?
        // If config.timeout is set for the whole process, we might want to wait OR do specific actions.
        // For this generic "Run Profile" feature, maybe just open and wait a bit?
        // Or wait for login selector?

        // Let's verify login
        // Check for specific element

        await page.waitForTimeout(5000); // Wait 5s to see

        return;

    } catch (err) {
        throw err;
    }
}

module.exports = { execute };
