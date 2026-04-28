import logger from '../utils/logger.js';

const ABDM_BASE = process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in/gateway';
const ABDM_CLIENT_ID = process.env.ABDM_CLIENT_ID;
const ABDM_CLIENT_SECRET = process.env.ABDM_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get a bearer token from the ABDM gateway.
 * Tokens are cached until expiry to avoid repeated auth requests.
 */
async function getAbdmToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    if (!ABDM_CLIENT_ID || !ABDM_CLIENT_SECRET) {
        logger.warn('ABDM credentials not set. Using simulated ABHA generation.');
        return null;
    }

    try {
        const res = await fetch(`${ABDM_BASE}/v0.5/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: ABDM_CLIENT_ID, clientSecret: ABDM_CLIENT_SECRET })
        });

        if (!res.ok) throw new Error(`ABDM auth failed: ${res.status}`);
        const data = await res.json();

        cachedToken = data.accessToken;
        tokenExpiry = Date.now() + (data.expiresIn * 1000) - 30000; // 30s safety margin
        return cachedToken;
    } catch (err) {
        logger.error('Failed to get ABDM token', { error: err.message });
        return null;
    }
}

/**
 * Generate an ABHA (Ayushman Bharat Health Account) ID for a citizen.
 * Falls back to a simulated LIFESE- prefixed ID for dev/demo.
 *
 * @param {object} userDetails - { name, phone, dob, gender }
 * @returns {object} { abhaId, abhaAddress, source: 'abdm' | 'simulated' }
 */
export async function generateAbhaId(userDetails) {
    const token = await getAbdmToken();

    if (!token) {
        // Graceful degradation — generate a simulated ABHA-like ID for dev/demo
        const simulated = `LIFESE-${Date.now().toString(36).toUpperCase()}@abdm`;
        logger.debug('ABHA ID simulated (no ABDM credentials)', { id: simulated });
        return { abhaId: simulated, abhaAddress: simulated, source: 'simulated' };
    }

    try {
        const res = await fetch(`${ABDM_BASE}/v1/registration/mobile/login/generateotp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-CM-ID': 'sbx',
            },
            body: JSON.stringify({ mobile: userDetails.phone }),
        });

        if (!res.ok) throw new Error(`ABDM generateAbhaId failed: ${res.status}`);
        const data = await res.json();

        logger.info('ABHA generation initiated', { phone: userDetails.phone });
        return { abhaId: data.healthId, abhaAddress: data.healthIdNumber, source: 'abdm' };
    } catch (err) {
        logger.error('ABHA generation failed', { error: err.message });
        // Fall back gracefully without crashing registration
        const fallback = `LIFESE-${Date.now().toString(36).toUpperCase()}@abdm`;
        return { abhaId: fallback, abhaAddress: fallback, source: 'simulated' };
    }
}

/**
 * Verify a doctor against the Health Professional Registry (HPR).
 * Returns { verified: boolean, name, qualification, registrationNo }
 *
 * @param {string} registrationNumber - Council registration number
 */
export async function verifyDoctorWithHpr(registrationNumber) {
    const token = await getAbdmToken();

    if (!token) {
        logger.warn('HPR verification skipped — no ABDM credentials');
        return { verified: false, reason: 'ABDM not configured', source: 'skipped' };
    }

    try {
        const res = await fetch(`https://hpr.abdm.gov.in/api/v1/search/doctor?registrationNumber=${registrationNumber}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) throw new Error(`HPR API error: ${res.status}`);
        const data = await res.json();

        const doctor = data?.[0];
        if (!doctor) return { verified: false, reason: 'Registration number not found', source: 'hpr' };

        return {
            verified: true,
            source: 'hpr',
            name: doctor.name,
            qualification: doctor.qualification,
            registrationNumber: doctor.registrationNumber,
            council: doctor.stateMedicalCouncil,
        };
    } catch (err) {
        logger.error('HPR verification failed', { error: err.message });
        return { verified: false, reason: err.message, source: 'hpr_error' };
    }
}
