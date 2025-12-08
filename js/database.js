const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class Database {
    constructor() {
        // Đảm bảo app.getPath khả dụng (Main Process luôn có sẵn)
        // userData là thư mục dữ liệu ứng dụng chuẩn của Electron
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'via_data.db');

        // Kết nối tới SQLite Database
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Lỗi khởi tạo Core DB:', err);
            } else {
                console.log('Đã kết nối SQLite DB tại:', dbPath);
                this.initTable(); // Khởi tạo bảng nếu chưa có
            }
        });
    }

    /**
     * Khởi tạo cấu trúc bảng (Schema) và thực hiện Migration (nâng cấp CSDL)
     */
    initTable() {
        // 1. Bảng Settings: Lưu cấu hình dạng Key-Value
        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // 2. Bảng Accounts: Lưu thông tin tài khoản Facebook
        this.db.run(`
            CREATE TABLE IF NOT EXISTS accounts (
                uid TEXT PRIMARY KEY,
                password TEXT,
                twoFa TEXT,
                email TEXT,
                emailPassword TEXT,
                emailRecover TEXT,
                cookie TEXT,
                token TEXT,
                status TEXT,
                name TEXT,
                avatar TEXT,
                proxy TEXT,
                user_agent TEXT,
                notes TEXT,
                processStatus TEXT,
                processMessage TEXT
            )
        `);

        // --- MIGRATION LOGIC (Tự động thêm cột mới nếu chưa có) ---

        // Kiểm tra và thêm cột 'emailRecover' cho bảng accounts
        this.db.all("PRAGMA table_info(accounts)", (err, rows) => {
            if (!err && rows) {
                const hasRecover = rows.some(r => r.name === 'emailRecover');
                if (!hasRecover) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN emailRecover TEXT", (err) => {
                        if (err) console.error('Migration add emailRecover failed', err);
                        else console.log('Migrated DB: Added emailRecover column');
                    });
                }

                // Kiểm tra và thêm cột 'folder' (thư mục quản lý)
                const hasFolder = rows.some(r => r.name === 'folder');
                if (!hasFolder) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN folder TEXT", (err) => {
                        if (err) console.error('Migration add folder failed', err);
                        else console.log('Migrated DB: Added folder column');
                    });
                }
            }

            // Kiểm tra và thêm cột 'browser_version' cho bảng profiles
            this.db.all("PRAGMA table_info(profiles)", (err, rows) => {
                if (!err && rows && rows.length > 0) {
                    const hasBrowserVer = rows.some(r => r.name === 'browser_version');
                    if (!hasBrowserVer) {
                        this.db.run("ALTER TABLE profiles ADD COLUMN browser_version TEXT", (err) => {
                            if (err) console.error('Migration add browser_version failed', err);
                            else console.log('Migrated DB: Added browser_version to profiles');
                        });
                    }
                }
            });

            // Kiểm tra và thêm cột 'color' cho bảng folders
            this.db.all("PRAGMA table_info(folders)", (err, rows) => {
                if (!err && rows) {
                    const hasColor = rows.some(r => r.name === 'color');
                    if (!hasColor && rows.length > 0) {
                        this.db.run("ALTER TABLE folders ADD COLUMN color TEXT", (err) => {
                            if (err) console.error('Migration add folder color failed', err);
                            else console.log('Migrated DB: Added folder color column');
                        });
                    }
                }
            });

            // 3. Bảng Folders: Quản lý thư mục tài khoản
            this.db.run(`
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                color TEXT
            )
        `);

            // 4. Bảng Profiles: Quản lý cấu hình giả lập (Browser, OS...)
            this.db.run(`
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                os TEXT,
                browser TEXT,
                browser_version TEXT,
                user_agent TEXT,
                screen_resolution TEXT,
                notes TEXT,
                created_at TEXT
            )
        `);
        });

    }

    getAllAccounts() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM accounts", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Thêm mới một tài khoản vào database
     * @param {Object} account - Object chứa thông tin tài khoản
     */
    insertAccount(account) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO accounts (
                    uid, password, twoFa, email, emailPassword, emailRecover, cookie, token, 
                    status, name, avatar, proxy, user_agent, notes, processStatus, processMessage
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                account.uid, account.password, account.twoFa, account.email, account.emailPassword, account.emailRecover || '',
                account.cookie, account.token, account.status, account.name, account.avatar,
                account.proxy || '', account.user_agent || '', account.notes || '',
                account.processStatus || '', account.processMessage || '',
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
            stmt.finalize();
        });
    }

    /**
     * Thêm hàng loạt tài khoản (Bulk Insert)
     * Sử dụng Transaction để tối ưu hiệu suất khi thêm nhiều dòng.
     * @param {Array} accounts - Mảng các object tài khoản
     */
    insertAccounts(accounts) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO accounts (
                    uid, password, twoFa, email, emailPassword, emailRecover, cookie, token, 
                    status, name, avatar, proxy, user_agent, notes, processStatus, processMessage
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            this.db.serialize(() => {
                this.db.run("BEGIN TRANSACTION");
                accounts.forEach(account => {
                    stmt.run(
                        account.uid, account.password, account.twoFa, account.email, account.emailPassword, account.emailRecover || '',
                        account.cookie, account.token, account.status, account.name, account.avatar,
                        account.proxy || '', account.user_agent || '', account.notes || '',
                        account.processStatus || '', account.processMessage || '',
                        (err) => {
                            if (err) console.error('Insert account error', account.uid, err);
                        }
                    );
                });
                this.db.run("COMMIT", (err) => {
                    stmt.finalize();
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        });
    }

    /**
     * Cập nhật thông tin tài khoản
     * @param {Object} account - Object tài khoản với thông tin mới
     */
    updateAccount(account) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE accounts SET 
                    password = ?, twoFa = ?, email = ?, emailPassword = ?, emailRecover = ?, cookie = ?, token = ?, 
                    status = ?, name = ?, avatar = ?, proxy = ?, user_agent = ?, notes = ?, 
                    processStatus = ?, processMessage = ?
                WHERE uid = ?
            `);

            stmt.run(
                account.password, account.twoFa, account.email, account.emailPassword, account.emailRecover || '',
                account.cookie, account.token, account.status, account.name, account.avatar,
                account.proxy || '', account.user_agent || '', account.notes || '',
                account.processStatus || '', account.processMessage || '',
                account.uid,
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
            stmt.finalize();
        });
    }

    /**
     * Xóa một tài khoản theo UID
     */
    deleteAccount(uid) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM accounts WHERE uid = ?", [uid], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    /**
     * Xóa nhiều tài khoản cùng lúc (Batch Delete)
     * @param {Array} uids - Mảng các UID cần xóa
     */
    deleteAccounts(uids) {
        return new Promise((resolve, reject) => {
            if (!uids || uids.length === 0) return resolve(0);
            const placeholders = uids.map(() => '?').join(',');
            this.db.run(`DELETE FROM accounts WHERE uid IN (${placeholders})`, uids, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    /**
     * Lấy toàn bộ cấu hình (Settings)
     * Trả về Object dạng { key: value }. Nếu thiếu key nào sẽ gán giá trị mặc định.
     */
    getSettings() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT id, value FROM settings", [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const settings = {};
                    rows.forEach(row => {
                        settings[row.id] = row.value;
                    });

                    // Giá trị mặc định nếu chưa có
                    if (!settings.chromePath) settings.chromePath = '';
                    if (!settings.maxThreads) settings.maxThreads = '2';
                    if (!settings.launchDelay) settings.launchDelay = '1';

                    resolve(settings);
                }
            });
        });
    }

    /**
     * Lưu cấu hình (Settings)
     * @param {Object} settingsObj - Object chứa các setting cần lưu
     */
    saveSettings(settingsObj) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare("INSERT OR REPLACE INTO settings (id, value) VALUES (?, ?)");

            const keys = Object.keys(settingsObj);

            // Bắt đầu Transaction để đảm bảo tính toàn vẹn
            this.db.serialize(() => {
                this.db.run("BEGIN TRANSACTION");

                keys.forEach(key => {
                    stmt.run(key, String(settingsObj[key]), (err) => {
                        if (err) console.error('Save setting error', key, err);
                    });
                });

                this.db.run("COMMIT", (err) => {
                    stmt.finalize();
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        });
    }

    // --- CÁC HÀM XỬ LÝ FOLDER (THƯ MỤC) ---

    getFolders() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM folders", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    updateFolder(id, newName, newColor, oldName) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run("BEGIN TRANSACTION");

                // Cập nhật thông tin Folder
                this.db.run("UPDATE folders SET name = ?, color = ? WHERE id = ?", [newName, newColor, id], (err) => {
                    if (err) {
                        this.db.run("ROLLBACK");
                        return reject(err);
                    }
                });

                // Cập nhật tên Folder trong bảng Accounts (Cascade Update)
                // Lưu ý: Accounts đang lưu tên folder thay vì ID (theo thiết kế hiện tại)
                if (newName !== oldName) {
                    this.db.run("UPDATE accounts SET folder = ? WHERE folder = ?", [newName, oldName], (err) => {
                        if (err) {
                            this.db.run("ROLLBACK");
                            return reject(err);
                        }
                    });
                }

                this.db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        });
    }

    addFolder(name, color) {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO folders (name, color) VALUES (?, ?)", [name, color], function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    deleteFolder(id) {
        return new Promise((resolve, reject) => {
            // Also optionally clear folder assignment in accounts?
            // For now, simple delete. User logic can handle re-assignment if needed.
            // Or better: update accounts set folder = '' where folder = (select name from folders where id = ?)
            // But we store folder NAME in accounts, not ID (based on plan).
            // Let's get name first.
            this.db.get("SELECT name FROM folders WHERE id = ?", [id], (err, row) => {
                if (err || !row) {
                    reject(err || 'Folder not found');
                    return;
                }
                const folderName = row.name;
                this.db.serialize(() => {
                    this.db.run("BEGIN TRANSACTION");
                    this.db.run("DELETE FROM folders WHERE id = ?", [id]);
                    this.db.run("UPDATE accounts SET folder = '' WHERE folder = ?", [folderName]);
                    this.db.run("COMMIT", (err) => {
                        if (err) reject(err);
                        else resolve(true);
                    });
                });
            });
        });
    }

    updateAccountFolder(uids, folderName) {
        return new Promise((resolve, reject) => {
            if (!uids || uids.length === 0) return resolve(0);
            const placeholders = uids.map(() => '?').join(',');
            const params = [folderName, ...uids];
            this.db.run(`UPDATE accounts SET folder = ? WHERE uid IN (${placeholders})`, params, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // --- CÁC HÀM XỬ LÝ PROFILE (CẤU HÌNH) ---

    /**
     * Lấy danh sách toàn bộ Profile
     */
    getProfiles() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM profiles ORDER BY id DESC", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    addProfile(profile) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO profiles (name, os, browser, browser_version, user_agent, screen_resolution, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const createdAt = new Date().toISOString();
            stmt.run(
                profile.name, profile.os, profile.browser, profile.browser_version || '', profile.user_agent,
                profile.screen_resolution || '1920x1080', profile.notes || '', createdAt,
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
            stmt.finalize();
        });
    }

    updateProfile(profile) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE profiles SET 
                    name = ?, os = ?, browser = ?, browser_version = ?, user_agent = ?, 
                    screen_resolution = ?, notes = ?
                WHERE id = ?
            `);
            stmt.run(
                profile.name, profile.os, profile.browser, profile.browser_version || '', profile.user_agent,
                profile.screen_resolution, profile.notes, profile.id,
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
            stmt.finalize();
        });
    }

    deleteProfile(id) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM profiles WHERE id = ?", [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();
