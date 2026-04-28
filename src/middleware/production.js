import logger from '../utils/logger.js';
import * as Sentry from "@sentry/node";

/**
 * Production Security & Performance Middleware
 * Manual implementation of Helmet + RateLimit + Compression logic
 * without external dependencies.
 */

const RATE_LIMITS = new Map(); // IP -> { count, resetTime }

export const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Slightly more permissive CSP for dev/prod flexibility (allow images/connect to self)
    // Hardened CSP: No unsafe-eval, strict-dynamic would be great but 'self' is baseline
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://www.google-analytics.com",
        "connect-src 'self' http://localhost:5001 https://lifese-backend.onrender.com https://api.lifese.health",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Referrer-Policy', 'no-referrer'); // Standard healthcare privacy
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(self)');
    next();
};

export const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'];
    const now = Date.now();
    const windowMs = 1 * 60 * 1000; // 1 min window
    const limit = 500; // 500 requests per minute (tighter than before)

    let userData = RATE_LIMITS.get(ip);

    if (!userData || now > userData.resetTime) {
        userData = { count: 0, resetTime: now + windowMs };
    }

    userData.count++;
    RATE_LIMITS.set(ip, userData);

    if (userData.count > limit) {
        logger.warn('Rate limit exceeded', { ip });
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    next();
};

export const globalErrorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const status = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === 'production';
    const traceId = `ERR-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Log the error via Pino
    logger.error('API Error', {
        traceId,
        status,
        userId: req.user?.id || 'anonymous',
        message: err.message,
        path: req.path,
        method: req.method,
        stack: isProd ? null : err.stack
    });

    // Report to Sentry (Skip 401s to avoid noise; focus on real crashes/logic errors)
    if (status >= 500) {
        Sentry.captureException(err, {
            tags: { traceId, path: req.path, method: req.method },
            user: { id: req.user?.id }
        });
    }

    res.status(status).json({
        error: status === 500
            ? 'A secure internal error occurred. Please contact support.'
            : (err.message || 'Request failed.'),
        traceId,
        ...(isProd ? {} : { stack: err.stack })
    });
};
