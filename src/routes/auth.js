import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '../db.js';
import {
  authMiddleware,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  handleRefreshToken,
} from '../middleware/auth.js';
import { loginSchema, registerSchema, sendOtpSchema } from '../utils/validation.js';
import logger from '../utils/logger.js';
import { sendOtpSms } from '../services/sms.js';
import { sendEmail, emailTemplates } from '../services/email.js';
import { generateAbhaId } from '../services/abdm.js';

const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── POST /api/auth/send-otp ────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone: identifier } = sendOtpSchema.parse(req.body);
    const db = getDb();
    
    // Resolve user if they exist
    const user = db.users.find((u) => u.phone === identifier || u.healthId === identifier || u.email === identifier);
    const resolvedPhone = user ? user.phone : (identifier.includes('@') ? null : identifier);
    const resolvedEmail = user ? user.email : (identifier.includes('@') ? identifier : null);
    
    const now = Date.now();
    const otp = crypto.randomInt(100000, 999999).toString();

    // Throttling Check (using phone as primary key if available)
    const throttleKey = resolvedPhone || resolvedEmail;
    const existingOtp = db.otps.find((o) => o.phone === throttleKey);
    if (existingOtp && (now - existingOtp.createdAt) < 30000) { // Reduced to 30s for demo
        return res.status(429).json({ error: 'Please wait 30s before resending.' });
    }

    db.otps.push({
      phone: throttleKey,
      otp,
      expiresAt: now + 10 * 60000, // 10 mins
      createdAt: now
    });

    let sentVia = 'console';
    try {
        if (resolvedPhone && resolvedPhone.length === 10 && !isNaN(resolvedPhone)) {
            await sendOtpSms(resolvedPhone, otp);
            sentVia = 'sms';
        } else if (resolvedEmail) {
            const tpl = emailTemplates.otp(otp);
            await sendEmail({ to: resolvedEmail, ...tpl });
            sentVia = 'email';
        } else {
            throw new Error('No valid delivery channel (Phone/Email) found.');
        }
    } catch (deliveryError) {
        logger.warn('Mocking OTP delivery due to service failure', { 
            error: deliveryError.message, 
            identifier: throttleKey,
            otp 
        });
        // Fallback: Log to terminal so demo doesn't stop
        console.log(`\n\n[DEMO OTP] — Identifier: ${throttleKey} | CODE: ${otp}\n\n`);
    }

    res.json({ 
        ok: true, 
        message: 'Verification code triggered.', 
        channel: sentVia === 'console' ? 'Terminal (Simulation)' : sentVia.toUpperCase() 
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Input validation failed' });
    }
    logger.error('Failed to send OTP', { error: err.message });
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// ─── POST /api/auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { phone, name, role, otp } = validatedData;
    const db = getDb();

    if (db.users.find(u => u.phone === phone)) {
      return res.status(400).json({ error: 'Account with this phone already exists.' });
    }

    const isMockOtp = (otp === '1234' && !IS_PROD);
    const otpEntry = db.otps.find((o) => o.phone === phone && o.otp === otp);

    if (!otpEntry && !isMockOtp) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }
    if (otpEntry && Date.now() > otpEntry.expiresAt && !isMockOtp) {
      return res.status(401).json({ error: 'Verification code expired.' });
    }

    const abha = await generateAbhaId({ name, phone });

    const user = {
      id: uuidv4(),
      name,
      phone,
      email: validatedData.email,
      role: role.toUpperCase(),
      abhaId: abha.abhaId,
      healthId: 'LIFESE-' + uuidv4().slice(0, 8).toUpperCase(),
      verificationStatus: role === 'doctor' ? 'PENDING' : 'UNSUBMITTED',
      createdAt: new Date().toISOString()
    };
    db.users.push(user);

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, role: user.role });
    setAuthCookies(res, accessToken, refreshToken);

    // Non-blocking welcome email
    if (validatedData.email) {
      const tpl = emailTemplates.welcomeCitizen(name);
      sendEmail({ to: validatedData.email, ...tpl }).catch(() => { });
    }

    logger.info('New user registered', { userId: user.id, role });
    res.status(201).json({ user, token: accessToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Input validation failed' });
    }
    logger.error('Registration failure', { error: err.message });
    res.status(500).json({ error: 'Registration failed unexpectedly.' });
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, otp } = loginSchema.parse(req.body);
    const db = getDb();
    const user = db.users.find((u) => u.phone === phone || u.healthId === phone || u.email === phone);

    if (!user) {
      return res.status(401).json({ error: 'Authentication failed.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const isDemoOtp = otp === '000000'; // universal demo OTP for all environments
    const isMockOtp = (otp === '1234' && !IS_PROD);
    const otpEntry = db.otps.find((o) => o.phone === user.phone && o.otp === otp);

    if (!otpEntry && !isMockOtp && !isDemoOtp) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }
    if (otpEntry && Date.now() > otpEntry.expiresAt && !isMockOtp && !isDemoOtp) {
      return res.status(401).json({ error: 'Code expired.' });
    }

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, role: user.role });
    setAuthCookies(res, accessToken, refreshToken);

    logger.info('User logged in', { userId: user.id, role: user.role });
    res.json({ user, token: accessToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation failed' });
    }
    logger.error('Login system error', { error: err.message });
    res.status(500).json({ error: 'Authentication system failure.' });
  }
});

// ─── POST /api/auth/refresh ─────────────────────────────────────
router.post('/refresh', handleRefreshToken);

// ─── POST /api/auth/logout ──────────────────────────────────────
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  logger.info('User logged out');
  res.json({ ok: true });
});

// ─── POST /api/auth/verify-doctor ──────────────────────────────
router.post('/verify-doctor', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can access this.' });
    }
    const db = getDb();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { qualification, specialization, registrationNumber, isTelemedicineOriented } = req.body;

    user.qualification = qualification || user.qualification;
    user.specialization = specialization || user.specialization;
    user.registrationNumber = registrationNumber || user.registrationNumber;
    user.isTelemedicineOriented = isTelemedicineOriented ?? user.isTelemedicineOriented;
    user.verificationStatus = 'pending';
    user.submittedAt = new Date().toISOString();

    logger.info('Doctor submitted verification credentials', { doctorId: user.id });
    res.json({ success: true, user, message: 'Verification pending admin review.' });
  } catch (err) {
    logger.error('verify-doctor error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ───────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
