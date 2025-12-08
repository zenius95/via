const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LOG_DIR_NAME = 'logs';

function getLogDir(uid) {
    return path.join(app.getPath('userData'), LOG_DIR_NAME, uid);
}

// Ensure log directory exists and rotate logs (keep 10 newest)
async function init(uid, fileName) {
    const dir = getLogDir(uid);

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Rotation capability
        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.txt'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(dir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first

        // Keep 10, delete rest (start from index 10)
        if (files.length > 10) {
            for (let i = 10; i < files.length; i++) {
                try {
                    fs.unlinkSync(path.join(dir, files[i].name));
                } catch (e) {
                    console.error('Failed to rotate log:', files[i].name, e);
                }
            }
        }

    } catch (err) {
        console.error('Logger init error:', err);
    }
}

async function write(uid, fileName, message) {
    if (!uid || !fileName) return;
    const dir = getLogDir(uid);
    const filePath = path.join(dir, fileName);

    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const logLine = `[${timestamp}] ${message}\n`;

    try {
        // Append file
        fs.appendFileSync(filePath, logLine, { encoding: 'utf8' });
    } catch (err) {
        console.error('Logger write error:', err);
    }
}

async function deleteLogFolder(uid) {
    const dir = getLogDir(uid);
    if (fs.existsSync(dir)) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (err) {
            console.error('Failed to delete log folder for', uid, err);
        }
    }
}

module.exports = { init, write, deleteLogFolder };
