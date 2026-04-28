import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'db.json');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:C:/UHI/backend/prisma/dev.db'
        }
    }
});

async function migrate() {
    console.log('🚀 Starting LifeSe Data Migration...');
    console.log('📂 Path:', DB_PATH);

    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Legacy db.json not found.');
        return;
    }

    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

    // Users
    const users = db.users || [];
    console.log(`👤 Migrating ${users.length} users...`);
    for (const u of users) {
        try {
            await prisma.user.upsert({
                where: { id: u.id },
                update: {},
                create: {
                    id: u.id,
                    name: u.name,
                    phone: u.phone,
                    email: u.email,
                    role: u.role?.toUpperCase() || 'CITIZEN',
                    healthId: u.healthId || 'HID-' + u.id.slice(0, 8),
                    abhaId: u.abhaId,
                    isBanned: u.isBanned || false,
                    verificationStatus: u.verificationStatus?.toUpperCase() || 'UNSUBMITTED',
                    createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
                }
            });
        } catch (e) {
            console.warn(`[User] Skip ${u.phone}: ${e.message}`);
        }
    }

    // Bookings
    const bookings = db.bookings || [];
    console.log(`📅 Migrating ${bookings.length} bookings...`);
    for (const b of bookings) {
        try {
            await prisma.booking.create({
                data: {
                    id: b.id,
                    patientId: b.patientId,
                    doctorId: b.providerId,
                    status: b.status?.toUpperCase() || 'CONFIRMED',
                    slot: new Date(),
                    createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
                }
            });
        } catch (e) {
            // Just skip if it already exists or fails
        }
    }

    console.log('✅ Migration Finalized.');
}

migrate()
    .catch(err => console.error('🔥 Fatal Migration Error:', err))
    .finally(() => prisma.$disconnect());
