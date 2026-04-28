/**
 * Predictive Family Health Guardian
 * Multi-profile: monitor linked ABHA records of family (elderly parents, children).
 * Alerts on dangerous values (e.g. potassium spike) with high-priority "Call Doctor" action.
 */

import { getDb } from '../db.js';
import { getLongitudinalRecord } from './longitudinal.js';

const ALERT_RULES = [
  { id: 'potassium_high', code: 'potassium', name: 'High potassium', threshold: (v) => v > 5.5, message: 'Dangerous potassium spike in recent report.', priority: 'high' },
  { id: 'potassium_low', code: 'potassium', name: 'Low potassium', threshold: (v) => v < 3.5, message: 'Low potassium level.', priority: 'medium' },
  { id: 'creatinine_high', code: 'creatinine', name: 'Elevated creatinine', threshold: (v) => v > 1.5, message: 'Kidney function concern – elevated creatinine.', priority: 'high' },
  { id: 'glucose_high', code: 'glucose', name: 'High blood sugar', threshold: (v) => v > 200, message: 'Very high blood sugar in report.', priority: 'high' },
  { id: 'hb1ac_high', code: 'hba1c', name: 'Elevated HbA1c', threshold: (v) => v > 7, message: 'HbA1c above target – consider doctor visit.', priority: 'medium' },
  { id: 'bp_systolic_high', code: 'bp', name: 'High BP', threshold: (v) => v > 160, message: 'Systolic BP very high.', priority: 'high' },
];

function parseValue(obs) {
  const v = obs.value;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const num = parseFloat(v.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(num)) return num;
    const bpMatch = v.match(/(\d+)\s*\/\s*(\d+)/);
    if (bpMatch) return parseInt(bpMatch[1], 10);
  }
  return null;
}

function evaluateAlerts(observations) {
  const alerts = [];
  for (const rule of ALERT_RULES) {
    const relevant = (observations || []).filter(
      (o) => (o.code || '').toLowerCase().includes(rule.code) || (o.display || o.testName || '').toLowerCase().includes(rule.code)
    );
    for (const o of relevant) {
      const value = parseValue(o);
      if (value != null && rule.threshold(value)) {
        alerts.push({
          id: `${rule.id}-${o.date}-${value}`,
          ruleId: rule.id,
          name: rule.name,
          message: rule.message,
          priority: rule.priority,
          value,
          date: o.date,
          code: o.code || rule.code,
        });
      }
    }
  }
  return alerts;
}

/**
 * Link a family member (by ABHA or patientId) to the guardian.
 */
export function linkFamilyMember(guardianUserId, abhaIdOrPatientId, relation) {
  const db = getDb();
  if (!db.guardianLinks) db.guardianLinks = [];
  const user = db.users.find((u) => u.id === abhaIdOrPatientId || u.healthId === abhaIdOrPatientId);
  const patientId = user?.id || abhaIdOrPatientId;
  const existing = db.guardianLinks.find((l) => l.guardianId === guardianUserId && l.patientId === patientId);
  if (existing) return existing;
  const link = {
    id: `gl-${Date.now()}`,
    guardianId: guardianUserId,
    patientId,
    abhaId: user?.healthId,
    name: user?.name || 'Family member',
    relation: relation || 'family',
    linkedAt: new Date().toISOString(),
  };
  db.guardianLinks.push(link);
  return link;
}

/**
 * Get family members linked to this guardian.
 */
export function getLinkedFamily(guardianUserId) {
  const db = getDb();
  const links = (db.guardianLinks || []).filter((l) => l.guardianId === guardianUserId);
  return links.map((l) => {
    const user = db.users.find((u) => u.id === l.patientId);
    return { ...l, name: user?.name || l.name };
  });
}

/**
 * Fetch latest data for linked members and evaluate alerts; persist high-priority alerts for guardian.
 */
export function refreshGuardianAlerts(guardianUserId) {
  const db = getDb();
  if (!db.guardianAlerts) db.guardianAlerts = [];
  const links = getLinkedFamily(guardianUserId);
  const newAlerts = [];
  for (const link of links) {
    const record = getLongitudinalRecord(link.patientId);
    if (!record) continue;
    const observations = record.observations || [];
    const evaluated = evaluateAlerts(observations);
    for (const a of evaluated) {
      const existing = db.guardianAlerts.some(
        (x) => x.guardianId === guardianUserId && x.patientId === link.patientId && x.ruleId === a.ruleId && x.date === a.date
      );
      if (!existing) {
        const alert = {
          id: `ga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          guardianId: guardianUserId,
          patientId: link.patientId,
          patientName: link.name,
          ...a,
          createdAt: new Date().toISOString(),
          status: 'active',
          actionTaken: null,
        };
        db.guardianAlerts.push(alert);
        newAlerts.push(alert);
      }
    }
  }
  return newAlerts;
}

/**
 * Get active alerts for guardian (with "Call Doctor" action).
 */
export function getGuardianAlerts(guardianUserId, activeOnly = true) {
  const db = getDb();
  let list = (db.guardianAlerts || []).filter((a) => a.guardianId === guardianUserId);
  if (activeOnly) list = list.filter((a) => a.status === 'active');
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Mark alert action: "call_doctor" or "dismissed".
 */
export function setAlertAction(alertId, guardianUserId, action) {
  const db = getDb();
  const a = db.guardianAlerts?.find((x) => x.id === alertId && x.guardianId === guardianUserId);
  if (!a) return null;
  a.actionTaken = action;
  a.actedAt = new Date().toISOString();
  if (action === 'dismissed') a.status = 'dismissed';
  return a;
}
