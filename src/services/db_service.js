import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/uhi_production.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH, { verbose: (msg) => logger.debug(msg) });

// Optimized Pragmas for Production
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -64000'); // 64MB cache

// Schema Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    healthId TEXT UNIQUE,
    phone TEXT UNIQUE,
    email TEXT,
    name TEXT,
    role TEXT,
    data JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    patientId TEXT,
    doctorId TEXT,
    status TEXT,
    appointmentDate DATETIME,
    data JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clinical_records (
    id TEXT PRIMARY KEY,
    patientId TEXT,
    type TEXT,
    isEncrypted INTEGER DEFAULT 1,
    blob JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* FTS5 for Instant Medicine Search */
  CREATE VIRTUAL TABLE IF NOT EXISTS medicines_search USING fts5(
    id UNINDEXED,
    name,
    composition,
    manufacturer,
    tokenize="porter unicode61"
  );
`);

/**
 * High-Performance Medicine Migration
 * This runs in a transaction for speed.
 */
export const migrateMedicines = (medicinesJsonPath) => {
    const count = db.prepare('SELECT count(*) as count FROM medicines_search').get().count;
    if (count > 0) return; // Already migrated

    logger.info('Migrating Medicines to SQLite FTS5 Index...');
    const startTime = Date.now();

    try {
        const raw = fs.readFileSync(medicinesJsonPath, 'utf8');
        const data = JSON.parse(raw);

        const insert = db.prepare('INSERT INTO medicines_search (id, name, composition, manufacturer) VALUES (?, ?, ?, ?)');

        const migrate = db.transaction((items) => {
            for (const m of items) {
                insert.run(
                    m.id || '',
                    m.name || '',
                    `${m.short_composition1 || ''} ${m.short_composition2 || ''}`.trim(),
                    m.manufacturer_name || ''
                );
            }
        });

        migrate(data);
        logger.info(`Medicine index ready: ${data.length} entries in ${Date.now() - startTime}ms`);
    } catch (err) {
        logger.error('Failed to migrate medicines:', err);
    }
};

export default db;
