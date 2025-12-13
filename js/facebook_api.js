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
}

if (typeof window !== 'undefined') {
    window.FacebookAPI = FacebookAPI;
}

if (typeof module !== 'undefined') {
    module.exports = FacebookAPI;
}
