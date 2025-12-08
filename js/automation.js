const { chromium } = require('playwright-core');

async function runProfile(account, config) {
    let browser = null;
    let context = null;

    try {
        console.log('Launching browser for', account.uid);

        // 1. Launch Browser
        browser = await chromium.launch({
            executablePath: config.chromePath, // Must be provided
            headless: config.headless === 'true',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--disable-blink-features=AutomationControlled' // Try to hide automation
            ]
        });

        // 2. Configure Context (Proxy, UserAgent, Viewport)
        const contextOptions = {
            viewport: { width: 1280, height: 720 },
            userAgent: account.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignoreHTTPSErrors: true
        };

        // Parse Proxy if exists
        if (account.proxy) {
            // Format: protocol://user:pass@host:port or host:port:user:pass or host:port
            // Simple logic for host:port or user:pass@host:port
            // Playwright expects: { server: 'http://myproxy:3128', username: 'usr', password: 'pwd' }

            // For now, let's assume standard formatting or simple handling
            // If complex parsing is needed, we might need a helper.
            // Let's assume the user provides a direct proxy string that Playwright might accept or simplistic parsing.
            // A common format in these tools is ip:port or ip:port:user:pass

            let proxyServer = account.proxy;
            let username, password;

            const parts = account.proxy.split(':');
            if (parts.length === 4) {
                // ip:port:user:pass
                proxyServer = `${parts[0]}:${parts[1]}`;
                username = parts[2];
                password = parts[3];
            } else if (parts.length === 2) {
                proxyServer = account.proxy;
            }

            contextOptions.proxy = {
                server: proxyServer
            };
            if (username && password) {
                contextOptions.proxy.username = username;
                contextOptions.proxy.password = password;
            }
        }

        context = await browser.newContext(contextOptions);

        // 3. Load Cookies
        if (account.cookie) {
            try {
                // Determine domain logic? Or add to all?
                // Playwright needs specific domain or url to add cookies if not specified in cookie obj.
                // If cookie string is 'c_user=...; xs=...', we need to parse.
                const cookies = parseCookies(account.cookie);
                if (cookies.length > 0) {
                    await context.addCookies(cookies.map(c => ({ ...c, domain: '.facebook.com', path: '/' })));
                }
            } catch (err) {
                console.warn('Error adding cookies', err);
            }
        }

        // 4. Navigate
        const page = await context.newPage();

        // Timeout handling for navigation
        const navTimeout = config.timeout && config.timeout > 0 ? config.timeout * 1000 : 30000;

        // Demo nav
        await page.goto('https://www.facebook.com/', { timeout: navTimeout, waitUntil: 'domcontentloaded' });

        // Wait? Or just perform check?
        // If config.timeout is set for the whole process, we might want to wait OR do specific actions.
        // For this generic "Run Profile" feature, maybe just open and wait a bit?
        // Or wait for login selector?

        // Let's verify login
        // Check for specific element

        await page.waitForTimeout(5000); // Wait 5s to see

        const title = await page.title();

        await browser.close();

        return { status: 'SUCCESS', message: `Đã mở xong: ${title}` };

    } catch (err) {
        console.error('Automation Error', err);
        if (browser) await browser.close().catch(() => { });

        // Check for browser close/disconnect errors
        const errMsg = err.message || '';
        if (errMsg.includes('Target closed') || errMsg.includes('closed') || errMsg.includes('Protocol error')) {
            return { status: 'ERROR', message: 'BrowserClosed' };
        }

        return { status: 'ERROR', message: err.message };
    }
}

function parseCookies(cookieStr) {
    return cookieStr.split(';').map(pair => {
        const [name, value] = pair.trim().split('=');
        return { name, value };
    }).filter(c => c.name && c.value);
}

module.exports = { runProfile };
