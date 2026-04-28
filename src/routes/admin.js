import { Router } from 'express';
import { getDb, rawDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { sendEmail, emailTemplates } from '../services/email.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// ─── DOCTOR MANAGEMENT ─────────────────────────────────────────

/** GET /api/admin/doctors/pending — list all doctors awaiting approval */
router.get('/doctors/pending', (req, res) => {
    const doctors = rawDb.prepare("SELECT * FROM users WHERE role = 'DOCTOR' AND verificationStatus = 'PENDING'").all();
    res.json({ doctors });
});

/** GET /api/admin/doctors — list all doctors */
router.get('/doctors', (req, res) => {
    const doctors = rawDb.prepare("SELECT * FROM users WHERE role = 'DOCTOR'").all();
    res.json({ doctors });
});

/** POST /api/admin/doctors/:id/approve — approve a pending doctor */
router.post('/doctors/:id/approve', (req, res) => {
    const db = getDb();
    const doctor = db.users.find(req.params.id);
    if (!doctor || doctor.role !== 'DOCTOR') return res.status(404).json({ error: 'Doctor not found' });

    rawDb.prepare("UPDATE users SET verificationStatus = 'VERIFIED' WHERE id = ?").run(req.params.id);

    logger.info('Doctor approved', { doctorId: req.params.id, adminId: req.user.id });

    if (doctor.email) {
        const tpl = emailTemplates.doctorVerificationResult(doctor.name, 'verified', null);
        sendEmail({ to: doctor.email, ...tpl }).catch(() => { });
    }

    res.json({ success: true });
});

/** GET /api/admin/users — list all users */
router.get('/users', (req, res) => {
    const users = rawDb.prepare("SELECT id, name, phone, role, createdAt, isBanned FROM users").all();
    res.json({ users, total: users.length });
});

/** GET /api/admin/stats — platform-wide summary stats */
router.get('/stats', (req, res) => {
    const userStats = rawDb.prepare("SELECT role, count(*) as count FROM users GROUP BY role").all();
    const verifiedDoctors = rawDb.prepare("SELECT count(*) as count FROM users WHERE role = 'DOCTOR' AND verificationStatus = 'VERIFIED'").get().count;
    const pendingDoctors = rawDb.prepare("SELECT count(*) as count FROM users WHERE role = 'DOCTOR' AND verificationStatus = 'PENDING'").get().count;

    const bookingsCount = rawDb.prepare("SELECT count(*) as count FROM bookings").get().count;

    res.json({
        users: {
            total: userStats.reduce((acc, curr) => acc + curr.count, 0),
            citizens: userStats.find(s => s.role === 'CITIZEN')?.count || 0,
            doctors: userStats.find(s => s.role === 'DOCTOR')?.count || 0,
            verified: verifiedDoctors,
            pending: pendingDoctors
        },
        activity: {
            bookings: bookingsCount
        }
    });
});

export default router;
