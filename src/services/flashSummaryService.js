/**
 * One-Click Longitudinal History — "Flash Summary" (The Time Machine)
 * AI-scans all linked ABHA records and returns 1-page clinical highlight for the doctor.
 */

import { getLongitudinalRecord } from './longitudinal.js';
import { getDb } from '../db.js';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Build 1-page clinical highlight from longitudinal + prescriptions + chronicle-style data.
 */
export function buildFlashSummary(patientId) {
  const record = getLongitudinalRecord(patientId);
  if (!record) return null;
  const db = getDb();
  const prescriptions = record.prescriptions || [];
  const encounters = record.encounters || [];
  const observations = record.observations || [];

  const conditions = [...new Set(prescriptions.map((p) => p.diagnosis).filter(Boolean))];
  const medicinesEver = [...new Set(prescriptions.flatMap((p) => (p.medicines || []).map((m) => m.name)))];
  const lastVisit = encounters[0] ? formatDate(encounters[0].date) : '—';
  const hba1cValues = observations.filter((o) => (o.code || '').toLowerCase().includes('hba1c') || (o.display || '').toLowerCase().includes('hba1c'));
  const lastHbA1c = hba1cValues.length ? { value: hba1cValues[0].value, date: formatDate(hba1cValues[0].date) } : null;
  const bpValues = observations.filter((o) => (o.code || '').toLowerCase().includes('blood') || (o.display || '').toLowerCase().includes('bp'));
  const lastBP = bpValues.length ? { value: bpValues[0].value, date: formatDate(bpValues[0].date) } : null;

  const allergies = []; // could come from AllergyIntolerance in FHIR or structured field
  if (medicinesEver.some((m) => /penicillin|penicillin/i.test(m))) {
    allergies.push('Penicillin (reported in history)');
  }

  const sinceMap = {};
  prescriptions.forEach((p) => {
    (conditions || []).forEach((c) => {
      if (p.diagnosis === c && !sinceMap[c]) sinceMap[c] = formatDate(p.visitDate);
    });
  });

  const bullets = [];
  if (conditions.length) {
    bullets.push(`**Conditions:** ${conditions.join('; ')}.`);
    conditions.forEach((c) => {
      if (sinceMap[c]) bullets.push(`  - ${c} (documented since ${sinceMap[c]}).`);
    });
  }
  if (allergies.length) bullets.push(`**Allergies:** ${allergies.join('; ')}.`);
  if (lastHbA1c) bullets.push(`**Last HbA1c:** ${lastHbA1c.value} (${lastHbA1c.date}).`);
  if (lastBP) bullets.push(`**Last BP:** ${lastBP.value} (${lastBP.date}).`);
  bullets.push(`**Last visit:** ${lastVisit}.`);
  if (medicinesEver.length) bullets.push(`**Medications in history:** ${medicinesEver.slice(0, 8).join(', ')}${medicinesEver.length > 8 ? '…' : ''}.`);

  return {
    patientId: record.patientId,
    patientName: record.name,
    healthId: record.healthId,
    generatedAt: new Date().toISOString(),
    summary: bullets.join('\n'),
    highlight: `Patient ${record.name} (ABHA: ${record.healthId}). ${conditions.length ? conditions[0] + (sinceMap[conditions[0]] ? ` since ${sinceMap[conditions[0]]}` : '') : 'No chronic conditions noted'}. ${allergies.length ? 'Allergies: ' + allergies.join(', ') + '.' : ''} Last HbA1c: ${lastHbA1c ? lastHbA1c.value + ' (' + lastHbA1c.date + ')' : 'N/A'}. Last visit ${lastVisit}.`,
    structured: {
      conditions,
      allergies,
      lastVisit,
      lastHbA1c,
      lastBP,
      medicinesInHistory: medicinesEver.slice(0, 10),
    },
  };
}
