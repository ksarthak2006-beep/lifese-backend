/**
 * Pre-Consultation Audio Brief Service
 * Auto-generates a structured clinical briefing text before each appointment.
 * Text is sent to the frontend where the browser SpeechSynthesis API reads it aloud.
 * 
 * In production: replace with Deepgram/ElevenLabs TTS for higher quality audio.
 */

import { getDb } from '../db.js';
import { buildFlashSummary } from './flashSummaryService.js';

/**
 * Generate a pre-consultation brief for the next patient in a doctor's queue.
 * @param {string} doctorId
 * @param {string} patientId
 * @param {string} slotTime - ISO timestamp of the appointment
 */
export function generateAudioBrief(doctorId, patientId, slotTime) {
  const db = getDb();

  // Get patient info
  const patient = db.users.find ? db.users.find((u) => u.id === patientId) : null;
  const patientName = patient?.name || 'the next patient';

  // Get flash summary
  const summary = buildFlashSummary(patientId);

  // Get today's appointment chief complaint (from latest booking notes if any)
  const bookings = (db.bookings || []).filter
    ? db.bookings.filter((b) => b.patientId === patientId && b.doctorId === doctorId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];
  const latestBooking = bookings[0];
  const complaint = latestBooking?.chiefComplaint || latestBooking?.reason || null;

  // Build brief text
  const parts = [];
  parts.push(`Preparing for your next patient.`);

  if (patientName !== 'the next patient') {
    const age = patient?.age ? `, ${patient.age} years old` : '';
    parts.push(`${patientName}${age}.`);
  }

  if (summary?.structured) {
    const { conditions, allergies, lastHbA1c, lastBP, lastVisit, medicinesInHistory } = summary.structured;

    if (conditions?.length) {
      parts.push(`Known conditions: ${conditions.slice(0, 3).join(', ')}.`);
    }
    if (allergies?.length) {
      parts.push(`Allergies: ${allergies.join(', ')}. Please note.`);
    }
    if (lastHbA1c) {
      parts.push(`Last HbA1c was ${lastHbA1c.value} percent on ${lastHbA1c.date}.`);
    }
    if (lastBP) {
      parts.push(`Last blood pressure: ${lastBP.value} on ${lastBP.date}.`);
    }
    if (medicinesInHistory?.length) {
      parts.push(`Current medications include ${medicinesInHistory.slice(0, 3).join(', ')}.`);
    }
    if (lastVisit) {
      parts.push(`Last seen ${lastVisit}.`);
    }
  }

  if (complaint) {
    parts.push(`Today's reason for visit: ${complaint}.`);
  }

  parts.push(`Review complete. You are ready to begin the consultation.`);

  const briefText = parts.join(' ');
  const wordCount = briefText.split(/\s+/).length;
  const estimatedSeconds = Math.ceil(wordCount / 2.5); // avg speaking rate ~150wpm = 2.5 words/sec

  // Cache the brief in DB for retrieval
  if (!db.consultBriefs) db.consultBriefs = [];
  const existingIdx = db.consultBriefs.findIndex(
    (b) => b.doctorId === doctorId && b.patientId === patientId
  );
  const brief = {
    id: `brief-${Date.now()}`,
    doctorId,
    patientId,
    patientName,
    slotTime,
    briefText,
    estimatedSeconds,
    structuredSummary: summary?.structured || null,
    generatedAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    db.consultBriefs[existingIdx] = brief;
  } else {
    db.consultBriefs.push(brief);
  }

  return brief;
}

/**
 * Get the brief for a specific doctor + patient.
 */
export function getBrief(doctorId, patientId) {
  const db = getDb();
  const briefs = db.consultBriefs || [];
  return briefs.find
    ? briefs.find((b) => b.doctorId === doctorId && b.patientId === patientId)
    : null;
}

/**
 * Get all upcoming briefs for today's queue.
 */
export function getTodaysBriefs(doctorId) {
  const db = getDb();
  const today = new Date().toDateString();
  return (db.consultBriefs || []).filter
    ? db.consultBriefs.filter(
        (b) => b.doctorId === doctorId && new Date(b.generatedAt).toDateString() === today
      )
    : [];
}
