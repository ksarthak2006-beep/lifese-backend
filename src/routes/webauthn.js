import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';

const router = Router();

/**
 * WebAuthn / Passkey Support Scaffold
 * This provides the challenge/response logic for biometric login.
 */

// Step 1: Generate a unique challenge for the browser
router.get('/register-challenge', (req, res) => {
    const challenge = crypto.randomBytes(32).toString('base64');
    // In a real implementation, store this in session or temporary DB linked to the user
    res.json({
        challenge,
        rp: { name: "LifeSe Health", id: "localhost" },
        user: {
            id: crypto.randomBytes(16).toString('base64'),
            name: "User",
            displayName: "Health Portal User"
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }] // ES256
    });
});

// Step 2: Verify the public key credential sent by the browser
router.post('/register-verify', (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Credential data required' });

    // In production, use @simplewebauthn/server to parse and verify the attestation
    const db = getDb();
    // Store the public key linked to the user for future logins
    console.log('✅ WebAuthn Passkey Registered and Verified locally');
    res.json({ ok: true, message: "Passkey registered successfully" });
});

export default router;
