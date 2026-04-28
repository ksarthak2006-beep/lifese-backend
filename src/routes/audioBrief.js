/**
 * Pre-Consultation Audio Brief Routes
 * POST /api/audio-brief/generate   — Generate a brief for a patient
 * GET  /api/audio-brief/:patientId — Get existing brief
 * GET  /api/audio-brief/today      — All today's briefs for doctor
 */
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { generateAudioBrief, getBrief, getTodaysBriefs } from '../services/audioBriefService.js';

const router = Router();

router.post('/generate', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { patientId, slotTime } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId required' });
    const brief = generateAudioBrief(req.user.id, patientId, slotTime || new Date().toISOString());
    res.status(201).json(brief);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/today', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    res.json(getTodaysBriefs(req.user.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:patientId', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const brief = getBrief(req.user.id, req.params.patientId);
    if (!brief) return res.status(404).json({ error: 'Brief not found — generate one first' });
    res.json(brief);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
