const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class Database {
    constructor() {
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
