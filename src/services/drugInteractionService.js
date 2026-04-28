/**
 * Drug-Drug Interaction Alerts
 * Checks new prescriptions against patient's linked history (all past hospitals) for adverse reactions.
 * Production: use FDA/OpenFDA or Lexicomp API; here we use a small stub list.
 */

const KNOWN_INTERACTIONS = [
  { drugs: ['warfarin', 'aspirin'], severity: 'high', message: 'Increased bleeding risk' },
  { drugs: ['warfarin', 'ibuprofen'], severity: 'high', message: 'Increased bleeding risk' },
  { drugs: ['metformin', 'contrast'], severity: 'medium', message: 'Lactic acidosis risk with contrast' },
  { drugs: ['ace inhibitor', 'potassium'], severity: 'medium', message: 'Hyperkalaemia risk' },
  { drugs: ['ssri', 'maoi'], severity: 'high', message: 'Serotonin syndrome risk' },
  { drugs: ['ciprofloxacin', 'calcium'], severity: 'low', message: 'Reduced absorption' },
  { drugs: ['simvastatin', 'erythromycin'], severity: 'high', message: 'Myopathy risk' },
];

function normalizeMedName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
}

function extractMedNames(medicines) {
  const names = new Set();
  (medicines || []).forEach((m) => {
    const n = normalizeMedName(m.name || m);
    if (n) names.add(n);
    (m.name || '').split(/\s+/).forEach((w) => w.length > 2 && names.add(normalizeMedName(w)));
  });
  return Array.from(names);
}

/**
 * Check proposed new medicines against current medication list; return interactions.
 */
export function checkInteractions(currentMedications, newMedications) {
  const current = extractMedNames(Array.isArray(currentMedications) ? currentMedications : [currentMedications]);
  const added = extractMedNames(Array.isArray(newMedications) ? newMedications : [newMedications]);
  const all = [...new Set([...current, ...added])];
  const alerts = [];
  for (const { drugs, severity, message } of KNOWN_INTERACTIONS) {
    const matchCount = drugs.filter((d) => all.some((m) => m.includes(d) || d.includes(m))).length;
    if (matchCount >= 2) alerts.push({ severity, message, drugs });
  }
  return alerts;
}
