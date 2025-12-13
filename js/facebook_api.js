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

    async getAccountQuality() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.accessToken || !this.dtsg || !this.lsd) { // Ensure we have required tokens
                    // Try to get them if missing? Or assume they are set.
                    // Usually set by getAccessToken
                }

                // Default headers for Graph API
                const headers = {
                    "content-type": "application/x-www-form-urlencoded",
                };

                const body = "av=" + this.item.uid + "&__usid=" + encodeURIComponent("6-Tsas5n6h0it5h:Psas5n4jqrxdy:0-Asas5ms1bzoc6y-RV=6:F=") + "&session_id=2791d1615dda0cb8&__aaid=0&__user=" + this.item.uid + "&__a=1&__req=1&__hs=19805.BP%3ADEFAULT.2.0..0.0&dpr=1&__ccg=GOOD&__rev=1012251909&__s=p9dz00%3A3ya0mx%3Aafup89&__hsi=7349388123137635674&__dyn=7xeUmxa2C5rgydwn8K2abBAjxu59o9E6u5VGxK5FEG484S4UKewSAxam4EuGfwnoiz8WdwJzUmxe1kx21FxG9xedz8hw9yq3a4EuCwQwCxq1zwCCwjFFpobQUTwJBGEpiwzlwXyXwZwu8sxF3bwExm3G4UhwXxW9wgo9oO1Wxu0zoO12ypUuwg88EeAUpK19xmu2C2l0Fx6ewzwAwRyQ6U-4Ea8mwoEru6ogyHwyx6i8wxK2efK2W1dx-q4VEhG7o4O1fwwxefzobEaUiwm8Wubwk8Sq6UfEO32fxiFUd8bGwgUy1kx6bCyVUCcG2-qaUK2e18w9Cu0Jo6-4e1mAyo884KeCK2q362u1dxW6U98a85Ou0DU7i&__csr=&fb_dtsg=" + this.dtsg + "&jazoest=25334&lsd=" + this.lsd + "&__spin_r=1012251909&__spin_b=trunk&__spin_t=1711162767&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=AccountQualityHubAssetOwnerViewQuery&variables=%7B%22assetOwnerId%22%3A%22" + this.item.uid + "%22%7D&server_timestamps=true&doc_id=7327539680662016";

                const res = await fetch("https://www.facebook.com/api/graphql/?_flowletID=1&_triggerFlowletID=2", {
                    headers: headers,
                    body: body,
                    method: "POST",
                });

                // const result = res.json // User code had res.json property access error? No, fetch returns response object.
                const result = await res.json();

                if (!result.errors) {

                    let trangthai = 'N/A'
                    let color = ''

                    // Safe access
                    const advertising_restriction_info = result?.data?.assetOwnerData?.advertising_restriction_info;

                    if (advertising_restriction_info) {
                        const is_restricted = advertising_restriction_info.is_restricted
                        const status = advertising_restriction_info.status
                        const restriction_type = advertising_restriction_info.restriction_type

                        if (!is_restricted) {

                            if (restriction_type == "PREHARM" && status == "APPEAL_ACCEPTED") {
                                trangthai = "Tích Xanh XMDT"
                                color = 'success'
                            }

                            if (restriction_type == "ALE" && status == "APPEAL_ACCEPTED") {
                                trangthai = "Tích Xanh 902"
                                color = 'success'
                            }

                            if (status == "NOT_RESTRICTED") {
                                trangthai = "Live Ads - Không Sao Cả"
                                color = 'success'
                            }

                            if (restriction_type == "ADS_ACTOR_SCRIPTING") {
                                trangthai = "Tích xanh XMDT ẩn tích"
                                color = 'success'
                            }

                            if (status == "NOT_RESTRICTED" && restriction_type == "BUSINESS_INTEGRITY") {
                                trangthai = "Tích xanh 902 ẩn tích"
                                color = 'success'
                            }


                        } else {

                            if (status == "VANILLA_RESTRICTED" && restriction_type == "BUSINESS_INTEGRITY") {
                                trangthai = "HCQC 902 XMDT"
                                color = 'danger'
                            }

                            if (status == "APPEAL_INCOMPLETE" && restriction_type == "BUSINESS_INTEGRITY") {
                                trangthai = "XMDT 902 CHƯA XONG"
                                color = 'danger'
                            }

                            if (status == "APPEAL_PENDING" && restriction_type == "BUSINESS_INTEGRITY") {
                                trangthai = "Đang Kháng 902"
                                color = 'danger'
                            }
                            if (status == "APPEAL_REJECTED" && restriction_type == "BUSINESS_INTEGRITY") {
                                trangthai = "HCQC 902 xịt - Xmdt lại 273"
                                color = 'danger'
                            }


                            if (is_restricted && restriction_type == "PREHARM") {

                                if (status == "VANILLA_RESTRICTED") {
                                    trangthai = "Hạn Chế Quảng Cáo"
                                    color = 'danger'
                                }

                                if (status == "APPEAL_PENDING") {
                                    trangthai = "Đang kháng XMDT"
                                    color = 'danger'
                                }

                                if (status == "APPEAL_INCOMPLETE") {
                                    trangthai = "Xmdt Chưa Xong"
                                    color = 'danger'
                                }

                                if (status == "APPEAL_REJECTED_NO_RETRY" || status == 'APPEAL_TIMEOUT' || status == 'APPEAL_TIMEOUT') {
                                    trangthai = "XMDT Xịt - Xmdt lại 273"
                                    color = 'danger'
                                }

                            }

                            if (is_restricted && restriction_type == "ALE") {

                                if (status == "APPEAL_PENDING") {
                                    trangthai = "Đang Kháng 902";
                                    color = 'warning'
                                }

                                if (status == "APPEAL_REJECTED_NO_RETRY") {
                                    trangthai = "HCQC Vĩnh Viễn";
                                    color = 'danger'
                                }

                                const ufac_state = advertising_restriction_info.additional_parameters?.ufac_state
                                const appeal_friction = advertising_restriction_info.additional_parameters?.appeal_friction
                                const appeal_ineligibility_reason = advertising_restriction_info.additional_parameters?.appeal_ineligibility_reason

                                if (status == "VANILLA_RESTRICTED" && ufac_state == "FAILED" || status == "VANILLA_RESTRICTED" && ufac_state == "TIMEOUT") {
                                    trangthai = "HCQC 902 xịt - Xmdt lại 273"
                                    color = 'danger'

                                }

                                if (status == "VANILLA_RESTRICTED" && ufac_state == null && appeal_friction == "UFAC") {
                                    trangthai = "HCQC 902 XMDT"
                                    color = 'danger'
                                }

                                if (status == "VANILLA_RESTRICTED" && ufac_state == null && appeal_friction == null && appeal_ineligibility_reason == "ENTITY_APPEAL_LIMIT_REACHED") {
                                    trangthai = "HCQC 902 xịt - Xmdt lại 273"
                                    color = 'danger'

                                } else {

                                    if (status == "VANILLA_RESTRICTED" && ufac_state == null && appeal_friction == null) {
                                        trangthai = "HCQC 902 Chọn Dòng"
                                        color = 'danger'
                                    }

                                    if (status == "VANILLA_RESTRICTED" && ufac_state == "SUCCESS" && appeal_friction == null) {
                                        trangthai = "HCQC 902 Chọn Dòng"
                                        color = 'danger'
                                    }
                                }

                            }

                            if (is_restricted && restriction_type == "ACE" || restriction_type === "GENERIC") {
                                trangthai = "XMDT Xịt - Xmdt lại 273"
                                color = 'danger'
                            }

                            if (is_restricted && restriction_type == "RISK_REVIEW" || restriction_type === "RISK_REVIEW_EMAIL_VERIFICATION") {
                                trangthai = "XMDT Checkpoint"
                                color = 'danger'
                            }

                            if (restriction_type == "ADS_ACTOR_SCRIPTING") {


                                if (status == 'APPEAL_REJECTED') {

                                    trangthai = "XMDT Xịt - Xmdt lại 273"
                                    color = 'danger'

                                } else if (status == 'APPEAL_PENDING') {

                                    trangthai = "Đang kháng XMDT"
                                    color = 'warning'

                                } else if (status == 'APPEAL_ACCEPTED') {

                                    trangthai = "Tích Xanh 902"
                                    color = 'success'

                                } else if (status == 'APPEAL_INCOMPLETE') {

                                    trangthai = "Xmdt Chưa Xong"

                                    color = 'danger'

                                }
                                else {

                                    trangthai = "Hạn Chế Quảng Cáo"
                                    color = 'danger'

                                }
                            }
                        }
                    } else {
                        // Data structure mismatch
                        // console.log("Missing advertising_restriction_info", result);
                    }

                    resolve({ status: trangthai, color })

                } else {
                    reject(result.errors[0].summary)
                }

            } catch (err) {
                reject(err)
            }

        })
    }

    async getUserInfo() {
        return new Promise(async (resolve, reject) => {
            try {
                // ... (existing getUserInfo logic)
                const uid = this.uid;
                const token = this.accessToken;

                // Simple User Info Query
                const responses = await Promise.all([
                    fetch(`https://graph.facebook.com/me?access_token=${token}&fields=id,name,birthday,email,picture.width(100).height(100)`).then(res => res.json())
                ]);

                const basicInfo = responses[0];

                if (basicInfo.error) {
                    reject(basicInfo.error);
                    return;
                }

                resolve({
                    id: basicInfo.id,
                    name: basicInfo.name,
                    birthday: basicInfo.birthday,
                    email: basicInfo.email,
                    picture: basicInfo.picture,
                    // Friends removed from here
                });

            } catch (err) {
                reject(err);
            }
        });
    }

    async getFriends() {
        return new Promise(async (resolve, reject) => {
            try {
                // Use getAccessToken2 to get a fresh token for friends fetching
                const tokenData = await this.getAccessToken2();
                let token = this.accessToken; // Default to main token

                if (tokenData && tokenData.accessToken) {
                    token = tokenData.accessToken;
                }

                const res = await fetch(`https://graph.facebook.com/me/friends?access_token=${token}&summary=true&limit=0`);
                const data = await res.json();

                if (data.summary) {
                    resolve(data.summary.total_count);
                } else {
                    resolve(null);
                }
            } catch (e) {
                // If getAccessToken2 fails, we might still try with this.accessToken? 
                // Or just fail. User instruction implies we MUST use this new token type usually.
                // But let's try fallback or just reject?
                // For now, if getAccessToken2 fails (rejects), we catch it here.
                // Let's fallback to main token if specific token fails?
                // User said "loại này... chỉ để dùng cho getFriends".
                // I will assume if it fails, we return 0 or null as before.
                // Actually, let's look at the catch block.
                console.error("getFriends failed using token2", e);
                reject(e);
            }
        });
    }

    getAccessToken2() {
        return new Promise(async (resolve, reject) => {
            try {
                const res = await fetch('https://adsmanager.facebook.com/adsmanager/manage/campaigns');
                let data = await res.text();

                try {
                    let redirect = data.match(/window.location\.replace\("(.+)"/);
                    if (redirect) {
                        let redirectUrl = redirect[1].replace(/\\/g, '');
                        const res2 = await fetch(redirectUrl);
                        data = await res2.text();
                    }
                } catch (e) { }

                if (res.url.includes('login') || res.url.includes('index.php?next')) {
                    resolve('not_login');
                } else if (res.url.includes('/checkpoint/1501092823525282')) {
                    resolve('282');
                } else if (res.url.includes('/checkpoint/828281030927956')) {
                    resolve('956');
                } else {
                    const accessTokenMatches = data.match(/window.__accessToken="(.*)";/);
                    const postTokenMatches = data.match(/(?<="token":")[^"]*/g)?.filter(item => item.startsWith('NA'));
                    const postTokenMatches2 = data.match(/(?<="async_get_token":")[^"]*/g);

                    // Safe logic for LSD
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
                }
            } catch (err) {
                reject(err);
            }
        });
    }
    async getAdAccounts(limit = 50) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.accessToken) {
                    reject('No Access Token');
                    return;
                }

                let allAccounts = [];
                let nextUrl = `https://graph.facebook.com/v14.0/me/adaccounts?limit=${limit}&fields=name,profile_picture,account_id,account_status,is_prepay_account,owner_business,created_time,next_bill_date,currency,adtrust_dsl,timezone_name,timezone_offset_hours_utc,disable_reason,adspaymentcycle{threshold_amount},balance,owner,users{id,is_active,name,permissions,role,roles},insights.date_preset(maximum){spend},userpermissions.user(${this.item.uid}){role}&access_token=${this.accessToken}&summary=1&locale=en_US`;

                while (nextUrl) {
                    let res = await fetch(nextUrl);
                    let resData = await res.json();

                    if (resData.error) {
                        console.error('getAdAccounts Error:', resData.error);
                        break; // Stop on error
                    }

                    if (resData.data && Array.isArray(resData.data)) {
                        allAccounts = allAccounts.concat(resData.data);
                    }

                    if (resData.paging && resData.paging.next) {
                        nextUrl = resData.paging.next;
                    } else {
                        nextUrl = null;
                    }
                }

                // Optional: Map/Clean Data if needed here
                // For now, returning raw object as requested by "tối ưu lại code" but keeping structure
                // Or mappping to the format used in snippet:
                const mappedAccounts = allAccounts.map(item => {
                    return {
                        status: item.account_status,
                        account: item.name,
                        adId: item.account_id,
                        // Include other fields for potential future use
                        currency: item.currency,
                        balance: item.balance,
                        account_status: item.account_status,
                        owner_business: item.owner_business
                    }
                });

                resolve(mappedAccounts);

            } catch (err) {
                console.error('getAdAccounts Exception:', err);
                reject(err);
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.FacebookAPI = FacebookAPI;
}

if (typeof module !== 'undefined') {
    module.exports = FacebookAPI;
}
