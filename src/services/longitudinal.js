/**
 * Smart Care Context Linking & Longitudinal Health Record
 * Discovers and links patient records across HIPs using ABHA ID.
 */

import { getDb } from '../db.js';

/**
 * Get all linked records for a patient by ABHA/healthId (simulated cross-HIP fetch).
 * In production: call LifeSe gateway / discovery APIs with ABHA to aggregate from multiple HIPs.
 */
export function getLongitudinalRecord(abhaIdOrPatientId) {
  const db = getDb();
  const user = db.users.find((u) => u.healthId === abhaIdOrPatientId || u.id === abhaIdOrPatientId);
  if (!user) return null;

  const patientId = user.id;
  const prescriptions = (db.prescriptions || []).filter((p) => p.patientId === patientId);
  const consents = (db.consents || []).filter((c) => c.patientId === patientId);

  const encounters = prescriptions.map((p) => ({
    id: p.id,
    type: 'visit',
    date: p.visitDate,
    provider: db.users.find((u) => u.id === p.doctorId)?.name,
    diagnosis: p.diagnosis,
    vitals: p.vitals,
  }));

  const observations = [];
  prescriptions.forEach((p) => {
    if (p.vitals) {
      if (p.vitals.bp) observations.push({ date: p.visitDate, code: 'blood-pressure', display: 'BP', value: p.vitals.bp, unit: 'mmHg' });
      if (p.vitals.temp) observations.push({ date: p.visitDate, code: 'body-temperature', display: 'Temp', value: p.vitals.temp, unit: '°F' });
      if (p.vitals.pulse) observations.push({ date: p.visitDate, code: 'pulse', display: 'Pulse', value: p.vitals.pulse, unit: 'bpm' });
    }
  });

  const timeline = [...encounters]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    patientId,
    healthId: user.healthId,
    name: user.name,
    encounters,
    observations,
    prescriptions,
    consents,
    timeline,
  };
}
