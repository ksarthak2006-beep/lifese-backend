/**
 * Lab Report AI — "Plain English Lab Reports"
 * Parses uploaded lab report text, compares values to normal ranges,
 * generates plain-language explanations with status badges.
 */

// Normal ranges for common Indian lab tests
const LAB_RANGES = {
  // Blood Sugar
  'glucose': { min: 70, max: 100, unit: 'mg/dL', label: 'Blood Sugar (Fasting)', category: 'Metabolic' },
  'fasting glucose': { min: 70, max: 100, unit: 'mg/dL', label: 'Fasting Blood Sugar', category: 'Metabolic' },
  'random glucose': { min: 70, max: 140, unit: 'mg/dL', label: 'Random Blood Sugar', category: 'Metabolic' },
  'hba1c': { min: 4.0, max: 5.6, unit: '%', label: 'HbA1c (3-month sugar avg)', category: 'Metabolic' },
  'glycated hemoglobin': { min: 4.0, max: 5.6, unit: '%', label: 'HbA1c', category: 'Metabolic' },

  // Kidney
  'creatinine': { min: 0.6, max: 1.2, unit: 'mg/dL', label: 'Creatinine (Kidney function)', category: 'Kidney' },
  'urea': { min: 15, max: 40, unit: 'mg/dL', label: 'Blood Urea', category: 'Kidney' },
  'bun': { min: 7, max: 20, unit: 'mg/dL', label: 'Blood Urea Nitrogen', category: 'Kidney' },
  'uric acid': { min: 3.4, max: 7.0, unit: 'mg/dL', label: 'Uric Acid', category: 'Kidney' },
  'egfr': { min: 90, max: 120, unit: 'mL/min', label: 'eGFR (Kidney filtration)', category: 'Kidney' },
  'potassium': { min: 3.5, max: 5.0, unit: 'mEq/L', label: 'Potassium', category: 'Electrolytes' },
  'sodium': { min: 136, max: 145, unit: 'mEq/L', label: 'Sodium', category: 'Electrolytes' },

  // Liver
  'sgpt': { min: 7, max: 40, unit: 'U/L', label: 'SGPT/ALT (Liver enzyme)', category: 'Liver' },
  'alt': { min: 7, max: 40, unit: 'U/L', label: 'ALT/SGPT (Liver enzyme)', category: 'Liver' },
  'sgot': { min: 10, max: 40, unit: 'U/L', label: 'SGOT/AST (Liver enzyme)', category: 'Liver' },
  'ast': { min: 10, max: 40, unit: 'U/L', label: 'AST/SGOT (Liver enzyme)', category: 'Liver' },
  'bilirubin': { min: 0.1, max: 1.2, unit: 'mg/dL', label: 'Bilirubin (Jaundice marker)', category: 'Liver' },
  'albumin': { min: 3.5, max: 5.0, unit: 'g/dL', label: 'Albumin', category: 'Liver' },

  // Thyroid
  'tsh': { min: 0.5, max: 4.5, unit: 'mIU/L', label: 'TSH (Thyroid)', category: 'Thyroid' },
  't3': { min: 80, max: 200, unit: 'ng/dL', label: 'T3 (Thyroid)', category: 'Thyroid' },
  't4': { min: 5.0, max: 12.0, unit: 'µg/dL', label: 'T4 (Thyroid)', category: 'Thyroid' },

  // Blood Count
  'hemoglobin': { min: 12.0, max: 17.5, unit: 'g/dL', label: 'Hemoglobin', category: 'Blood Count' },
  'hgb': { min: 12.0, max: 17.5, unit: 'g/dL', label: 'Hemoglobin', category: 'Blood Count' },
  'hb': { min: 12.0, max: 17.5, unit: 'g/dL', label: 'Hemoglobin', category: 'Blood Count' },
  'wbc': { min: 4000, max: 11000, unit: '/µL', label: 'White Blood Cells (Immunity)', category: 'Blood Count' },
  'rbc': { min: 4.5, max: 5.5, unit: 'million/µL', label: 'Red Blood Cells', category: 'Blood Count' },
  'platelets': { min: 150000, max: 400000, unit: '/µL', label: 'Platelets', category: 'Blood Count' },
  'hematocrit': { min: 36, max: 50, unit: '%', label: 'Hematocrit', category: 'Blood Count' },

  // Lipids / Cholesterol
  'cholesterol': { min: 0, max: 200, unit: 'mg/dL', label: 'Total Cholesterol', category: 'Heart' },
  'total cholesterol': { min: 0, max: 200, unit: 'mg/dL', label: 'Total Cholesterol', category: 'Heart' },
  'ldl': { min: 0, max: 100, unit: 'mg/dL', label: 'LDL (Bad cholesterol)', category: 'Heart' },
  'hdl': { min: 40, max: 999, unit: 'mg/dL', label: 'HDL (Good cholesterol)', category: 'Heart' },
  'triglycerides': { min: 0, max: 150, unit: 'mg/dL', label: 'Triglycerides', category: 'Heart' },

  // Vitamins & Minerals
  'vitamin d': { min: 30, max: 100, unit: 'ng/mL', label: 'Vitamin D', category: 'Vitamins' },
  'vitamin b12': { min: 200, max: 900, unit: 'pg/mL', label: 'Vitamin B12', category: 'Vitamins' },
  'iron': { min: 60, max: 170, unit: 'µg/dL', label: 'Iron', category: 'Vitamins' },
  'ferritin': { min: 12, max: 300, unit: 'ng/mL', label: 'Ferritin (Iron stores)', category: 'Vitamins' },
  'calcium': { min: 8.5, max: 10.5, unit: 'mg/dL', label: 'Calcium', category: 'Electrolytes' },
};

