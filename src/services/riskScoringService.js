/**
 * Predictive Risk Scoring & Predictive Health Analytics
 * Uses linked PHR/lab trends (e.g. HbA1c, BMI) to flag prediabetes and other risks.
 * Production: ML models (Random Forest, NN); here rule-based trend analysis.
 */

function parseNumeric(value) {
  if (value == null) return NaN;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Analyze observations over time for a given code (e.g. HbA1c, BMI).
 */
export function analyzeTrend(observations, code) {
  const filtered = (observations || [])
    .filter((o) => (o.code || o.testName || '').toLowerCase().includes((code || '').toLowerCase()))
    .map((o) => ({ date: o.date, value: parseNumeric(o.value || o.valueQuantity?.value) }))
    .filter((o) => !Number.isNaN(o.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (filtered.length < 2) return null;
  const first = filtered[0].value;
  const last = filtered[filtered.length - 1].value;
  const slope = (last - first) / filtered.length;
  return { first, last, slope, points: filtered.length, trend: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'stable' };
}

const RISK_RULES = [
  {
    id: 'prediabetes',
    code: 'hba1c',
    name: 'Prediabetes risk',
    check: (trend) => trend && trend.last >= 5.7 && trend.last < 6.5,
    message: 'HbA1c in prediabetes range. Consider lifestyle coaching and repeat test.',
  },
  {
    id: 'diabetes',
    code: 'hba1c',
    name: 'Diabetes risk',
    check: (trend) => trend && trend.last >= 6.5,
    message: 'HbA1c suggests diabetes. Please see an endocrinologist.',
  },
  {
    id: 'rising_hba1c',
    code: 'hba1c',
    name: 'Rising blood sugar trend',
    check: (trend) => trend && trend.slope > 0.1 && trend.points >= 2,
    message: 'Rising HbA1c over time. Consider prediabetes screening and lifestyle changes.',
  },
  {
    id: 'bmi_high',
    code: 'bmi',
    name: 'Elevated BMI',
    check: (trend) => trend && trend.last >= 25,
    message: 'BMI in overweight/obese range. Linked to diabetes and cardiovascular risk.',
  },
];

/**
 * Run risk rules on longitudinal observations; return flags.
 */
export function computeRiskFlags(observations) {
  const byCode = {};
  (observations || []).forEach((o) => {
    const code = (o.code || o.testName || 'other').toLowerCase();
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(o);
  });
  const flags = [];
  for (const rule of RISK_RULES) {
    const obs = byCode[rule.code] || [];
    const trend = analyzeTrend(obs, rule.code);
    if (rule.check(trend)) flags.push({ id: rule.id, name: rule.name, message: rule.message, severity: 'medium' });
  }
  return flags;
}
