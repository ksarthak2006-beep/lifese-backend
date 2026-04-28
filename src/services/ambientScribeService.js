/**
 * Ambient AI Scribe — "No-Type" Clinic
 * Listens to doctor-patient conversation (with consent); generates FHIR-compliant
 * prescription + clinical note. Doctor gets "Review and Sign" instead of typing.
 */

import { getDb } from '../db.js';

const DOSAGE_PATTERNS = [
  /(\d-\d-\d)/,
  /(once|twice|thrice|four times)\s*(daily|a day|per day)/i,
  /(\d+)\s*times?\s*(?:a|per)\s*day/i,
  /(?:\bodd\b|\bbd\b|\btds\b|\bqds\b|\bnocte\b|\bsos\b|\bhs\b)/i,
  /(\d+)\s*(?:mg|ml|tablet|tab|cap)s?\s*(?:per|a)\s*day/i,
  /(subah\s+sham|din\s+me\s+\d|khana\s+pehle|khana\s+baad)/i,
];
const DURATION_PATTERN = /(\d+)\s*(days?|weeks?|months?)/i;
const MED_NAME_PATTERN = /(?:prescrib(e|ing)|give|start|add|take)\s+([A-Za-z][A-Za-z0-9\s\-.&]+?)(?:\s+(?:\d-\d-\d|once|twice|thrice|for\s+\d)|$|,|\.)/gi;
const SURGERY_PATTERN = /(?:recommend|suggest|need|advise|perform)\s+([A-Za-z\s\-]+?)\s+(?:surgery|procedure|operation)/gi;
const BP_PATTERN = /(?:bp|blood|pressure)\s*(?:is|:)?\s*(?:roughly|about|around)?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i;
const TEMP_PATTERN = /(?:temp|temperature)\s*(?:is|:)?\s*(?:roughly|about|around)?\s*(\d{2,3}(?:\.\d)?)\s*(?:°?F|degrees|f)?/i;
const PULSE_PATTERN = /(?:pulse|heart|rate)\s*(?:is|:)?\s*(?:roughly|about|around)?\s*(\d{2,3})/i;

function extractMedicines(text) {
  const medicines = [];
  const lines = text.split(/[.\n]/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    const dosageMatch = line.match(new RegExp(DOSAGE_PATTERNS.map((p) => p.source).join('|'), 'i'));
    const durationMatch = line.match(DURATION_PATTERN);

    // Improved medicine name extraction
    let medNameMatch = MED_NAME_PATTERN.exec(line);
    MED_NAME_PATTERN.lastIndex = 0; // Reset regex state

    if (medNameMatch || dosageMatch) {
      let name = medNameMatch ? medNameMatch[2].trim() : '';

      if (!name) {
        // Fallback: If dosage exists but no name via MED_NAME_PATTERN, take words before dosage
        const split = line.split(new RegExp(DOSAGE_PATTERNS.map((p) => p.source).join('|'), 'i'));
        name = split[0].replace(/(?:prescrib|give|start|add|take)\s+/gi, '').trim();
      }

      if (name.length >= 3) {
        // Clean up noise from the name (e.g. "SOS for fever")
        const cleanName = name
          .replace(/\s+(?:sos|for|if|with|at|before|after|twice|daily|once|thrice|daily|mg|tab|cap|tablet|days|weeks|weeks?\s+for).*$/i, '')
          .trim();

        medicines.push({
          name: cleanName.slice(0, 120),
          dosage: dosageMatch ? dosageMatch[0] : '1-0-1',
          duration: durationMatch ? `${durationMatch[1]} ${durationMatch[2]}` : '5 days',
        });
      }
    }
  }

  // Specific keyword check for known Indian medicines if list is empty
  if (medicines.length === 0) {
    const commonMeds = ['paracetamol', 'augmentin', 'amoxicillin', 'metformin', 'omeprazole', 'azithromycin', 'cetirizine', 'allegra', 'pan d', 'combiflam'];
    commonMeds.forEach(m => {
      if (text.toLowerCase().includes(m)) {
        medicines.push({ name: m.charAt(0).toUpperCase() + m.slice(1), dosage: '1-0-1', duration: '5 days' });
      }
    });
  }

  return medicines;
}

function extractSurgeries(text) {
  const surgeries = [];
  let match;
  while ((match = SURGERY_PATTERN.exec(text)) !== null) {
    surgeries.push({
      name: match[1].trim(),
      priority: text.toLowerCase().includes('emergency') ? 'Emergency' :
        text.toLowerCase().includes('urgent') ? 'Urgent' :
          text.toLowerCase().includes('elective') ? 'Elective' : 'Routine'
    });
  }
  return surgeries;
}