const PLAIN_ENGLISH = {
  'Metabolic': 'your body\'s sugar/energy processing',
  'Kidney': 'how well your kidneys are filtering waste',
  'Liver': 'your liver\'s health and function',
  'Thyroid': 'your thyroid gland\'s activity',
  'Blood Count': 'the cells in your blood',
  'Heart': 'your heart health and blood fat levels',
  'Vitamins': 'important vitamins and minerals your body needs',
  'Electrolytes': 'salt and mineral balance in your blood',
};

function getStatusForValue(value, range) {
  // Special case: HDL — higher is better
  if (range.label.includes('HDL')) {
    if (value < range.min) return { status: 'LOW', severity: 'warning', emoji: '⚠️' };
    return { status: 'GOOD', severity: 'normal', emoji: '✅' };
  }
  if (range.min === 0) {
    // Only upper bound matters
    if (value > range.max * 1.5) return { status: 'VERY HIGH', severity: 'danger', emoji: '🚨' };
    if (value > range.max) return { status: 'HIGH', severity: 'warning', emoji: '⚠️' };
    return { status: 'GOOD', severity: 'normal', emoji: '✅' };
  }
  const deviation = Math.abs((value - (range.min + range.max) / 2) / ((range.max - range.min) / 2));
  if (value < range.min * 0.7) return { status: 'VERY LOW', severity: 'danger', emoji: '🚨' };
  if (value < range.min) return { status: 'LOW', severity: 'warning', emoji: '⚠️' };
  if (value > range.max * 1.5) return { status: 'VERY HIGH', severity: 'danger', emoji: '🚨' };
  if (value > range.max) return { status: 'HIGH', severity: 'warning', emoji: '⚠️' };
  return { status: 'GOOD', severity: 'normal', emoji: '✅' };
}

