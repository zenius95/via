const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class Database {
    constructor() {
        // Ensure app.getPath is available (might not be in renderer if nodeIntegration false, but we use this in MAIN process)
        // If this is used in Main Process, app is available.
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'via_data.db');

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Core DB init error:', err);
            } else {
                console.log('Connected to SQLite DB at', dbPath);
                this.initTable();
            }
        });
    }

    initTable() {
        this.db.serialize(() => {
            // Settings Table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    id TEXT PRIMARY KEY,
                    value TEXT
                )
            `);

            // Accounts Table
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
                    processMessage TEXT,
                    folder TEXT,
                    accountQuality TEXT
                )
            `);

            // Folders Table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    color TEXT
                )
            `);

            // Profiles Table
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
                    created_at TEXT,
                    is_deleted INTEGER DEFAULT 0
                )
            `, (err) => {
                // Migrations run after tables are potentially created
                this.runMigrations();
            });

            // Ad Accounts Table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS ad_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_uid TEXT,
                    ad_id TEXT,
                    name TEXT,
                    status INTEGER,
                    currency TEXT,
                    balance TEXT,
                    spend TEXT,
                    account_limit TEXT,
                    threshold TEXT,
                    remain TEXT,
                    pre_pay TEXT,
                    payment TEXT,
                    cards TEXT,
                    users TEXT,
                    role TEXT,
                    type TEXT,
                    bm_id TEXT,
                    admin_number INTEGER,
                    timezone TEXT,
                    next_bill_date TEXT,
                    next_bill_day TEXT,
                    created_time TEXT,
                    reason TEXT,
                    country TEXT,
                    last_updated TEXT,
                    FOREIGN KEY(account_uid) REFERENCES accounts(uid) ON DELETE CASCADE
                )
            `);
        });
    }

    runMigrations() {
        // Accounts migrations
        this.db.all("PRAGMA table_info(accounts)", (err, rows) => {
            if (!err && rows) {
                if (!rows.some(r => r.name === 'emailRecover')) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN emailRecover TEXT");
                }
                if (!rows.some(r => r.name === 'folder')) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN folder TEXT");
                }
                if (!rows.some(r => r.name === 'dtsg')) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN dtsg TEXT");
                }
                if (!rows.some(r => r.name === 'lsd')) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN lsd TEXT");
                }
                if (!rows.some(r => r.name === 'birthday')) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN birthday TEXT");
                }
                if (rows && !rows.some(r => r.name === 'friends')) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN friends TEXT");
                }
            }
        });

        // Folders migrations
        this.db.all("PRAGMA table_info(folders)", (err, rows) => {
            if (!err && rows && rows.length > 0) {
                if (!rows.some(r => r.name === 'color')) {
                    this.db.run("ALTER TABLE folders ADD COLUMN color TEXT");
                }
            }
        });

        // Profiles migrations
        this.db.all("PRAGMA table_info(profiles)", (err, rows) => {
            if (!err && rows && rows.length > 0) {
                if (!rows.some(r => r.name === 'browser_version')) {
                    this.db.run("ALTER TABLE profiles ADD COLUMN browser_version TEXT");
                }
                if (!rows.some(r => r.name === 'is_deleted')) {
                    this.db.run("ALTER TABLE profiles ADD COLUMN is_deleted INTEGER DEFAULT 0", (err) => {
                        if (err) console.error('Migration is_deleted failed', err);
                        else console.log('Migrated DB: Added is_deleted');
                    });
                }
            }
        });

        // Ad Accounts Migrations
        this.db.all("PRAGMA table_info(ad_accounts)", (err, rows) => {
            if (!err && rows && rows.length > 0) {
                if (!rows.some(r => r.name === 'users')) {
                    this.db.run("ALTER TABLE ad_accounts ADD COLUMN users TEXT");
                }
                if (!rows.some(r => r.name === 'reason')) {
                    this.db.run("ALTER TABLE ad_accounts ADD COLUMN reason TEXT");
                }
                if (!rows.some(r => r.name === 'next_bill_day')) {
                    this.db.run("ALTER TABLE ad_accounts ADD COLUMN next_bill_day TEXT");
                }
            }
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

    insertAccount(account) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO accounts (
                    uid, password, twoFa, email, emailPassword, emailRecover, cookie, token, 
                    status, name, avatar, proxy, user_agent, notes, processStatus, processMessage, folder, dtsg, lsd, birthday, friends, accountQuality
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                account.uid, account.password, account.twoFa, account.email, account.emailPassword, account.emailRecover || '',
                account.cookie, account.token, account.status, account.name, account.avatar,
                account.proxy || '', account.user_agent || '', account.notes || '',
                account.processStatus || '', account.processMessage || '', account.folder || '',
                // account.dtsg removed, account.lsd removed
                '', '',
                account.birthday || '', (account.friends !== undefined && account.friends !== null) ? account.friends : '',
                '', '',
                account.birthday || '', (account.friends !== undefined && account.friends !== null) ? account.friends : '',
                account.accountQuality || '',
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
            stmt.finalize();
        });
    }

    insertAccounts(accounts) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO accounts (
                    uid, password, twoFa, email, emailPassword, emailRecover, cookie, token, 
                    status, name, avatar, proxy, user_agent, notes, processStatus, processMessage, folder, accountQuality
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            this.db.serialize(() => {
                this.db.run("BEGIN TRANSACTION");
                accounts.forEach(account => {
                    stmt.run(
                        account.uid, account.password, account.twoFa, account.email, account.emailPassword, account.emailRecover || '',
                        account.cookie, account.token, account.status, account.name, account.avatar,
                        account.proxy || '', account.user_agent || '', account.notes || '',
                        account.processStatus || '', account.processMessage || '', account.folder || '',
                        account.accountQuality || '',
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

    updateAccount(account) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE accounts SET 
                    password = ?, twoFa = ?, email = ?, emailPassword = ?, emailRecover = ?, cookie = ?, token = ?, 
                    status = ?, name = ?, avatar = ?, proxy = ?, user_agent = ?, notes = ?, 
                    dtsg = ?, lsd = ?, birthday = ?, friends = ?, accountQuality = ?
                WHERE uid = ?
            `);

            stmt.run(
                account.password, account.twoFa, account.email, account.emailPassword, account.emailRecover || '',
                account.cookie, account.token, account.status, account.name, account.avatar,
                account.proxy || '', account.user_agent || '', account.notes || '',
                // account.dtsg removed, account.lsd removed
                '', '',
                account.birthday || '', (account.friends !== undefined && account.friends !== null) ? account.friends : '',
                account.accountQuality || '',
                account.uid,
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
            stmt.finalize();
        });
    }

    deleteAccount(uid) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM accounts WHERE uid = ?", [uid], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

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

                    // Defaults
                    if (!settings.chromePath) settings.chromePath = '';
                    if (!settings.maxThreads) settings.maxThreads = '2';
                    if (!settings.launchDelay) settings.launchDelay = '1';

                    resolve(settings);
                }
            });
        });
    }

    saveSettings(settingsObj) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare("INSERT OR REPLACE INTO settings (id, value) VALUES (?, ?)");

            const keys = Object.keys(settingsObj);

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

    // --- FOLDER METHODS ---

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

                // Update Folder Info
                this.db.run("UPDATE folders SET name = ?, color = ? WHERE id = ?", [newName, newColor, id], (err) => {
                    if (err) {
                        this.db.run("ROLLBACK");
                        return reject(err);
                    }
                });

                // Cascade Update to Accounts if name changed
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

    // --- PROFILE METHODS ---

    getProfiles() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM profiles WHERE is_deleted IS NULL OR is_deleted = 0 ORDER BY id DESC", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    addProfile(profile) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO profiles (name, os, browser, browser_version, user_agent, screen_resolution, notes, created_at, is_deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
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

    getDeletedProfiles() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM profiles WHERE is_deleted = 1 ORDER BY id DESC", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    deleteProfile(id) {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE profiles SET is_deleted = 1 WHERE id = ?", [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    restoreProfile(id) {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE profiles SET is_deleted = 0 WHERE id = ?", [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    permanentDeleteProfile(id) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM profiles WHERE id = ?", [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }


    // --- AD ACCOUNTS METHODS ---

    saveAdAccounts(uid, adAccounts) {

        console.log(adAccounts)

        return new Promise((resolve, reject) => {
            if (!uid) return reject('No UID provided');

            this.db.serialize(() => {
                this.db.run("BEGIN TRANSACTION");

                // Clear old data for this user
                this.db.run("DELETE FROM ad_accounts WHERE account_uid = ?", [uid]);

                if (adAccounts && adAccounts.length > 0) {
                    const stmt = this.db.prepare(`
                        INSERT INTO ad_accounts (
                            account_uid, ad_id, name, status, currency, balance, spend, 
                            account_limit, threshold, remain, pre_pay, payment, cards, users,
                            role, type, bm_id, admin_number, timezone, next_bill_date, next_bill_day,
                            created_time, reason, country, last_updated
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    const now = new Date().toISOString();

                    adAccounts.forEach(ad => {
                        const usersJson = ad.users ? JSON.stringify(ad.users) : '[]';
                        stmt.run(
                            uid,
                            ad.adId || '',
                            ad.name || '',
                            ad.account_status,
                            ad.currency || '',
                            String(ad.balance || '0'),
                            String(ad.spend || '0'),
                            String(ad.limit || '0'),
                            String(ad.threshold || '0'),
                            String(ad.remain || '0'),
                            ad.prePay || '',
                            ad.payment || '',
                            JSON.stringify(ad.cards || []),
                            usersJson,
                            ad.role || '',
                            ad.type || '',
                            ad.bmId || '',
                            ad.adminNumber || 0,
                            ad.timezone || '',
                            ad.nextBillDate || '',
                            String(ad.nextBillDay || ''),
                            ad.createdTime || '',
                            ad.reason || '',
                            ad.country || '',
                            now,
                            (err) => {
                                if (err) console.error('Insert Ad Account Error', err);
                            }
                        );
                    });
                    stmt.finalize();
                }

                this.db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        });
    }

    getAdAccounts(uid) {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM ad_accounts WHERE account_uid = ?", [uid], (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse JSON fields if needed, e.g. cards
                    const results = rows.map(r => {
                        try {
                            r.cards = JSON.parse(r.cards);
                        } catch (e) { r.cards = []; }
                        return r;
                    });
                    resolve(results);
                }
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();
