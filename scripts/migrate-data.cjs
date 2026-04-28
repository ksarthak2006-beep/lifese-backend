const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'db.json');
const SQLITE_PATH = path.resolve(__dirname, '..', 'data', 'lifese.db');

const db = new Database(SQLITE_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    role TEXT DEFAULT 'CITIZEN',
    healthId TEXT UNIQUE,
    abhaId TEXT,
    verificationStatus TEXT DEFAULT 'UNSUBMITTED',
    isBanned INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS otps (
    phone TEXT PRIMARY KEY,
    otp TEXT,
    expiresAt INTEGER,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    patientId TEXT,
    doctorId TEXT,
    slot TEXT,
    status TEXT DEFAULT 'PENDING_PAYMENT',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function migrate() {
    console.log('🚀 Starting LifeSe Data Migration (Better-SQLite3)...');

    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Legacy db.json not found.');
        return;
    }

    const legacy = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

    // Users
    const users = legacy.users || [];
    console.log(`👤 Migrating ${users.length} users...`);
    const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, phone, email, name, role, healthId, abhaId, verificationStatus, isBanned, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    for (const u of users) {
        insertUser.run(
            u.id,
            u.phone,
            u.email || null,
            u.name,
            u.role?.toUpperCase() || 'CITIZEN',
            u.healthId,
            u.abhaId || null,
            u.verificationStatus?.toUpperCase() || 'UNSUBMITTED',
            u.isBanned ? 1 : 0,
            u.createdAt || new Date().toISOString()
        );
    }

    // Bookings
    const bookings = legacy.bookings || [];
    console.log(`📅 Migrating ${bookings.length} bookings...`);
    const insertBooking = db.prepare(`
    INSERT OR REPLACE INTO bookings (id, patientId, doctorId, slot, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    for (const b of bookings) {
        insertBooking.run(
            b.id,
            b.patientId,
            b.providerId,
            b.slotId, // legacy slotId
            b.status?.toUpperCase() || 'CONFIRMED',
            b.createdAt || new Date().toISOString()
        );
    }

    console.log('✅ Migration Finalized.');
}

migrate().catch(err => console.error('🔥 Fatal Migration Error:', err));
