/**
 * Automated Prescription Transcription (OCR)
 * Reads handwritten/printed prescription text and creates medication reminders.
 * Production: use Tesseract.js or cloud OCR (Google Vision, AWS Textract).
 */

/**
 * Parse OCR text into structured medicines (name, dosage, duration).
 * Heuristic: look for patterns like "Tab Paracetamol 500mg 1-0-1 5 days"
 */
export function parsePrescriptionText(ocrText) {
  if (!ocrText || typeof ocrText !== 'string') return [];
  const lines = ocrText.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const medicines = [];
  const dosagePattern = /(\d-\d-\d|\d+\s*times\s*(?:a|per)\s*day|once\s*daily|bd|tds|od|bd)/i;
  const durationPattern = /(\d+)\s*(days?|weeks?|months?)/i;
  for (const line of lines) {
    const dosageMatch = line.match(dosagePattern);
    const durationMatch = line.match(durationPattern);
    let name = line
      .replace(dosagePattern, '')
      .replace(durationPattern, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 3) continue;
    medicines.push({
      name: name.slice(0, 120),
      dosage: dosageMatch ? dosageMatch[1] : '',
      duration: durationMatch ? `${durationMatch[1]} ${durationMatch[2]}` : '',
    });
  }
  return medicines.length ? medicines : [{ name: 'Unknown medicine', dosage: '', duration: '' }];
}

/**
 * Build medication reminders from parsed prescription (e.g. 1-0-1 -> morning, evening).
 */
export function prescriptionToReminders(medicines, startDate = new Date()) {
  const reminders = [];
  const start = new Date(startDate);
  (medicines || []).forEach((med, idx) => {
    const dosage = (med.dosage || '').toLowerCase();
    if (dosage.includes('1-0-1') || dosage.includes('1-0-1')) {
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '08:00', label: 'Morning' });
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '20:00', label: 'Evening' });
    } else if (dosage.includes('0-0-1') || dosage.includes('night')) {
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '21:00', label: 'Night' });
    } else if (dosage.includes('1-1-1') || dosage.includes('tds')) {
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '08:00', label: 'Morning' });
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '14:00', label: 'Afternoon' });
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '20:00', label: 'Evening' });
    } else {
      reminders.push({ medicineId: `m-${idx}`, name: med.name, time: '08:00', label: 'Default' });
    }
  });
  return reminders;
}