function generatePlainExplanation(label, value, unit, statusObj, range) {
  const { status } = statusObj;
  const labelLower = label.toLowerCase();

  if (status === 'GOOD') {
    return `Your ${label} is ${value} ${unit} — this is in the healthy range (${range.min}–${range.max} ${unit}). No action needed.`;
  }

  const explanations = {
    'HbA1c': {
      HIGH: `Your HbA1c is ${value}% — this is above normal (normal: below 5.7%). This shows your average blood sugar over the last 3 months has been higher than ideal. Please discuss diabetes management with your doctor.`,
      VERY_HIGH: `Your HbA1c is ${value}% — this is significantly elevated. This suggests poor blood sugar control and increases your risk of diabetes complications. See your doctor urgently.`,
      LOW: `Your HbA1c is ${value}% — slightly below the typical range. This is usually not concerning on its own.`,
    },
    'Creatinine': {
      HIGH: `Your creatinine is ${value} ${unit} — above normal (normal: 0.6–1.2). This may indicate your kidneys are not filtering as efficiently as they should. Drink more water and consult your doctor.`,
      VERY_HIGH: `Your creatinine is ${value} ${unit} — significantly elevated. This is a sign of possible kidney dysfunction. Please see your doctor promptly.`,
    },
    'Hemoglobin': {
      LOW: `Your hemoglobin is ${value} ${unit} — you may be anaemic (low blood count). You might feel tired or breathless. Eat more iron-rich foods (spinach, lentils, meat) and talk to your doctor.`,
      VERY_LOW: `Your hemoglobin is ${value} ${unit} — this is quite low and you likely have significant anaemia. Please see a doctor soon.`,
    },
    'TSH': {
      HIGH: `Your TSH is ${value} ${unit} — above normal. This may indicate your thyroid is underactive (hypothyroidism). Common symptoms: fatigue, weight gain, feeling cold. Talk to your doctor.`,
      LOW: `Your TSH is ${value} ${unit} — below normal. This may indicate an overactive thyroid. Common symptoms: anxiety, weight loss, rapid heartbeat. Consult your doctor.`,
    },
    'LDL': {
      HIGH: `Your LDL (bad cholesterol) is ${value} ${unit} — above ideal (should be below 100). High LDL increases heart disease risk. Reduce fried foods, exercise more, and see your doctor.`,
      VERY_HIGH: `Your LDL cholesterol is dangerously high at ${value} ${unit}. This significantly raises your heart attack and stroke risk. Please see your doctor urgently.`,
    },
    'Vitamin D': {
      LOW: `Your Vitamin D is ${value} ${unit} — you are Vitamin D deficient. Very common in India! This causes bone weakness and fatigue. Take Vitamin D supplements (ask your doctor for dosage) and get 15 minutes of morning sunlight.`,
      VERY_LOW: `Your Vitamin D is critically low at ${value} ${unit}. Please start treatment with your doctor immediately — severe deficiency can cause serious bone and immune problems.`,
    },
  };

  // Look up by key words
  for (const [key, messages] of Object.entries(explanations)) {
    if (labelLower.includes(key.toLowerCase())) {
      const msg = messages[status.replace(' ', '_')] || messages[status];
      if (msg) return msg;
    }
  }

  // Generic fallback
  if (status.includes('HIGH')) {
    return `Your ${label} is ${value} ${unit} — above the normal range (normal: ${range.min}–${range.max} ${unit}). Please discuss this with your doctor.`;
  }
  if (status.includes('LOW')) {
    return `Your ${label} is ${value} ${unit} — below the normal range (normal: ${range.min}–${range.max} ${unit}). Please discuss this with your doctor.`;
  }
  return `Your ${label} is ${value} ${unit}.`;
}

/**
 * Parse pasted lab report text into structured results.
 */
export function parseLabReportText(reportText) {
  if (!reportText || typeof reportText !== 'string') return { results: [], summary: null };

  const lines = reportText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const results = [];
  const found = new Set();

  // Pattern: "TestName : Value Unit" or "TestName   45.2   mg/dL"
  const valuePattern = /(\d+\.?\d*)/;

  for (const line of lines) {
    const lineLower = line.toLowerCase();

    for (const [key, range] of Object.entries(LAB_RANGES)) {
      if (found.has(key)) continue;
      if (!lineLower.includes(key)) continue;

      const numMatch = line.match(valuePattern);
      if (!numMatch) continue;

      const value = parseFloat(numMatch[1]);
      if (isNaN(value) || value <= 0) continue;

      // Sanity check — value should be vaguely plausible for this test
      const rangeMid = (range.min + range.max) / 2;
      if (value > rangeMid * 50 || value < rangeMid * 0.01) continue;

      const statusObj = getStatusForValue(value, range);
      const explanation = generatePlainExplanation(range.label, value, range.unit, statusObj, range);

      results.push({
        key,
        label: range.label,
        category: range.category,
        value,
        unit: range.unit,
        normalMin: range.min,
        normalMax: range.max,
        status: statusObj.status,
        severity: statusObj.severity,
        emoji: statusObj.emoji,
        plainExplanation: explanation,
      });

      found.add(key);
      break;
    }
  }

  const summary = generateOverallSummary(results);
  return { results, summary };
}

