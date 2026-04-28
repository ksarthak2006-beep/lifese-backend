/**
 * AI-Powered Triage (Symptom Checker)
 * Clinical-grade NLP-style symptom assessment to recommend the right specialist.
 * Production: integrate with NLP model (e.g. clinical BERT, symptom-to-specialty classifier).
 */

const SYMPTOM_TO_SPECIALTY = {
  // Cardiovascular
  chest: 'Cardiologist',
  heart: 'Cardiologist',
  'chest pain': 'Cardiologist',
  palpitation: 'Cardiologist',
  arrhythmia: 'Cardiologist',
  tachycardia: 'Cardiologist',
  // Respiratory
  breath: 'Pulmonologist',
  cough: 'Pulmonologist',
  asthma: 'Pulmonologist',
  wheezing: 'Pulmonologist',
  shortness: 'Pulmonologist',
  // Neurological
  headache: 'Neurologist',
  migraine: 'Neurologist',
  dizziness: 'Neurologist',
  seizure: 'Neurologist',
  tremor: 'Neurologist',
  numbness: 'Neurologist',
  paralysis: 'Neurologist',
  // Gastrointestinal
  stomach: 'Gastroenterologist',
  abdomen: 'Gastroenterologist',
  nausea: 'Gastroenterologist',
  diarrhoea: 'Gastroenterologist',
  bloating: 'Gastroenterologist',
  gastritis: 'Gastroenterologist',
  // Dermatology
  skin: 'Dermatologist',
  rash: 'Dermatologist',
  itching: 'Dermatologist',
  acne: 'Dermatologist',
  eczema: 'Dermatologist',
  // Ophthalmology
  eye: 'Ophthalmologist',
  vision: 'Ophthalmologist',
  blurred: 'Ophthalmologist',
  cataract: 'Ophthalmologist',
  // ENT
  ear: 'ENT Specialist',
  throat: 'ENT Specialist',
  nose: 'ENT Specialist',
  sinus: 'ENT Specialist',
  tinnitus: 'ENT Specialist',
  // General Metabolism
  fever: 'General Physician',
  cold: 'General Physician',
  flu: 'General Physician',
  fatigue: 'General Physician',
  weakness: 'General Physician',
  diabetes: 'Endocrinologist',
  thyroid: 'Endocrinologist',
  sugar: 'Endocrinologist',
  'blood pressure': 'General Physician',
  hypertension: 'General Physician',
  bp: 'General Physician',
  // Mental Health
  mental: 'Psychiatrist',
  anxiety: 'Psychiatrist',
  depression: 'Psychiatrist',
  sleep: 'Psychiatrist',
  insomnia: 'Psychiatrist',
  // Renal / Urology
  kidney: 'Nephrologist',
  urine: 'Urologist',
  bladder: 'Urologist',
  'kidney stone': 'Urologist',
  // Orthopedic
  bone: 'Orthopedician',
  fracture: 'Orthopedician',
  'back pain': 'Orthopedician',
  spine: 'Orthopedician',
  joint: 'Orthopedician',
  arthritis: 'Rheumatologist',
  sprain: 'Orthopedician',
};

const DEFAULT_SPECIALTY = 'General Physician';

/**
 * Analyze free-text symptoms and return recommended specialty + urgency hint.
 */
export function triageFromSymptoms(text) {
  if (!text || typeof text !== 'string') {
    return {
      specialty: 'None',
      confidence: 0,
      keywords: [],
      urgency: 'normal',
      message: 'Please describe your clinical symptoms for a professional assessment.'
    };
  }

  const lower = text.toLowerCase().trim();

  // Professional Requirement: Ensure input is descriptive enough for triage
  if (lower.length < 10) {
    return {
      specialty: 'None',
      confidence: 0,
      keywords: [],
      urgency: 'normal',
      message: 'Input too brief. Please provide a detailed description of your condition (e.g., "I have a sharp pain in my upper abdomen").'
    };
  }

  const matched = [];
  for (const [keyword, specialty] of Object.entries(SYMPTOM_TO_SPECIALTY)) {
    // Professional matching: ensure keyword is a standalone word or matches clinical patterns
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lower)) {
      matched.push({ keyword, specialty });
    }
  }

  // Strictly require at least one medical keyword for a professional recommendation
  if (matched.length === 0) {
    return {
      specialty: 'None',
      confidence: 0,
      keywords: [],
      urgency: 'normal',
      message: "No clinical symptoms were identified in your description. To get a recommendation, please describe your pain, location, or discomfort (e.g. fever, headache, chest pain)."
    };
  }

  const bySpecialty = {};
  matched.forEach(({ specialty }) => {
    bySpecialty[specialty] = (bySpecialty[specialty] || 0) + 1;
  });

  const sorted = Object.entries(bySpecialty).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const specialty = top[0];

  // Confidence increases with more matched keywords
  const confidence = Math.min(0.98, 0.6 + top[1] * 0.1);

  // Urgency check for life-threatening or acute conditions
  const isHighUrgency = lower.match(/\b(severe|sharp|emergency|unconscious|unable to breathe|chest pain|stroke|bleeding|paralysis)\b/i);
  const urgency = isHighUrgency ? 'high' : 'normal';

  return {
    specialty,
    confidence,
    keywords: matched.map((m) => m.keyword),
    urgency,
    message: isHighUrgency
      ? `CRITICAL: Your symptoms suggest an acute condition requiring a ${specialty}. Please seek immediate medical attention.`
      : `Based on the clinical markers identified, we recommend consulting a ${specialty} for further evaluation.`,
  };
}
