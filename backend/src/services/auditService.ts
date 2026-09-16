import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

class AuditService {
    static ensureLogDir() {
        try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        } catch (err) {
            // ignore
        }
    }

    static logEvent(event: string, details: Record<string, any>) {
        this.ensureLogDir();
        const entry = { timestamp: new Date().toISOString(), event, details };
        try {
            fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
        } catch (err) {
            console.error('Failed to write audit log', err);
        }
    }
}

export default AuditService;
