/* js/data.js */

function generateData(count) {
    const names = ["Nguyễn Văn A", "Trần Thị B", "Phạm Văn C", "Lê Thị D", "Hoàng Văn E", "Tài Khoản Cũ 2015", "Tài Khoản Nuôi", "Tài Khoản US", "Tài Khoản Indo", "Tài Khoản Ads"];
    const statuses = ["LIVE", "DIE", "CHECKPOINT"];
    const procStatuses = ["RUNNING", "STOPPED", "FINISHED"];
    const procMsgs = ["Đang đăng nhập...", "Sai mật khẩu", "Kiểm tra thành công", "Đang lấy Token...", "Lỗi kết nối Proxy", "Hoàn tất", "Đang chờ...", "Lỗi 403 Forbidden", "Cập nhật thông tin: Xong"];
    const data = [];
    for (let i = 0; i < count; i++) {
        const uid = Math.floor(100000000000000 + Math.random() * 900000000000000).toString();
        data.push({
            isLoading: false,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            name: names[Math.floor(Math.random() * names.length)],
            avatar: `https://ui-avatars.com/api/?name=${names[i % names.length]}&background=random&color=fff&size=64&bold=true`,
            uid: uid,
            password: "Password@" + Math.floor(Math.random() * 1000),
            twoFa: "JBSWY3DPEHPK3PXP",
            email: `user_account_${i}@hotmail.com`,
            emailPass: "EmailPass123!",
            recoveryEmail: `recover_${i}@getnada.com`,
            cookie: `c_user=${uid};xs=...`,
            processStatus: procStatuses[Math.floor(Math.random() * procStatuses.length)],
            processMessage: procMsgs[Math.floor(Math.random() * procMsgs.length)]
        });
    }
    return data;
}

function generateSkeletonData(count) { return Array(count).fill({ isLoading: true }); }