function extractVitals(text) {
  const vitals = {};
  const bp = text.match(BP_PATTERN);
  if (bp) vitals.bp = `${bp[1]}/${bp[2]}`;
  const temp = text.match(TEMP_PATTERN);
  if (temp) vitals.temp = temp[1] + '°F';
  const pulse = text.match(PULSE_PATTERN);
  if (pulse) vitals.pulse = pulse[1];
  return vitals;
}

function extractDiagnosis(text) {
  const diagPatterns = [
    /(?:diagnosis|diagnosed|suffering from|condition|impression|complaint)(?:\s+(?:is|of))?\s*:?\s*([^.?!\n]+)/i,
    /(?:likely|probable|suspect)\s+([^.?!\n]+)/i,
    /(?:has|having|suffering)\s+(?:a|an)\s+([^.?!\n,]+)/i, // Capture "has a [diagnosis]"
    /(?:flu|uti|hypertension|diabetes|infection|cold|cough|fever|acid reflux)[^.?!]*/gi,
  ];

  const sentences = text.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 5);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes('name is')) continue; // Skip intro sentence

    for (const p of diagPatterns) {
      const m = sentence.match(p);
      if (m && m[1]) return m[1].trim().slice(0, 150);
      if (m && !m[1]) return m[0].trim().slice(0, 150); // Direct keyword match
    }
  }
  return sentences[0]?.slice(0, 150) || 'Clinical encounter';
}

function extractNotes(text) {
  const notesPattern = /(?:notes?|advice|follow[- ]?up|instruction|diet)\s*:?\s*([^.]+(?:\.(?![^.]+$)[^.]+)*)/i;
  const m = text.match(notesPattern);
  if (m && m[1]) return m[1].trim().slice(0, 500);
  return 'As discussed with patient.';
}

/**
 * Generate structured prescription + clinical note from conversation transcript.
 */
export function transcriptToStructured(transcript, patientId, doctorId) {
  const medicines = extractMedicines(transcript);
  const surgeries = extractSurgeries(transcript);
  const vitals = extractVitals(transcript);
  const diagnosis = extractDiagnosis(transcript);
  const notes = extractNotes(transcript);

  const clinicalNote = {
    resourceType: 'Composition',
    status: 'final',
    type: { text: 'Clinical Note' },
    subject: { reference: `Patient/${patientId}` },
    author: [{ reference: `Practitioner/${doctorId}` }],
    date: new Date().toISOString(),
    title: 'Ambient Scribe – Clinical Note',
    section: [
      { title: 'Chief Complaint', text: { div: diagnosis } },
      { title: 'Vitals', text: { div: JSON.stringify(vitals) } },
      { title: 'Medicines', text: { div: JSON.stringify(medicines) } },
      { title: 'Surgeries/Procedures', text: { div: JSON.stringify(surgeries) } },
      { title: 'Assessment & Plan', text: { div: notes } },
    ],
  };

  return {
    vitals,
    diagnosis,
    notes,
    medicines,
    surgeries,
    clinicalNote,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Save scribe draft for "Review and Sign".
 */
export function saveScribeDraft(doctorId, patientId, transcript, structured) {
  const db = getDb();
  if (!db.scribeDrafts) db.scribeDrafts = [];
  const draft = {
    id: 'scribe-' + Date.now(),
    doctorId,
    patientId,
    transcript,
    structured: structured || transcriptToStructured(transcript, patientId, doctorId),
    consentRecorded: true,
    createdAt: new Date().toISOString(),
    status: 'draft',
  };
  db.scribeDrafts.push(draft);
  return draft;
}

/**
 * Get latest draft for doctor + patient.
 */
export function getScribeDraft(doctorId, patientId) {
  const db = getDb();
  const drafts = (db.scribeDrafts || []).filter((d) => d.doctorId === doctorId && d.patientId === patientId && d.status === 'draft');
  return drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

/**
 * Sign draft → create prescription and mark draft signed.
 */
export function signScribeDraft(draftId, doctorId) {
  const db = getDb();
  const draft = db.scribeDrafts?.find((d) => d.id === draftId && d.doctorId === doctorId);
  if (!draft || draft.status !== 'draft') return null;
  const { vitals, diagnosis, notes, medicines } = draft.structured;
  const prescription = {
    id: 'rx-' + Date.now(),
    patientId: draft.patientId,
    doctorId: draft.doctorId,
    visitDate: new Date().toISOString(),
    vitals: vitals || {},
    diagnosis: diagnosis || '',
    medicines: medicines || [],
    notes: notes || '',
    signedAt: new Date().toISOString(),
    source: 'ambient_scribe',
  };
  db.prescriptions.push(prescription);
  draft.status = 'signed';
  draft.signedAt = prescription.signedAt;
  return prescription;
}
