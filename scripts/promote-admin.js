/**
 * LifeSe — Administrator Promotion Tool
 * 
 * Usage: 
 * 1. Ensure the user has registered first via the app.
 * 2. Run: node scripts/promote-admin.js <phone_number>
 */

import { getDb } from '../src/db.js';
import logger from '../src/utils/logger.js';

const phone = process.argv[2];

if (!phone || !/^\d{10}$/.test(phone)) {
    console.error('❌ Error: Please provide a 10-digit phone number.');
    console.log('Usage: node scripts/promote-admin.js 9876543210');
    process.exit(1);
}

const db = getDb();
const user = db.users.find(u => u.phone === phone);

if (!user) {
    console.error(`❌ User with phone ${phone} not found in database. Ask them to register first.`);
    process.exit(1);
}

if (user.role === 'admin') {
    console.log(`ℹ️ User ${phone} is already an admin.`);
    process.exit(0);
}

// Perform the promotion
user.role = 'admin';
user.isBanned = false; // Just in case

console.log(`✅ Success! [${user.name}] is now an ADMINISTRATOR.`);
console.log('Restart the server if needed for state synchronization.');
logger.info('User promoted to admin manually', { userId: user.id, phone });

// Database sync happens automatically on script exit thanks to the Proxy-debouncer.
// However, since we're exiting immediately, we ensure it flushes.
setTimeout(() => process.exit(0), 1000);
