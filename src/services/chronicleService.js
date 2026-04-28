/**
 * AI-Chronicle: Single Source of Truth Timeline
 * Ingests LifeSe FHIR bundles + OCR-scanned papers into a searchable medical biography.
 * Query: "When did your knee pain start?" → surfaces lab 2018, clinical note 2021, trend line.
 */

import { getDb } from '../db.js';

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Extract indexable events from a FHIR R4 Bundle for a patient.
 */
export function extractChronicleEventsFromBundle(bundle, patientId) {
  const events = [];
  const entries = bundle?.entry || [];
  for (const e of entries) {
    const r = e.resource;
    if (!r) continue;
    const date = r.effectiveDateTime || r.period?.start || r.date || new Date().toISOString();
    let type = 'document';
    let summary = '';
    let codes = [];
    if (r.resourceType === 'Observation') {
      type = 'lab';
      summary = r.code?.coding?.[0]?.display || r.code?.text || 'Lab';
      const v = r.valueQuantity?.value ?? r.valueString;
      if (v != null) summary += `: ${v} ${r.valueQuantity?.unit || ''}`.trim();
      codes = (r.code?.coding || []).map((c) => c.display || c.code).filter(Boolean);
    } else if (r.resourceType === 'Encounter') {
      type = 'visit';
      summary = r.reasonCode?.[0]?.text || 'Visit';
      codes = [summary];
    } else if (r.resourceType === 'Condition' || r.resourceType === 'DiagnosticReport') {
      type = r.resourceType === 'Condition' ? 'condition' : 'lab';
      summary = r.code?.text || r.code?.coding?.[0]?.display || r.conclusion || 'Record';
      codes = [summary];
    }
    events.push({
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patientId,
      type,
      date,
      source: 'fhir',
      summary: summary.trim() || r.resourceType,
      fullText: [summary, JSON.stringify(r)].join(' '),
      codes,
      raw: { resourceType: r.resourceType, id: r.id },
    });
  }
  return events;
}

/**
 * Create chronicle event from OCR-scanned document (e.g. lab PDF, clinical note).
 */
export function createEventFromOcr(patientId, { date, type, summary, fullText, codes = [] }) {
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patientId,
    type: type || 'document',
    date: date || new Date().toISOString(),
    source: 'ocr',
    summary: summary || fullText?.slice(0, 200) || 'Scanned document',
    fullText: fullText || summary || '',
    codes: Array.isArray(codes) ? codes : [codes].filter(Boolean),
    raw: null,
  };
}

/**
 * Ingest: persist events to chronicle store (and optionally from longitudinal/FHIR).
 */
export function ingestChronicleEvents(patientId, events) {
  const db = getDb();
  if (!db.chronicleEvents) db.chronicleEvents = [];
  const withPatient = events.map((e) => ({ ...e, patientId: e.patientId || patientId }));
  db.chronicleEvents.push(...withPatient);
  return withPatient.length;
}

/**
 * Searchable medical biography: keyword + semantic-style search over fullText/summary/codes.
 * Returns matching events + optional trend line for numeric/lab-like results.
 */
export function searchChronicle(patientId, query) {
  const db = getDb();
  const events = (db.chronicleEvents || []).filter((e) => e.patientId === patientId);
  const q = normalizeText(query);
  if (!q) return { events: events.sort((a, b) => new Date(b.date) - new Date(a.date)), trendLine: null };

  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const scored = events.map((e) => {
    const text = normalizeText([e.summary, e.fullText, (e.codes || []).join(' ')].join(' '));
    let score = 0;
    for (const t of terms) {
      if (text.includes(t)) score += 1;
      if ((e.codes || []).some((c) => normalizeText(c).includes(t))) score += 2;
    }
    return { ...e, score };
  });
  const matched = scored.filter((e) => e.score > 0).sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date));

  const trendLine = buildTrendFromEvents(matched, terms);
  return { events: matched, trendLine };
}

/**
 * Build a simple trend line from lab-type events (same code/term over time).
 */
function buildTrendFromEvents(matchedEvents, terms) {
  const labLike = matchedEvents.filter((e) => e.type === 'lab' || e.type === 'observation' || /[\d.]+/.test(e.summary || ''));
  if (labLike.length < 2) return null;
  const points = labLike.map((e) => {
    const num = parseFloat((e.summary || '').match(/[\d.]+/)?.[0]);
    return { date: e.date, value: Number.isFinite(num) ? num : null, label: e.summary };
  }).filter((p) => p.value != null).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (points.length < 2) return null;
  return {
    label: terms[0] || 'value',
    points,
    description: `Trend across ${points.length} records from ${points[0].date.slice(0, 10)} to ${points[points.length - 1].date.slice(0, 10)}`,
  };
}

/**
 * Get full biography timeline for a patient (all events, sorted).
 */
export function getChronicleTimeline(patientId) {
  const db = getDb();
  const events = (db.chronicleEvents || [])
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return events;
}
