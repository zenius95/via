const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\Users\\zeniu\\AppData\\Roaming\\via\\via_data.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening DB:', err);
        process.exit(1);
    }
    console.log('Connected to DB for fixing schema');
});

db.serialize(() => {
    db.all("PRAGMA table_info(ad_accounts)", (err, rows) => {
        if (err) {
            console.error('Error getting table info:', err);
            return;
        }

        const verifyColumn = (colName, colType = 'TEXT') => {
            if (!rows.some(r => r.name === colName)) {
                console.log(`Adding missing column: ${colName}`);
                db.run(`ALTER TABLE ad_accounts ADD COLUMN ${colName} ${colType}`, (err) => {
                    if (err) console.error(`Failed to add ${colName}:`, err.message);
                    else console.log(`Added ${colName} successfully.`);
                });
            } else {
                console.log(`Column ${colName} already exists.`);
            }
        };

        verifyColumn('users');
        verifyColumn('reason');
        verifyColumn('next_bill_day');
        // Check others just in case
        verifyColumn('ad_id');
        verifyColumn('status', 'INTEGER');
        verifyColumn('currency');
        verifyColumn('balance');
        verifyColumn('spend');
        verifyColumn('account_limit');
        verifyColumn('threshold');
        verifyColumn('remain');
        verifyColumn('pre_pay');
        verifyColumn('payment');
        verifyColumn('cards');
        verifyColumn('role');
        verifyColumn('type');
        verifyColumn('bm_id');
        verifyColumn('admin_number', 'INTEGER');
        verifyColumn('timezone');
        verifyColumn('next_bill_date');
        verifyColumn('created_time');
        verifyColumn('country');
        verifyColumn('last_updated');
    });
});