function generateOverallSummary(results) {
  if (!results.length) {
    return {
      headline: 'Could not read report',
      message: 'We could not extract any test values from the text. Please paste the full text of your lab report and try again.',
      narrative: null,
      overallStatus: 'unknown',
    };
  }

  const danger  = results.filter((r) => r.severity === 'danger');
  const warning = results.filter((r) => r.severity === 'warning');
  const normal  = results.filter((r) => r.severity === 'normal');

  // ── AI Narrative Storyteller ──────────────────────────────────────────────
  // Generates a medically-informed, personalized paragraph — not just a list.
  const narrative = generateHealthNarrative(results, danger, warning, normal);

  if (danger.length > 0) {
    return {
      headline: `🚨 ${danger.length} test${danger.length > 1 ? 's need' : ' needs'} urgent attention`,
      message: `Out of ${results.length} tests we read, ${danger.length} show critical values. ${warning.length > 0 ? `Additionally, ${warning.length} test${warning.length > 1 ? 's are' : ' is'} mildly abnormal.` : ''}`,
      narrative,
      overallStatus: 'danger',
    };
  }

  if (warning.length > 0) {
    return {
      headline: `⚠️ ${warning.length} test${warning.length > 1 ? 's are' : ' is'} slightly out of range`,
      message: `Out of ${results.length} tests, ${normal.length} look healthy and ${warning.length} ${warning.length > 1 ? 'are' : 'is'} mildly abnormal. Discuss these with your doctor at your next visit.`,
      narrative,
      overallStatus: 'warning',
    };
  }

  return {
    headline: `✅ All ${results.length} tests look healthy!`,
    message: `Great news — all ${results.length} values we analysed are within normal range. Keep up your healthy habits!`,
    narrative,
    overallStatus: 'normal',
  };
}

/**
 * AI Narrative Engine — generates a human-readable health story from structured lab results.
 * Uses clinical correlation logic to produce meaningful, actionable insights.
 */
