import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { parsePrescriptionText, prescriptionToReminders } from '../services/ocrPrescriptionService.js';
import { getDb } from '../db.js';

const router = Router();

/** POST /api/ocr/prescription — Submit OCR text from handwritten prescription; returns parsed meds + reminders */
router.post('/prescription', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const { ocrText, imageBase64 } = req.body;
    const text = ocrText || (imageBase64 ? 'Placeholder: use Tesseract/cloud OCR on imageBase64' : '');
    const medicines = parsePrescriptionText(text);
    const reminders = prescriptionToReminders(medicines);
    const db = getDb();
    if (!db.reminders) db.reminders = [];
    const patientId = req.body.patientId || req.user.id;
    reminders.forEach((r) => {
      db.reminders.push({
        id: 'rem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        patientId,
        ...r,
        createdAt: new Date().toISOString(),
      });
    });
    res.status(201).json({ medicines, reminders, message: 'Medication reminders created from prescription.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
