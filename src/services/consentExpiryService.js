/**
 * Zero-Knowledge Consent Management — Expiry dates, live map of data access, self-destruct.
 * Consent request can include custom expiry (e.g. 24 hours, 4 hours).
 */

import { getDb } from '../db.js';

export function setConsentExpiry(consentId, expiresAt, userId) {
  const db = getDb();
  const c = db.consents.find((x) => x.id === consentId && x.patientId === userId);
  if (!c) return null;
  c.expiresAt = new Date(expiresAt).toISOString();
  c.selfDestruct = true;
  return c;
}

export function getConsentsWithExpiry(userId) {
  const db = getDb();
  const now = new Date();
  return (db.consents || [])
    .filter((c) => c.patientId === userId && c.status === 'active')
    .map((c) => {
      const doctor = db.users.find((u) => u.id === c.doctorId);
      const expiresAt = new Date(c.expiresAt);
      return {
        ...c,
        doctorName: doctor?.name,
        expiresAt: c.expiresAt,
        expiresInHours: Math.max(0, (expiresAt - now) / (60 * 60 * 1000)),
        isExpired: expiresAt <= now,
      };
    });
}

/**
 * Get pending consent requests for a patient (doctor requested access for a specific duration).
 */
export function getPendingConsentRequests(patientId) {
  const db = getDb();
  return (db.consents || [])
    .filter((c) => c.patientId === patientId && c.status === 'pending')
    .map((c) => {
      const doctor = db.users.find((u) => u.id === c.doctorId);
      const expiresAt = new Date(c.expiresAt);
      const requestedHours = Math.round((expiresAt - new Date(c.grantedAt)) / (60 * 60 * 1000));
      return {
        ...c,
        doctorName: doctor?.name,
        requestedHours,
        expiresAt: c.expiresAt,
      };
    });
}

/**
 * Revoke expired consents (run periodically or on access check).
 */
export function revokeExpiredConsents() {
  const db = getDb();
  const now = new Date().toISOString();
  (db.consents || []).forEach((c) => {
    if (c.status === 'active' && c.expiresAt <= now) c.status = 'expired';
  });
}