function generateHealthNarrative(results, danger, warning, normal) {
  const insights = [];

  // ── Metabolic / Diabetes cluster ─────────────────────────────────────────
  const hba1c     = results.find(r => r.key === 'hba1c');
  const glucose   = results.find(r => r.key === 'fasting glucose' || r.key === 'glucose');
  if (hba1c && glucose) {
    if (hba1c.severity !== 'normal' && glucose.severity !== 'normal') {
      insights.push(`Your blood sugar markers — HbA1c (${hba1c.value}%) and fasting glucose (${glucose.value} mg/dL) — are both elevated, which together suggest poor blood sugar regulation and possible pre-diabetes or diabetes. This combination warrants an urgent discussion with your doctor about lifestyle changes or medication.`);
    } else if (hba1c.severity !== 'normal') {
      insights.push(`Your HbA1c of ${hba1c.value}% suggests your average blood sugar has been elevated over the past 3 months. Even though your fasting glucose looks acceptable today, this 3-month picture is important — speak with your doctor about dietary changes.`);
    }
  }

  // ── Anaemia cluster ───────────────────────────────────────────────────────
  const hb      = results.find(r => r.key === 'hemoglobin' || r.key === 'hgb' || r.key === 'hb');
  const iron    = results.find(r => r.key === 'iron');
  const ferritin = results.find(r => r.key === 'ferritin');
  const vitB12  = results.find(r => r.key === 'vitamin b12');
  if (hb && hb.severity !== 'normal') {
    if (iron?.severity !== 'normal' || ferritin?.severity !== 'normal') {
      insights.push(`Your hemoglobin is low (${hb.value} g/dL) alongside low iron stores — this is a classic pattern of iron-deficiency anaemia. You may be feeling fatigued, breathless, or dizzy. Eating iron-rich foods (leafy greens, legumes, red meat) and taking supplements your doctor recommends can help restore normal levels.`);
    } else if (vitB12?.severity !== 'normal') {
      insights.push(`Your hemoglobin (${hb.value} g/dL) is low alongside a low Vitamin B12 (${vitB12.value} pg/mL). This pattern suggests megaloblastic anaemia — common in vegetarians and the elderly. B12 injections or high-dose supplements often correct this quickly. Please see your doctor.`);
    } else {
      insights.push(`Your hemoglobin is ${hb.value} g/dL — below normal range. This could have several causes. Your doctor will want to investigate further.`);
    }
  }

  // ── Cardiovascular / Lipid cluster ────────────────────────────────────────
  const ldl          = results.find(r => r.key === 'ldl');
  const hdl          = results.find(r => r.key === 'hdl');
  const triglycerides = results.find(r => r.key === 'triglycerides');
  const cholesterol   = results.find(r => r.key === 'cholesterol' || r.key === 'total cholesterol');
  if (ldl?.severity !== 'normal' && triglycerides?.severity !== 'normal') {
    insights.push(`Both your LDL cholesterol (${ldl.value} mg/dL) and triglycerides (${triglycerides.value} mg/dL) are elevated. This combination significantly raises your cardiovascular risk. Reducing fried and processed foods, exercising regularly, and discussing statin therapy with your doctor are important next steps.`);
  } else if (ldl?.severity !== 'normal') {
    insights.push(`Your LDL (bad cholesterol) of ${ldl.value} mg/dL is above the ideal level. ${hdl ? `Your HDL (good cholesterol) of ${hdl.value} is ${hdl.severity === 'normal' ? 'healthy, which partially compensates.' : 'also lower than ideal.'}` : ''} Reducing saturated fats and increasing exercise can help.`);
  }

  // ── Kidney function ───────────────────────────────────────────────────────
  const creatinine = results.find(r => r.key === 'creatinine');
  const egfr       = results.find(r => r.key === 'egfr');
  if (creatinine?.severity !== 'normal' || egfr?.severity !== 'normal') {
    insights.push(`Your kidney function markers${creatinine ? ` (creatinine: ${creatinine.value} mg/dL)` : ''}${egfr ? ` and eGFR (${egfr.value} mL/min)` : ''} suggest your kidneys may not be filtering as efficiently as they should. Staying well-hydrated and avoiding NSAIDs (like ibuprofen) is advisable while you follow up with your doctor.`);
  }

  // ── Thyroid ───────────────────────────────────────────────────────────────
  const tsh = results.find(r => r.key === 'tsh');
  if (tsh && tsh.severity !== 'normal') {
    const direction = tsh.value > 4.5 ? 'underactive (hypothyroidism) — causing fatigue, weight gain, and feeling cold' : 'overactive (hyperthyroidism) — causing anxiety, weight loss, and rapid heartbeat';
    insights.push(`Your TSH level of ${tsh.value} mIU/L suggests your thyroid may be ${direction}. Thyroid conditions are very treatable once properly diagnosed — please see your doctor for a follow-up thyroid panel.`);
  }

  // ── Vitamin D (extremely common in India) ─────────────────────────────────
  const vitD = results.find(r => r.key === 'vitamin d');
  if (vitD && vitD.severity !== 'normal') {
    insights.push(`Your Vitamin D level is ${vitD.value} ng/mL, which is deficient. This is extremely common in India, especially in urban populations who spend most time indoors. Vitamin D deficiency causes bone pain, fatigue, and reduced immunity. Talk to your doctor about a supplement regimen and try to get 15–20 minutes of morning sunlight daily.`);
  }

  // ── Liver health ──────────────────────────────────────────────────────────
  const sgpt = results.find(r => r.key === 'sgpt' || r.key === 'alt');
  const sgot = results.find(r => r.key === 'sgot' || r.key === 'ast');
  if (sgpt?.severity !== 'normal' && sgot?.severity !== 'normal') {
    insights.push(`Both your liver enzymes (SGPT: ${sgpt.value} U/L, SGOT: ${sgot.value} U/L) are elevated. This can be caused by fatty liver, certain medications, or viral infections. Reducing alcohol and processed food intake is a good first step — and a follow-up liver ultrasound may be recommended.`);
  }

  // ── Compose final narrative ───────────────────────────────────────────────
  if (insights.length === 0) {
    if (warning.length === 0 && danger.length === 0) {
      return `Excellent news — all ${normal.length} values reviewed are within healthy ranges. Your key metabolic, blood, and organ function markers look good. Continue your current lifestyle habits, and keep up with annual checkups to maintain this trajectory.`;
    }
    return null; // Let the standard message handle it
  }

  const priority = danger.length > 0 ? 'Here is what your results are telling you:' : 'Here is a personalised summary of your results:';

  return `${priority} ${insights.join(' ')}`;
}

/**
 * Group results by category for display.
 */
export function groupResultsByCategory(results) {
  const groups = {};
  for (const r of results) {
    if (!groups[r.category]) {
      groups[r.category] = {
        category: r.category,
        description: PLAIN_ENGLISH[r.category] || r.category,
        results: [],
      };
    }
    groups[r.category].results.push(r);
  }
  return Object.values(groups);
}
