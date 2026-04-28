import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getLongitudinalRecord } from '../services/longitudinal.js';
import { getDb } from '../db.js';

const router = Router();

/** GET /api/longitudinal — Get longitudinal health record for current user (by ABHA/healthId) */
router.get('/', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const userId = req.user.role === 'citizen' ? req.user.id : req.query.patientId;
    const abhaId = req.user.healthId || req.query.abhaId;
    const db = getDb();
    const targetUser = userId ? db.users.find((u) => u.id === userId) : db.users.find((u) => u.healthId === abhaId);
    const id = targetUser?.id || req.user.id;
    const record = getLongitudinalRecord(id);
    if (!record) return res.status(404).json({ error: 'Patient record not found' });
    if (req.user.role === 'citizen' && record.patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
