const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

// Mock app.getPath for standalone run (if needed, but simpler to use hardcoded path or relative)
// But since we are running via node, we need to know where the DB is.
// User data is at C:\Users\zeniu\AppData\Roaming\via\via_data.db
const dbPath = 'C:\\Users\\zeniu\\AppData\\Roaming\\via\\via_data.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening DB:', err);
        process.exit(1);
    }
    console.log('Connected to DB');
});

db.serialize(() => {
    db.all("PRAGMA table_info(ad_accounts)", (err, rows) => {
        if (err) {
            console.error('Error getting table info:', err);
        } else {
            console.log('Columns in ad_accounts:');
            rows.forEach(r => console.log(`- ${r.name} (${r.type})`));

            const expected = ['users', 'reason', 'next_bill_day'];
            const missing = expected.filter(e => !rows.some(r => r.name === e));

            if (missing.length === 0) {
                console.log('SUCCESS: All new columns found.');
            } else {
                console.error('FAILURE: Missing columns:', missing);
            }
        }
    });
});
