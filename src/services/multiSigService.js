/**
 * Multi-Signature Approvals for high-risk data (e.g. genomic, HIV)
 * Both patient and a designated guardian must approve the data share.
 */

import { getDb } from '../db.js';

export function requireDualApproval(consentId, dataCategory) {
  const HIGH_RISK_CATEGORIES = ['genomic', 'hiv', 'mental_health', 'hiv_records', 'genetic'];
  const category = (dataCategory || '').toLowerCase();
  return HIGH_RISK_CATEGORIES.some((c) => category.includes(c));
}

export function getGuardianForPatient(patientId) {
  const db = getDb();
  const guardians = db.guardians || [];
  return guardians.find((g) => g.patientId === patientId);
}

export function createMultiSigRequest(patientId, consentId, scope, dataCategory) {
  const db = getDb();
  if (!db.multiSigRequests) db.multiSigRequests = [];
  const req = {
    id: 'ms-' + Date.now(),
    patientId,
    consentId,
    scope,
    dataCategory,
    patientApproved: false,
    guardianApproved: false,
    createdAt: new Date().toISOString(),
  };
  db.multiSigRequests.push(req);
  return req;
}

export function approveAsPatient(requestId, userId) {
  const db = getDb();
  const r = db.multiSigRequests?.find((x) => x.id === requestId && x.patientId === userId);
  if (!r) return null;
  r.patientApproved = true;
  r.patientApprovedAt = new Date().toISOString();
  return r;
}

export function approveAsGuardian(requestId, guardianUserId) {
  const db = getDb();
  const guardian = (db.guardians || []).find((g) => g.guardianId === guardianUserId);
  if (!guardian) return null;
  const r = db.multiSigRequests?.find((x) => x.id === requestId && x.patientId === guardian.patientId);
  if (!r) return null;
  r.guardianApproved = true;
  r.guardianApprovedAt = new Date().toISOString();
  return r;
}

export function isMultiSigComplete(request) {
  return request && request.patientApproved && request.guardianApproved;
}
