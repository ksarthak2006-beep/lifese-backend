/**
 * LifeSe Health Score — A single 0–1000 score per citizen
 * 
 * Score = weighted sum of:
 *  - Medication adherence    30%
 *  - Biometrics trend        25%
 *  - Care pathway completion 20%
 *  - Appointments kept       15%
 *  - Preventive screenings   10%
 * 
 * Like CIBIL — but for health.
 */

import { getDb } from '../db.js';
import { getLongitudinalRecord } from './longitudinal.js';

const WEIGHTS = {
  adherence: 0.30,
  biometrics: 0.25,
  carePathways: 0.20,
  appointments: 0.15,
  screenings: 0.10,
};

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculate sub-scores (each 0–100) then combine into a 0–1000 final score.
 */
export function calculateHealthScore(userId) {
  const db = getDb();

  // ── 1. Medication Adherence ──────────────────────────────────────
  const reminders = (db.reminders || []).filter ? 
    db.reminders.filter((r) => r.patientId === userId) : [];
  const doneReminders = (db.medicineLog || []).filter ?
    db.medicineLog.filter((l) => l.userId === userId && l.taken) : [];
  const adherenceScore = reminders.length > 0
    ? clamp((doneReminders.length / reminders.length) * 100)
    : 50; // neutral if no data

  // ── 2. Biometrics Trend ─────────────────────────────────────────
  const record = getLongitudinalRecord(userId);
  const observations = record?.observations || [];
  let biometricsScore = 50;
  if (observations.length > 0) {
    const hba1cValues = observations
      .filter((o) => (o.code || '').toLowerCase().includes('hba1c') || (o.display || '').toLowerCase().includes('hba1c'))
      .map((o) => parseFloat(o.value))
      .filter((v) => !isNaN(v));
    if (hba1cValues.length > 0) {
      const latest = hba1cValues[0];
      // HbA1c < 5.7 = 100, 5.7-6.4 = 70, >6.4 = 40, >8 = 20
      if (latest < 5.7) biometricsScore = 100;
      else if (latest < 6.4) biometricsScore = 70;
      else if (latest < 8.0) biometricsScore = 40;
      else biometricsScore = 20;
    }
  }

  // ── 3. Care Pathway Completion ──────────────────────────────────
  const pathways = (db.carePathways || []).filter ?
    db.carePathways.filter((p) => p.patientId === userId) : [];
  let careScore = 50;
  if (pathways.length > 0) {
    const allTasks = pathways.flatMap((p) => p.tasks || []);
    const doneTasks = allTasks.filter((t) => t.done);
    careScore = allTasks.length > 0
      ? clamp((doneTasks.length / allTasks.length) * 100)
      : 50;
  }

  // ── 4. Appointments Kept ────────────────────────────────────────
  const bookings = (db.bookings || []).filter ?
    db.bookings.filter((b) => b.patientId === userId) : [];
  const keptBookings = bookings.filter((b) => b.status === 'completed' || b.status === 'COMPLETED');
  const appointmentScore = bookings.length > 0
    ? clamp((keptBookings.length / bookings.length) * 100)
    : 50;

  // ── 5. Preventive Screenings ────────────────────────────────────
  const healthPoints = (db.healthPoints || []).filter ?
    db.healthPoints.filter((h) => h.userId === userId) : [];
  const screeningActions = healthPoints.filter((h) => h.action === 'upload_lab').length;
  const screeningScore = clamp(screeningActions * 25, 0, 100);

  // ── Weighted composite (0–100) → scale to 0–1000 ────────────────
  const composite =
    adherenceScore * WEIGHTS.adherence +
    biometricsScore * WEIGHTS.biometrics +
    careScore * WEIGHTS.carePathways +
    appointmentScore * WEIGHTS.appointments +
    screeningScore * WEIGHTS.screenings;

  const finalScore = Math.round(composite * 10); // 0–1000

  // Grade
  let grade, gradeLabel, color;
  if (finalScore >= 800) { grade = 'A+'; gradeLabel = 'Excellent Health'; color = 'emerald'; }
  else if (finalScore >= 650) { grade = 'A'; gradeLabel = 'Very Good Health'; color = 'green'; }
  else if (finalScore >= 500) { grade = 'B'; gradeLabel = 'Good Health'; color = 'yellow'; }
  else if (finalScore >= 350) { grade = 'C'; gradeLabel = 'Fair Health'; color = 'orange'; }
  else { grade = 'D'; gradeLabel = 'Needs Attention'; color = 'red'; }

  return {
    total: finalScore,
    grade,
    gradeLabel,
    color,
    breakdown: {
      adherence: Math.round(adherenceScore),
      biometrics: Math.round(biometricsScore),
      carePathways: Math.round(careScore),
      appointments: Math.round(appointmentScore),
      screenings: Math.round(screeningScore),
    },
    computedAt: new Date().toISOString(),
    tips: generateTips({ adherenceScore, biometricsScore, careScore, appointmentScore, screeningScore }),
  };
}

function generateTips(scores) {
  const tips = [];
  if (scores.adherenceScore < 60) tips.push('💊 Take your medications on time to improve your score by up to 300 points.');
  if (scores.biometricsScore < 60) tips.push('🩺 Keep your HbA1c below 5.7% — schedule a blood test if it\'s been over 3 months.');
  if (scores.careScore < 60) tips.push('📋 Complete pending care pathway tasks to boost your score.');
  if (scores.appointmentScore < 60) tips.push('📅 Attend your scheduled appointments — they count toward your LifeSe Score.');
  if (scores.screeningScore < 60) tips.push('🔬 Upload recent lab reports to earn points and track your health trends.');
  if (!tips.length) tips.push('🌟 Excellent! Keep maintaining your healthy habits.');
  return tips;
}

/**
 * Store a score snapshot for historical trending.
 */
export function snapshotHealthScore(userId) {
  const db = getDb();
  const score = calculateHealthScore(userId);
  if (!db.healthScoreHistory) db.healthScoreHistory = [];
  db.healthScoreHistory.push({ userId, ...score, at: new Date().toISOString() });
  return score;
}

export function getScoreHistory(userId, limit = 10) {
  const db = getDb();
  const history = (db.healthScoreHistory || []).filter
    ? db.healthScoreHistory.filter((h) => h.userId === userId)
    : [];
  return history.slice(-limit);
}
