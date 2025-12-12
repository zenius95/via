class FacebookAPI {
    constructor(item) {
        this.item = item;
        this.accessToken = null;
        this.dtsg = null;
        this.lsd = null;
    }

    async getAccessToken() {
        try {
            // 1. Initial Fetch
            let res = await fetch('https://business.facebook.com/billing_hub/payment_settings/');
            let url = res.url;
            let data = await res.text();

            // 2. Handle BM Redirect
            if (url.includes('/select/')) {
                const bmIdMatch = data.match(/"businessID":"(\d+)"/);
                if (bmIdMatch && bmIdMatch[1]) {
                    let res2 = await fetch('https://business.facebook.com/billing_hub/accounts?business_id=' + bmIdMatch[1]);
                    data = await res2.text();
                    url = res2.url;
                }
            }

            // 3. Check Status
            if (url.includes('login') || url.includes('index.php?next')) {
                return { status: 'not_login' };
            }

            if (url.includes('/checkpoint/1501092823525282')) return { status: '282' };
            if (url.includes('/checkpoint/828281030927956')) return { status: '956' };

            // 4. Extract Token & Data
            const accessToken = data.match(/"accessToken":"(EAAG[^"]+)"/)?.[1];

            if (accessToken) {
                const dtsg = data.match(/"token":"(NA[^"]+)"/)?.[1] || data.match(/"async_get_token":"([^"]+)"/)?.[1];
                const lsd = data.match(/\["LSD",\[\],\{"token":"([^"]+)"\}\]/)?.[1];

                this.accessToken = accessToken;
                this.dtsg = dtsg;
                this.lsd = lsd;

                return {
                    status: 'success',
                    accessToken,
                    dtsg,
                    lsd
                };
            }

            return { status: 'unknown', message: 'Không tìm thấy Access Token' };

        } catch (err) {
            return { status: 'error', message: err.toString() };
        }
    }

    async getUserInfo() {
        try {
            if (!this.accessToken) throw new Error('No Access Token');

            // 2. Fetch User Info
            const res = await fetch(`https://graph.facebook.com/me?fields=name,first_name,last_name,gender,email,picture.width(200).height(200),link,birthday&access_token=${this.accessToken}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error.message);

            // 3. Process extensions (Image, Friends)
            if (data.picture && data.picture.data && data.picture.data.url) {
                try {
                    data.picture.data.url = await this.getBase64ImageFromUrl(data.picture.data.url);
                } catch (e) { }
            }

            try {
                data.friends = await this.getFriends();
            } catch (e) {
                data.friends = 0;
            }

            // 4. Save to Local Storage (Clone Data logic)
            // Skipping complex clone logic for now unless explicitly needed implies full replication.
            // Will return data for script_executor to handle or save if running in browser context.

            return data;

        } catch (err) {
            console.error('getUserInfo Error:', err);
            return null;
        }
    }

    async getFriends() {
        // Simple graph fetch for friends count (summary)
        try {
            // 'friends' edge usually requires permissions, but we can try generic or internal
            // Using graphql or mobile API is more reliable for real count, but simpler here:
            const res = await fetch(`https://graph.facebook.com/me/friends?summary=true&access_token=${this.accessToken}`);
            const json = await res.json();
            return json.summary?.total_count || 0;
        } catch (e) {
            return 0;
        }
    }

    async getBase64ImageFromUrl(url) {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

if (typeof window !== 'undefined') {
    window.FacebookAPI = FacebookAPI;
}

if (typeof module !== 'undefined') {
    module.exports = FacebookAPI;
}
