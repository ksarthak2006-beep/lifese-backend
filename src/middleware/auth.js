import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { getDb } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  logger.fatal('JWT_SECRET is not set in production. Exiting.');
  process.exit(1);
}
const ACTUAL_SECRET = JWT_SECRET || 'lifese-dev-secret-unsafe';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'lifese-dev-refresh-unsafe';

// Access token: 15 minutes | Refresh token: 30 days
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

// ─── Token helpers ───────────────────────────────────────────────
export function signAccessToken(payload) {
  return jwt.sign(payload, ACTUAL_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const IS_PROD = process.env.NODE_ENV === 'production';
  const base = { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'strict' : 'lax' };

  res.cookie('lifese_token', accessToken, { ...base, maxAge: 15 * 60 * 1000 });             // 15 min
  res.cookie('lifese_refresh_token', refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 });  // 30 days
}

export function clearAuthCookies(res) {
  const IS_PROD = process.env.NODE_ENV === 'production';
  const base = { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'strict' : 'lax' };
  res.clearCookie('lifese_token', { ...base });
  res.clearCookie('lifese_refresh_token', { ...base });
}

// ─── Auth middleware ─────────────────────────────────────────────
export function authMiddleware(req, res, next) {
  // 1. Try access token from httpOnly cookie
  let token = req.cookies?.lifese_token;

  // 2. Fallback to Authorization header (for mobile / API clients)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, ACTUAL_SECRET);

    // Check if the user account has been banned
    const db = getDb();
    const userRecord = db.users.find(payload.id);
    if (userRecord?.isBanned) {
      logger.warn('Banned user attempted access', { userId: payload.id });
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    }

    req.user = payload;
    next();
  } catch (err) {
    logger.warn('Invalid or expired token attempt', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Role guard ──────────────────────────────────────────────────
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn('Permission denied', { userId: req.user?.id, required: roles, has: req.user?.role });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ─── Verification guard ──────────────────────────────────────────
export function requireVerifiedDoctor(req, res, next) {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Doctor access required' });
  }

  const db = getDb();
  const user = db.users.find(req.user.id);

  if (user?.verificationStatus !== 'verified') {
    logger.warn('Unverified doctor blocked from clinical access', { userId: req.user.id, status: user?.verificationStatus });
    return res.status(403).json({ error: 'Your account is pending verification. Please contact an administrator.' });
  }

  next();
}

// ─── Refresh token endpoint helper ──────────────────────────────
export function handleRefreshToken(req, res) {
  const refreshToken = req.cookies?.lifese_refresh_token;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token provided' });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const db = getDb();
    const user = db.users.find(payload.id);

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended' });

    // Issue a new access token (refresh token stays the same — sliding window)
    const newAccessToken = signAccessToken({ id: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ id: user.id, role: user.role });

    setAuthCookies(res, newAccessToken, newRefreshToken);
    logger.info('Token refreshed', { userId: user.id });

    res.json({ ok: true });
  } catch (err) {
    logger.warn('Refresh token invalid or expired', { error: err.message });
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}
