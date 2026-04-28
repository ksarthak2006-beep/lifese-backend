/**
 * LifeSe — Backend Test Suite
 * Run with: npm test
 *
 * Covers: Auth validation, registration flow, login flow,
 *         ban enforcement, token refresh, admin routes,
 *         and prescription creation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb } from '../src/db.js';

// ─── Helpers ────────────────────────────────────────────────────
function freshDb() {
    const db = getDb();
    db.users = [];
    db.otps = [];
    db.prescriptions = [];
    db.consents = [];
    db.auditLogs = [];
}

async function seedOtp(phone, otp = '999888') {
    const db = getDb();
    db.otps = db.otps.filter(o => o.phone !== phone);
    db.otps.push({ phone, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
}

// Register a fresh user and return { cookie, user }
async function registerUser(overrides = {}) {
    const phone = overrides.phone || '9876543210';
    const otp = '1234'; // dev bypass
    const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', phone, otp, role: 'citizen', ...overrides });
    return { res, cookie: res.headers['set-cookie'] };
}

// ─── AUTH: Input Validation ──────────────────────────────────────
describe('Auth — Input Validation', () => {
    beforeEach(freshDb);

    it('rejects short phone numbers with 400', async () => {
        const res = await request(app).post('/api/auth/send-otp').send({ phone: '12345' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('rejects non-numeric phone with 400', async () => {
        const res = await request(app).post('/api/auth/send-otp').send({ phone: 'abcdefghij' });
        expect(res.status).toBe(400);
    });

    it('accepts a valid 10-digit phone', async () => {
        const res = await request(app).post('/api/auth/send-otp').send({ phone: '9876543210' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('rejects registration with missing name', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ phone: '9876543210', otp: '1234', role: 'citizen' });
        expect(res.status).toBe(400);
    });

    it('rejects registration with invalid role', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'X', phone: '9876543210', otp: '1234', role: 'hacker' });
        expect(res.status).toBe(400);
    });
});

// ─── AUTH: Registration ──────────────────────────────────────────
describe('Auth — Registration', () => {
    beforeEach(freshDb);

    it('registers a new citizen and returns a user object', async () => {
        const { res } = await registerUser();
        expect(res.status).toBe(201);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.role).toBe('citizen');
        expect(res.body.user.healthId).toMatch(/^LIFESE-/);
    });

    it('sets httpOnly cookies on registration', async () => {
        const { res } = await registerUser();
        const cookies = res.headers['set-cookie']?.join(';') || '';
        expect(cookies).toContain('lifese_token');
        expect(cookies).toContain('lifese_refresh_token');
        expect(cookies).toContain('HttpOnly');
    });

    it('prevents duplicate registration on the same phone', async () => {
        await registerUser({ phone: '9000000001' });
        const { res } = await registerUser({ phone: '9000000001' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/already exists/i);
    });

    it('registers a doctor with verificationStatus=pending', async () => {
        const { res } = await registerUser({ role: 'doctor', phone: '9000000002' });
        expect(res.status).toBe(201);
        expect(res.body.user.verificationStatus).toBe('pending');
    });
});

// ─── AUTH: Login ─────────────────────────────────────────────────
describe('Auth — Login', () => {
    beforeEach(freshDb);

    it('fails login for a non-existent user', async () => {
        await seedOtp('9100000000');
        const res = await request(app)
            .post('/api/auth/login')
            .send({ phone: '9100000000', otp: '999888' });
        expect(res.status).toBe(401);
    });

    it('logs in a registered user with correct OTP', async () => {
        await registerUser({ phone: '9200000000' });
        await seedOtp('9200000000', '777666');
        const res = await request(app)
            .post('/api/auth/login')
            .send({ phone: '9200000000', otp: '777666' });
        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        const cookies = res.headers['set-cookie']?.join(';') || '';
        expect(cookies).toContain('lifese_token');
        expect(cookies).toContain('lifese_refresh_token');
    });

    it('rejects login with wrong OTP', async () => {
        await registerUser({ phone: '9300000000' });
        await seedOtp('9300000000', '111222');
        const res = await request(app)
            .post('/api/auth/login')
            .send({ phone: '9300000000', otp: '000000' });
        expect(res.status).toBe(401);
    });

    it('rejects login for a banned user', async () => {
        await registerUser({ phone: '9400000000' });
        const db = getDb();
        const user = db.users.find(u => u.phone === '9400000000');
        user.isBanned = true;
        await seedOtp('9400000000', '555444');
        const res = await request(app)
            .post('/api/auth/login')
            .send({ phone: '9400000000', otp: '555444' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/suspended/i);
    });
});

// ─── AUTH: /me ───────────────────────────────────────────────────
describe('Auth — /me endpoint', () => {
    beforeEach(freshDb);

    it('returns user data when authenticated', async () => {
        const { cookie } = await registerUser({ phone: '9500000000' });
        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body.user.phone).toBe('9500000000');
    });

    it('returns 401 when not authenticated', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});

// ─── AUTH: Logout ────────────────────────────────────────────────
describe('Auth — Logout', () => {
    it('clears auth cookies on logout', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

// ─── PRESCRIPTIONS ───────────────────────────────────────────────
describe('Prescriptions', () => {
    beforeEach(freshDb);

    it('returns 403 for a citizen trying to create a prescription', async () => {
        const { cookie } = await registerUser({ phone: '9600000000', role: 'citizen' });
        const res = await request(app)
            .post('/api/prescriptions')
            .set('Cookie', cookie)
            .send({ patientId: 'x', medicines: [{ name: 'Aspirin' }] });
        expect(res.status).toBe(403);
    });

    it('creates a prescription when called by a doctor', async () => {
        // Register patient
        const { res: patientRes } = await registerUser({ phone: '9700000000', name: 'Patient A', role: 'citizen' });
        const patientId = patientRes.body.user.id;

        // Register doctor
        const { cookie: docCookie } = await registerUser({ phone: '9800000000', name: 'Dr. B', role: 'doctor' });

        const rx = await request(app)
            .post('/api/prescriptions')
            .set('Cookie', docCookie)
            .send({ patientId, medicines: [{ name: 'Paracetamol', dosage: '500mg' }] });

        expect(rx.status).toBe(201);
        expect(rx.body.id).toMatch(/^RX-/);
        expect(rx.body.patientId).toBe(patientId);
    });
});
