import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { buildFlashSummary } from '../services/flashSummaryService.js';
import { getDb } from '../db.js';

const router = Router();

/** GET /api/flash-summary/:patientId — One-click 1-page clinical highlight from linked ABHA records */
router.get('/:patientId', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { patientId } = req.params;
    const db = getDb();
    const consent = db.consents.find(
      (c) => c.patientId === patientId && c.doctorId === req.user.id && c.status === 'active' && new Date(c.expiresAt) > new Date()
    );
    if (!consent) return res.status(403).json({ error: 'No consent to view this patient' });
    const summary = buildFlashSummary(patientId);
    if (!summary) return res.status(404).json({ error: 'No longitudinal record for patient' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
