import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  linkFamilyMember,
  getLinkedFamily,
  refreshGuardianAlerts,
  getGuardianAlerts,
  setAlertAction,
} from '../services/guardianService.js';

const router = Router();

/** POST /api/guardian/link — Link a family member (ABHA or patientId) */
router.post('/link', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { abhaId, patientId, relation } = req.body;
    const id = abhaId || patientId;
    if (!id) return res.status(400).json({ error: 'abhaId or patientId required' });
    const link = linkFamilyMember(req.user.id, id, relation);
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/guardian/family — List linked family members */
router.get('/family', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const list = getLinkedFamily(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/guardian/refresh — Refresh alerts from linked members' data */
router.post('/refresh', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const newAlerts = refreshGuardianAlerts(req.user.id);
    res.json({ newAlerts: newAlerts.length, alerts: newAlerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/guardian/alerts — Get alerts for guardian (high-priority with Call Doctor) */
router.get('/alerts', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const alerts = getGuardianAlerts(req.user.id, activeOnly);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/guardian/alerts/:id/action — Mark "call_doctor" or "dismissed" */
router.post('/alerts/:id/action', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { action } = req.body;
    if (!['call_doctor', 'dismissed'].includes(action)) return res.status(400).json({ error: 'action must be call_doctor or dismissed' });
    const updated = setAlertAction(req.params.id, req.user.id, action);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
