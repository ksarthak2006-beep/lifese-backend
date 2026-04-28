/**
 * Doctor Second-Opinion Collaboration Service
 * Allows doctors to request a specialist's opinion on a patient case,
 * sharing an anonymized chronicle snippet with a one-time expiring consent.
 */

import { getDb } from '../db.js';
import { buildFlashSummary } from './flashSummaryService.js';

/**
 * Request a second opinion from a specialist.
 */
export function requestSecondOpinion({ requestingDoctorId, patientId, specialistId, question, urgency = 'routine', anonymize = true }) {
  const db = getDb();
  if (!db.secondOpinions) db.secondOpinions = [];

  const flashSummary = buildFlashSummary(patientId);
  const clinicalContext = anonymize
    ? anonymizeSummary(flashSummary)
    : flashSummary;

  const request = {
    id: `so-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestingDoctorId,
    patientId,
    specialistId,
    question,
    urgency, // 'routine' | 'urgent' | 'critical'
    anonymized: anonymize,
    clinicalContext,
    status: 'pending', // pending | responded | declined | expired
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h expiry
    response: null,
    respondedAt: null,
  };

  db.secondOpinions.push(request);
  return request;
}

/**
 * Respond to a second-opinion request.
 */
export function respondToOpinion({ requestId, specialistId, response, diagnosis, recommendations }) {
  const db = getDb();
  const requests = (db.secondOpinions || []);
  const req = requests.find
    ? requests.find((r) => r.id === requestId)
    : null;

  if (!req) throw new Error('Second-opinion request not found');
  if (req.specialistId !== specialistId) throw new Error('Not authorized to respond to this request');
  if (req.status !== 'pending') throw new Error(`Request is already ${req.status}`);
  if (new Date(req.expiresAt) < new Date()) {
    req.status = 'expired';
    throw new Error('This consultation request has expired');
  }

  req.response = response;
  req.diagnosis = diagnosis;
  req.recommendations = recommendations;
  req.status = 'responded';
  req.respondedAt = new Date().toISOString();

  return req;
}

/**
 * Get all second-opinion requests for a specialist (incoming).
 */
export function getIncomingRequests(specialistId) {
  const db = getDb();
  const all = (db.secondOpinions || []).filter
    ? db.secondOpinions.filter((r) => r.specialistId === specialistId)
    : [];

  // Auto-expire old pending requests
  return all.map((r) => {
    if (r.status === 'pending' && new Date(r.expiresAt) < new Date()) {
      r.status = 'expired';
    }
    return r;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all second-opinion requests made by a doctor (outgoing).
 */
export function getOutgoingRequests(doctorId) {
  const db = getDb();
  return (db.secondOpinions || []).filter
    ? db.secondOpinions.filter((r) => r.requestingDoctorId === doctorId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];
}

/**
 * Get all specialist/consultant doctors available.
 */
export function getSpecialists() {
  const db = getDb();
  const users = (db.users || []).filter
    ? db.users.filter((u) => u.role === 'doctor' || u.role === 'DOCTOR')
    : [];
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    specialty: u.specialty || 'General Medicine',
    verificationStatus: u.verificationStatus,
  }));
}

function anonymizeSummary(summary) {
  if (!summary) return null;
  return {
    ...summary,
    patientId: 'ANON',
    patientName: 'Anonymous Patient',
    healthId: 'ANON-XXXXXXXX',
  };
}
