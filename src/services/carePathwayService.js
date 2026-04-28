/**
 * Automated Care Pathways
 * e.g. Hypertension: monthly follow-ups, daily BP logging reminders, quarterly labs.
 */

const PATHWAY_TEMPLATES = {
  hypertension: {
    id: 'hypertension',
    name: 'Hypertension Care Pathway',
    tasks: [
      { type: 'follow_up', frequency: 'monthly', title: 'Monthly follow-up with doctor' },
      { type: 'reminder', frequency: 'daily', title: 'Log BP reading' },
      { type: 'lab', frequency: 'quarterly', title: 'Quarterly kidney function & electrolytes' },
    ],
  },
  diabetes: {
    id: 'diabetes',
    name: 'Diabetes Care Pathway',
    tasks: [
      { type: 'follow_up', frequency: 'quarterly', title: 'Quarterly HbA1c review' },
      { type: 'reminder', frequency: 'daily', title: 'Medication and blood sugar log' },
      { type: 'lab', frequency: 'annual', title: 'Annual eye and foot check' },
    ],
  },
  default: {
    id: 'default',
    name: 'General Follow-up',
    tasks: [{ type: 'follow_up', frequency: 'as_needed', title: 'Follow up as advised' }],
  },
};

/**
 * Get or create care pathway for a diagnosis.
 */
export function getOrCreatePathway(patientId, diagnosis) {
  const key = (diagnosis || '').toLowerCase().includes('hypertension') || (diagnosis || '').toLowerCase().includes('blood pressure')
    ? 'hypertension'
    : (diagnosis || '').toLowerCase().includes('diabetes') || (diagnosis || '').toLowerCase().includes('dm')
    ? 'diabetes'
    : 'default';
  const template = PATHWAY_TEMPLATES[key] || PATHWAY_TEMPLATES.default;
  return {
    ...template,
    patientId,
    diagnosis,
    startedAt: new Date().toISOString(),
    tasks: template.tasks.map((t, i) => ({ ...t, id: `task-${patientId}-${key}-${i}`, status: 'pending' })),
  };
}
