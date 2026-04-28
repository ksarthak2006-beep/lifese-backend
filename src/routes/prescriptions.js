import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, requireRole, requireVerifiedDoctor } from '../middleware/auth.js';
import { getDb } from '../db.js';
import logger from '../utils/logger.js';
import { sendEmail, emailTemplates } from '../services/email.js';

const router = Router();

// ─── POST /api/prescriptions — Doctor creates a new prescription ─
router.post('/', authMiddleware, requireVerifiedDoctor, async (req, res) => {
  try {
    const { patientId, vitals, diagnosis, medicines, surgeries, signature, notes } = req.body;

    if (!patientId || (!medicines?.length && !surgeries?.length)) {
      return res.status(400).json({ error: 'Patient ID and at least one medicine or surgery are required.' });
    }

    const db = getDb();

    // Verify the patient exists
    const patient = db.users.find(u => u.id === patientId && u.role === 'citizen');
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    // Verify the doctor exists
    const doctor = db.users.find(u => u.id === req.user.id);

    const { checkDrugInteractions } = await import('../utils/safety.js');
    const medicationNames = (medicines || []).map(m => m.name || m);
    const safetyAlerts = checkDrugInteractions(medicationNames);

    const prescription = {
      id: 'RX-' + uuidv4().slice(0, 8).toUpperCase(),
      patientId,
      doctorId: req.user.id,
      visitDate: new Date().toISOString(),
      vitals: vitals || {},
      diagnosis: diagnosis || '',
      medicines: medicines || [],
      surgeries: surgeries || [],
      signature: signature || null,
      notes: notes || '',
      signedAt: new Date().toISOString(),
      safetyAlerts: safetyAlerts || [], // 🛡️ Clinical safety metadata
    };

    db.prescriptions.push(prescription);
    logger.info('Prescription created with safety check', { rxId: prescription.id, doctorId: req.user.id, alertsCount: safetyAlerts.length });

    // Non-blocking email notification to the patient
    if (patient.email) {
      const tpl = emailTemplates.prescriptionReady(patient.name);
      sendEmail({ to: patient.email, ...tpl }).catch((err) => {
        logger.warn('Prescription email failed (non-critical)', { patientId, error: err.message });
      });
    }

    res.status(201).json(prescription);
  } catch (err) {
    logger.error('Failed to create prescription', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/prescriptions/:id — Retrieve a prescription ───────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const rx = db.prescriptions.find((p) => p.id === req.params.id);
    if (!rx) return res.status(404).json({ error: 'Prescription not found' });

    // Citizens can only see their own prescriptions
    if (req.user.role === 'citizen' && rx.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Doctors must be the author, or have active consent from the patient
    if (req.user.role === 'doctor' && rx.doctorId !== req.user.id) {
      const consent = db.consents.find(
        (c) => c.patientId === rx.patientId && c.doctorId === req.user.id && c.status === 'active'
      );
      if (!consent) return res.status(403).json({ error: 'No active consent from this patient' });
    }

    res.json(rx);
  } catch (err) {
    logger.error('Failed to get prescription', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/prescriptions — List prescriptions for the caller ─
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    let rxList;

    if (req.user.role === 'citizen') {
      rxList = db.prescriptions.filter(p => p.patientId === req.user.id);
    } else if (req.user.role === 'doctor') {
      rxList = db.prescriptions.filter(p => p.doctorId === req.user.id);
    } else {
      rxList = db.prescriptions; // admin sees all
    }

    const mappedRx = rxList.map(rx => {
      const doc = db.users.find(u => u.id === rx.doctorId);
      return {
        ...rx,
        doctorName: doc?.name || 'Unknown Doctor',
        doctorStatus: doc?.verificationStatus || 'unverified'
      };
    });

    res.json({ prescriptions: mappedRx, total: mappedRx.length });
  } catch (err) {
    logger.error('Failed to list prescriptions', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
