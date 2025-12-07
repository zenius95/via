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
        // Simple Key-Value Store for Settings
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
                processMessage TEXT
            )
        `);

        // Migration: Check if emailRecover exists
        this.db.all("PRAGMA table_info(accounts)", (err, rows) => {
            if (!err && rows) {
                const hasRecover = rows.some(r => r.name === 'emailRecover');
                if (!hasRecover) {
                    this.db.run("ALTER TABLE accounts ADD COLUMN emailRecover TEXT", (err) => {
                        if (err) console.error('Migration add emailRecover failed', err);
                        else console.log('Migrated DB: Added emailRecover column');
                    });
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
                    console.log('Inserting Account:', account.uid, 'Status:', account.status, 'Process:', account.processStatus);
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

    close() {
        this.db.close();
    }
}

module.exports = new Database();
