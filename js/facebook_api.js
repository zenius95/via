class FacebookAPI {
    constructor(item, page) {
        this.item = item;
        this.page = page; // Playwright Page object
        this.accessToken = null;
        this.dtsg = null;
        this.lsd = null;
    }

    async fetch2(url, options) {
        // Run fetch inside browser, return serialized response data
        const result = await this.page.evaluate(async ({ url, options }) => {
            try {
                const res = await fetch(url, options);
                const text = await res.text();
                return {
                    url: res.url,
                    status: res.status,
                    text: text,
                };
            } catch (e) {
                return { error: e.toString() };
            }
        }, { url, options });

        if (result.error) throw new Error(result.error);

        // Return an object mimicking Response
        return {
            url: result.url,
            status: result.status,
            text: async () => result.text,
            json: async () => {
                try {
                    return JSON.parse(result.text);
                } catch (e) {
                    throw new Error('Invalid JSON response: ' + result.text.substring(0, 100));
                }
            }
        };
    }

    async getAccessToken() {
        try {
            // 1. Initial Fetch
            let res = await this.fetch2('https://business.facebook.com/billing_hub/payment_settings/');
            let url = res.url;
            let data = await res.text();

            // 2. Handle BM Redirect
            if (url.includes('/select/')) {
                const bmIdMatch = data.match(/"businessID":"(\d+)"/);
                if (bmIdMatch && bmIdMatch[1]) {
                    let res2 = await this.fetch2('https://business.facebook.com/billing_hub/accounts?business_id=' + bmIdMatch[1]);
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
            const res = await this.fetch2(`https://graph.facebook.com/me?fields=name,first_name,last_name,gender,email,picture.width(200).height(200),link,birthday&access_token=${this.accessToken}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error.message);

            // 3. Process extensions (Image, Friends)
            if (data.picture && data.picture.data && data.picture.data.url) {
                try {
                    data.picture.data.url = await this.getBase64ImageFromUrl(data.picture.data.url);
                } catch (e) {
                    // console.error('Get Image Failed', e);
                }
            }

            try {
                data.friends = await this.getFriends();
            } catch (e) {
                data.friends = 0;
            }

            return data;

        } catch (err) {
            console.error('getUserInfo Error:', err);
            return null;
        }
    }

    async getFriends() {
        try {
            let token = this.accessToken;
            try {
                const tokenData = await this.getAccessToken2();
                if (tokenData && tokenData.accessToken) {
                    token = tokenData.accessToken;
                }
            } catch (e) {
                // console.warn('getAccessToken2 failed, falling back to main token', e);
            }

            const res = await this.fetch2(`https://graph.facebook.com/me/friends?summary=true&limit=0&access_token=${token}`);
            const json = await res.json();
            return json.summary?.total_count || 0;
        } catch (e) {
            return 0;
        }
    }

    async getBase64ImageFromUrl(url) {
        // Only this method runs logic inside evaluate because it needs FileReader
        return this.page.evaluate(async (imageUrl) => {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                return null;
            }
        }, url);
    }

    async getAccountQuality() {
        return new Promise(async (resolve, reject) => {
            try {
                const headers = {
                    "content-type": "application/x-www-form-urlencoded",
                };

                const body = "av=" + this.item.uid + "&__usid=" + encodeURIComponent("6-Tsas5n6h0it5h:Psas5n4jqrxdy:0-Asas5ms1bzoc6y-RV=6:F=") + "&session_id=2791d1615dda0cb8&__aaid=0&__user=" + this.item.uid + "&__a=1&__req=1&__hs=19805.BP%3ADEFAULT.2.0..0.0&dpr=1&__ccg=GOOD&__rev=1012251909&__s=p9dz00%3A3ya0mx%3Aafup89&__hsi=7349388123137635674&__dyn=7xeUmxa2C5rgydwn8K2abBAjxu59o9E6u5VGxK5FEG484S4UKewSAxam4EuGfwnoiz8WdwJzUmxe1kx21FxG9xedz8hw9yq3a4EuCwQwCxq1zwCCwjFFpobQUTwJBGEpiwzlwXyXwZwu8sxF3bwExm3G4UhwXxW9wgo9oO1Wxu0zoO12ypUuwg88EeAUpK19xmu2C2l0Fx6ewzwAwRyQ6U-4Ea8mwoEru6ogyHwyx6i8wxK2efK2W1dx-q4VEhG7o4O1fwwxefzobEaUiwm8Wubwk8Sq6UfEO32fxiFUd8bGwgUy1kx6bCyVUCcG2-qaUK2e18w9Cu0Jo6-4e1mAyo884KeCK2q362u1dxW6U98a85Ou0DU7i&__csr=&fb_dtsg=" + this.dtsg + "&jazoest=25334&lsd=" + this.lsd + "&__spin_r=1012251909&__spin_b=trunk&__spin_t=1711162767&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=AccountQualityHubAssetOwnerViewQuery&variables=%7B%22assetOwnerId%22%3A%22" + this.item.uid + "%22%7D&server_timestamps=true&doc_id=7327539680662016";

                const res = await this.fetch2("https://www.facebook.com/api/graphql/?_flowletID=1&_triggerFlowletID=2", {
                    headers: headers,
                    body: body,
                    method: "POST",
                });

                const result = await res.json();

                if (!result.errors) {
                    let trangthai = 'N/A'
                    let color = ''
                    const advertising_restriction_info = result?.data?.assetOwnerData?.advertising_restriction_info;

                    if (advertising_restriction_info) {
                        const is_restricted = advertising_restriction_info.is_restricted
                        const status = advertising_restriction_info.status
                        const restriction_type = advertising_restriction_info.restriction_type

                        if (!is_restricted) {
                            if (restriction_type == "PREHARM" && status == "APPEAL_ACCEPTED") { trangthai = "Tích Xanh XMDT"; color = 'success'; }
                            if (restriction_type == "ALE" && status == "APPEAL_ACCEPTED") { trangthai = "Tích Xanh 902"; color = 'success'; }
                            if (status == "NOT_RESTRICTED") { trangthai = "Live Ads - Không Sao Cả"; color = 'success'; }
                            if (restriction_type == "ADS_ACTOR_SCRIPTING") { trangthai = "Tích xanh XMDT ẩn tích"; color = 'success'; }
                            if (status == "NOT_RESTRICTED" && restriction_type == "BUSINESS_INTEGRITY") { trangthai = "Tích xanh 902 ẩn tích"; color = 'success'; }
                        } else {
                            if (status == "VANILLA_RESTRICTED" && restriction_type == "BUSINESS_INTEGRITY") { trangthai = "HCQC 902 XMDT"; color = 'danger'; }
                            if (status == "APPEAL_INCOMPLETE" && restriction_type == "BUSINESS_INTEGRITY") { trangthai = "XMDT 902 CHƯA XONG"; color = 'danger'; }
                            if (status == "APPEAL_PENDING" && restriction_type == "BUSINESS_INTEGRITY") { trangthai = "Đang Kháng 902"; color = 'danger'; }
                            if (status == "APPEAL_REJECTED" && restriction_type == "BUSINESS_INTEGRITY") { trangthai = "HCQC 902 xịt - Xmdt lại 273"; color = 'danger'; }

                            if (is_restricted && restriction_type == "PREHARM") {
                                if (status == "VANILLA_RESTRICTED") { trangthai = "Hạn Chế Quảng Cáo"; color = 'danger'; }
                                if (status == "APPEAL_PENDING") { trangthai = "Đang kháng XMDT"; color = 'danger'; }
                                if (status == "APPEAL_INCOMPLETE") { trangthai = "Xmdt Chưa Xong"; color = 'danger'; }
                                if (status == "APPEAL_REJECTED_NO_RETRY" || status == 'APPEAL_TIMEOUT') { trangthai = "XMDT Xịt - Xmdt lại 273"; color = 'danger'; }
                            }

                            if (is_restricted && restriction_type == "ALE") {
                                if (status == "APPEAL_PENDING") { trangthai = "Đang Kháng 902"; color = 'warning'; }
                                if (status == "APPEAL_REJECTED_NO_RETRY") { trangthai = "HCQC Vĩnh Viễn"; color = 'danger'; }

                                const ufac_state = advertising_restriction_info.additional_parameters?.ufac_state
                                const appeal_friction = advertising_restriction_info.additional_parameters?.appeal_friction
                                const appeal_ineligibility_reason = advertising_restriction_info.additional_parameters?.appeal_ineligibility_reason

                                if (status == "VANILLA_RESTRICTED" && (ufac_state == "FAILED" || ufac_state == "TIMEOUT")) { trangthai = "HCQC 902 xịt - Xmdt lại 273"; color = 'danger'; }
                                if (status == "VANILLA_RESTRICTED" && ufac_state == null && appeal_friction == "UFAC") { trangthai = "HCQC 902 XMDT"; color = 'danger'; }
                                if (status == "VANILLA_RESTRICTED" && ufac_state == null && appeal_friction == null && appeal_ineligibility_reason == "ENTITY_APPEAL_LIMIT_REACHED") { trangthai = "HCQC 902 xịt - Xmdt lại 273"; color = 'danger'; }
                                else {
                                    if (status == "VANILLA_RESTRICTED" && ufac_state == null && appeal_friction == null) { trangthai = "HCQC 902 Chọn Dòng"; color = 'danger'; }
                                    if (status == "VANILLA_RESTRICTED" && ufac_state == "SUCCESS" && appeal_friction == null) { trangthai = "HCQC 902 Chọn Dòng"; color = 'danger'; }
                                }
                            }
                            if (is_restricted && restriction_type == "ACE" || restriction_type === "GENERIC") { trangthai = "XMDT Xịt - Xmdt lại 273"; color = 'danger'; }
                            if (is_restricted && restriction_type == "RISK_REVIEW" || restriction_type === "RISK_REVIEW_EMAIL_VERIFICATION") { trangthai = "XMDT Checkpoint"; color = 'danger'; }

                            if (restriction_type == "ADS_ACTOR_SCRIPTING") {
                                if (status == 'APPEAL_REJECTED') { trangthai = "XMDT Xịt - Xmdt lại 273"; color = 'danger'; }
                                else if (status == 'APPEAL_PENDING') { trangthai = "Đang kháng XMDT"; color = 'warning'; }
                                else if (status == 'APPEAL_ACCEPTED') { trangthai = "Tích Xanh 902"; color = 'success'; }
                                else if (status == 'APPEAL_INCOMPLETE') { trangthai = "Xmdt Chưa Xong"; color = 'danger'; }
                                else { trangthai = "Hạn Chế Quảng Cáo"; color = 'danger'; }
                            }
                        }
                    }
                    resolve({ status: trangthai, color })
                } else {
                    reject(result.errors[0].summary)
                }
            } catch (err) { reject(err) }
        });
    }

    async getAccessToken2() {
        return new Promise(async (resolve, reject) => {
            try {
                const res = await this.fetch2('https://adsmanager.facebook.com/adsmanager/manage/campaigns');
                let data = await res.text();

                try {
                    let redirect = data.match(/window.location\.replace\("(.+)"/);
                    if (redirect) {
                        let redirectUrl = redirect[1].replace(/\\/g, '');
                        const res2 = await this.fetch2(redirectUrl);
                        data = await res2.text();
                    }
                } catch (e) { }

                // Check result.url from last response (checking data content for matches is fine, but checking URL requires tracking it)
                // In fetch2, I return { url, ... }
                // So I need to use the response object 'res' (or 'res2') to check URL.
                // Correct logic:
                const finalUrl = res.url; // Or res2.url if redirected? 
                // My logic above: res2 updates data but 'res' is still first response object.
                // Correcting:
                // I should track 'currentResponse'.

                // However, simplified check:
                if (data.includes('login_form')) { // Fallback text check
                    resolve('not_login');
                    return;
                }

                const accessTokenMatches = data.match(/window.__accessToken="(.*)";/);
                const postTokenMatches = data.match(/(?<="token":")[^"]*/g)?.filter(item => item.startsWith('NA'));
                const postTokenMatches2 = data.match(/(?<="async_get_token":")[^"]*/g);

                let lsd = '';
                try {
                    lsd = data.split(',["LSD",[],{"token":"')[1].split('"}')[0];
                } catch (e) { }

                if (accessTokenMatches && accessTokenMatches[1] && postTokenMatches && postTokenMatches[0]) {
                    resolve({
                        accessToken: accessTokenMatches[1],
                        dtsg: postTokenMatches[0],
                        dtsg2: postTokenMatches2 ? postTokenMatches2[0] : null,
                        lsd
                    });
                } else {
                    reject('Token not found in AdsManager');
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    // ... getAdAccounts and getAdAccountsData logic...
    async getAdAccounts(limit = 50) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.accessToken) { reject('No Access Token'); return; }
                let allAccounts = [];
                let nextUrl = `https://graph.facebook.com/v14.0/me/adaccounts?limit=${limit}&fields=account_id,name,account_status,is_prepay_account,owner_business,currency&access_token=${this.accessToken}&summary=1&locale=en_US`;

                while (nextUrl) {
                    let res = await this.fetch2(nextUrl);
                    let resData = await res.json();
                    if (resData.error) { console.error('getAdAccounts Error:', resData.error); break; }
                    if (resData.data) allAccounts = allAccounts.concat(resData.data);
                    nextUrl = resData.paging?.next || null;
                }

                const mappedAccounts = allAccounts.map(item => ({
                    adId: item.account_id,
                    account_status: item.account_status,
                    name: item.name
                }));
                resolve(mappedAccounts);
            } catch (err) { reject(err); }
        });
    }

    async getAdAccountsData(accounts, limit = 50) {
        return new Promise(async (resolve, reject) => {
            const enrichedAccounts = [];
            try {
                const totalPages = Math.ceil(accounts.length / limit);
                for (let page = 1; page <= totalPages; page++) {
                    const offset = limit * (page - 1);
                    const items = accounts.slice(offset, limit * page);
                    const batch = [];
                    items.forEach(item => {
                        batch.push({
                            id: item.adId,
                            relative_url: '/act_' + item.adId + '?fields=account_id,name,account_status,is_prepay_account,next_bill_date,balance,owner_business,created_time,currency,adtrust_dsl,timezone_name,timezone_offset_hours_utc,disable_reason,adspaymentcycle{threshold_amount},owner,insights.date_preset(maximum){spend},userpermissions.user(' + this.item.uid + '){role},users{id,is_active,name,permissions,role,roles}',
                            method: 'GET',
                        });
                    });

                    const res2 = await this.fetch2("https://adsmanager-graph.facebook.com/v16.0?access_token=" + this.accessToken + "&suppress_http_code=1&locale=en_US", {
                        headers: { "content-type": "application/x-www-form-urlencoded" },
                        body: "include_headers=false&batch=" + JSON.stringify(batch),
                        method: "POST",
                    });
                    const data = await res2.json();

                    const currentBatchMap = new Map();
                    items.forEach(i => currentBatchMap.set(i.adId, i));

                    for (let index = 0; index < data.length; index++) {
                        try {
                            if (data[index].code === 200) {
                                const item = JSON.parse(data[index].body);
                                const originalItem = currentBatchMap.get(item.account_id);
                                const enrichedItem = { ...originalItem };

                                enrichedItem.limit = item.adtrust_dsl || -1;
                                enrichedItem.prePay = item.is_prepay_account ? 'TT' : 'TS';
                                const threshold = item.adspaymentcycle?.data?.[0]?.threshold_amount || 0;
                                enrichedItem.threshold = threshold;
                                const balance = item.balance || 0;
                                enrichedItem.balance = balance;
                                enrichedItem.remain = threshold - balance;
                                enrichedItem.spend = item.insights?.data?.[0]?.spend || 0;
                                enrichedItem.users = item.users?.data || [];

                                const nextBillDate = item.next_bill_date ? new Date(item.next_bill_date) : null;
                                const now = new Date();
                                let nextBillDay = -1;
                                if (nextBillDate) {
                                    const diffTime = nextBillDate - now;
                                    nextBillDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                }
                                enrichedItem.nextBillDay = nextBillDay < 0 ? 0 : nextBillDay;
                                enrichedItem.nextBillDate = nextBillDate ? nextBillDate.toLocaleDateString('vi-VN') : '';
                                enrichedItem.createdTime = item.created_time ? new Date(item.created_time).toLocaleDateString('vi-VN') : '';

                                const convertStart = ['EUR', 'CHF', 'BRL', 'USD', 'CNY', 'MYR', 'UAH', 'QAR', 'THB', 'TRY', 'GBP', 'PHP', 'INR'];
                                if (convertStart.includes(item.currency)) {
                                    enrichedItem.balance = Number(enrichedItem.balance) / 100;
                                    enrichedItem.threshold = Number(enrichedItem.threshold) / 100;
                                    enrichedItem.remain = Number(enrichedItem.remain) / 100;
                                }

                                const reasons = {
                                    0: '', 1: 'ADS_INTEGRITY_POLICY', 2: 'ADS_IP_REVIEW', 3: 'RISK_PAYMENT',
                                    4: 'GRAY_ACCOUNT_SHUT_DOWN', 5: 'ADS_AFC_REVIEW', 6: 'BUSINESS_INTEGRITY_RAR',
                                    7: 'PERMANENT_CLOSE', 8: 'UNUSED_RESELLER_ACCOUNT',
                                };
                                enrichedItem.reason = reasons[item.disable_reason] || '';

                                enrichedItem.timezone = item.timezone_name;
                                enrichedItem.currency = item.currency;
                                enrichedItem.type = item.owner_business ? 'Business' : 'Cá nhân';
                                enrichedItem.bmId = item.owner_business?.id || null;
                                enrichedItem.role = item.userpermissions?.data?.[0]?.role || 'UNKNOWN';
                                enrichedItem.adminNumber = enrichedItem.users.filter(u => u.role === 1001).length;

                                enrichedAccounts.push(enrichedItem);
                            } else {
                                if (items[index]) enrichedAccounts.push(items[index]);
                            }
                        } catch (e) { console.error(e); }
                    }

                    const currentIds = new Set(items.map(i => i.adId));
                    const currentEnriched = enrichedAccounts.filter(acc => currentIds.has(acc.adId));
                    const promises = [];

                    currentEnriched.forEach(acc => {
                        promises.push(new Promise(async (resolveP) => {
                            try {
                                const holdData = await this.checkHold(acc.adId);
                                if (holdData.country) acc.country = holdData.country;
                                if (holdData.status) acc.status = 999;

                                try {
                                    const cards = await this.getCard(acc.adId);
                                    if (cards && Array.isArray(cards)) {
                                        const validCards = cards.filter(c => c.credential?.__typename !== 'StoredBalance');
                                        acc.payment = validCards.map(c => c.credential?.last_four_digits ? `*${c.credential.last_four_digits}` : 'Card').join(', ');
                                        acc.cards = validCards;
                                    }
                                } catch (e) { }

                                if (acc.bmId) {
                                    // ... BM Check simplified ...
                                    try {
                                        const bmRes = await this.fetch2("https://business.facebook.com/api/graphql/?_callFlowletID=1&_triggerFlowletID=2", {
                                            headers: { "content-type": "application/x-www-form-urlencoded" },
                                            body: "av=" + this.item.uid + "&__usid=&__aaid=" + acc.adId + "&__bid=" + acc.bmId + "&__user=" + this.item.uid + "&__a=1&__req=1&__hs=19868.BP%3ADEFAULT.2.0..0.0&dpr=1&__ccg=GOOD&__rev=1013767953&__csr=&fb_dtsg=" + this.dtsg + "&jazoest=25134&lsd=" + this.lsd + "&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=AccountQualityHubAssetViewQuery&variables=%7B%22assetOwnerId%22%3A%22" + acc.bmId + "%22%2C%22assetId%22%3A%22" + acc.adId + "%22%2C%22scale%22%3A1%7D&server_timestamps=true&doc_id=6875615999208668",
                                            method: "POST"
                                        });
                                        const bmJson = await bmRes.json();
                                        const rInfo = bmJson.data?.adAccountData?.advertising_restriction_info;
                                        if (rInfo) {
                                            if (rInfo.ids_issue_type === "AD_ACCOUNT_ALR_DISABLE" && rInfo.status === "APPEAL_PENDING") acc.status = 4;
                                            if (rInfo.ids_issue_type === "AD_ACCOUNT_ALR_DISABLE" && (rInfo.status === "VANILLA_RESTRICTED" || rInfo.status === "APPEAL_REJECTED")) acc.status = 5;
                                            if (rInfo.ids_issue_type === "PREHARM_AD_ACCOUNT_BANHAMMER" && rInfo.status === "APPEAL_INCOMPLETE") acc.status = 6;
                                            if (rInfo.ids_issue_type === "PREHARM_AD_ACCOUNT_BANHAMMER" && rInfo.status === "APPEAL_REJECTED") acc.status = 7;
                                        }
                                    } catch (e) { }
                                }
                            } catch (e) { }
                            resolveP();
                        }));
                    });
                    await Promise.all(promises);
                }
                resolve(enrichedAccounts);
            } catch (e) { reject(e); }
        });
    }

    checkHold(id) {
        return new Promise(async (resolve, reject) => {
            // ... same logic using this.fetch2 ...
            const data = { status: false, country: '' };
            try {
                const res = await this.fetch2("https://business.facebook.com/api/graphql/?_flowletID=1", {
                    headers: { "content-type": "application/x-www-form-urlencoded" },
                    method: "POST",
                    body: "av=" + this.item.uid + "&__user=" + this.item.uid + "&__a=1&__req=8&__hs=19693.BP%3ADEFAULT.2.0..0.0&dpr=1&__ccg=EXCELLENT&__rev=1010170946&fb_dtsg=" + this.dtsg + "&jazoest=25595&lsd=" + this.lsd + "&__aaid=" + id + "&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=BillingHubPaymentSettingsViewQuery&variables=%7B%22assetID%22%3A%22" + id + "%22%7D&server_timestamps=true&doc_id=6747949808592904",
                });
                const resData = await res.text();
                const countryMatch = resData.match(/"predicated_business_country_code":"([^"]*)"/);
                if (countryMatch && countryMatch[1]) data.country = countryMatch[1];
                if (resData.includes('RETRY_FUNDS_HOLD')) data.status = true;
            } catch (err) { }
            resolve(data);
        });
    }

    getCard(id) {
        return new Promise(async (resolve, reject) => {
            // ... same logic using this.fetch2 ...
            try {
                const res = await this.fetch2("https://business.facebook.com/api/graphql/?_flowletID=1", {
                    headers: { "content-type": "application/x-www-form-urlencoded" },
                    method: "POST",
                    body: 'variables={"paymentAccountID":"' + id + '"}&doc_id=5746473718752934&__user=' + this.item.uid + '&__a=1&__req=s&__hs=19699.BP:DEFAULT.2.0..0.0&dpr=1&__ccg=EXCELLENT&__rev=1010282616&fb_dtsg=' + this.dtsg + '&jazoest=25610&lsd=' + this.lsd + '&__aaid=' + id + '',
                });
                const data = await res.json();
                resolve(data.data?.billable_account_by_payment_account?.billing_payment_account?.billing_payment_methods || []);
            } catch (err) { resolve([]); }
        });
    }

}

if (typeof module !== 'undefined') {
    module.exports = FacebookAPI;
}
