import { Router } from 'express';
import { authMiddleware, requireRole, requireVerifiedDoctor } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { getLongitudinalRecord } from '../services/longitudinal.js';
import { buildFlashSummary } from '../services/flashSummaryService.js';

const router = Router();

/** POST /api/doctor/scan-patient — After scanning patient QR (healthId or patientId). Returns patient info + previous reports if consent. */
router.post('/scan-patient', authMiddleware, requireVerifiedDoctor, async (req, res) => {
  try {
    const { healthId, patientId: rawPatientId } = req.body;
    const db = getDb();
    const patient = db.users.find(
      (u) => u.role === 'citizen' && (u.healthId === healthId || u.id === rawPatientId)
    );
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found', code: 'PATIENT_NOT_FOUND' });
    }
    const consent = db.consents.find(
      (c) => c.patientId === patient.id && c.doctorId === req.user.id && c.status === 'active' && new Date(c.expiresAt) > new Date()
    );
    const hasConsent = !!consent;
    const response = {
      patient: { id: patient.id, name: patient.name, healthId: patient.healthId, phone: patient.phone },
      hasConsent,
      message: hasConsent ? 'You can view this patient\'s medical reports.' : 'Request consent from the patient in the app to view their previous medical reports.',
    };
    if (hasConsent) {
      const longitudinal = getLongitudinalRecord(patient.id);
      const flashSummary = buildFlashSummary(patient.id);
      response.reports = {
        longitudinal,
        flashSummary,
        prescriptions: (db.prescriptions || []).filter((p) => p.patientId === patient.id).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)),
      };
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/queue', authMiddleware, requireVerifiedDoctor, async (req, res) => {
  try {
    const db = getDb();
    const queue = db.queue
      .filter((q) => q.doctorId === req.user.id && q.status === 'waiting')
      .map((q) => {
        const patient = db.users.find((u) => u.id === q.patientId);
        return { ...q, patient };
      });
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/patient/:id/history', authMiddleware, requireVerifiedDoctor, async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const db = getDb();
    const consents = db.consents.filter(
      (c) => c.patientId === patientId && c.doctorId === req.user.id && c.status === 'active' && new Date(c.expiresAt) > new Date()
    );
    if (consents.length === 0) {
      return res.status(403).json({ error: 'No consent to view this patient history' });
    }
    const history = db.prescriptions
      .filter((p) => p.patientId === patientId)
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/doctor/profile — Update doctor profile (address, location) */
router.patch('/profile', authMiddleware, requireRole('doctor'), async (req, res) => {
  try {
    const { address, latitude, longitude, city } = req.body;
    const db = getDb();
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (address != null) user.address = address;
    if (latitude != null) user.latitude = latitude;
    if (longitude != null) user.longitude = longitude;
    if (city != null) user.city = city;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
