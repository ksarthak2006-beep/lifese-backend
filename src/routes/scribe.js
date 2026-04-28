import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  transcriptToStructured,
  saveScribeDraft,
  getScribeDraft,
  signScribeDraft,
} from '../services/ambientScribeService.js';

const router = Router();

/** POST /api/scribe/transcript — Submit conversation transcript (with consent); get structured prescription + note */
router.post('/transcript', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { transcript, patientId } = req.body;
    if (!transcript || !patientId) return res.status(400).json({ error: 'transcript and patientId required' });
    const structured = transcriptToStructured(transcript, patientId, req.user.id);
    const draft = saveScribeDraft(req.user.id, patientId, transcript, structured);
    res.status(201).json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/scribe/draft — Get latest draft for doctor + patient */
router.get('/draft', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const patientId = req.query.patientId;
    if (!patientId) return res.status(400).json({ error: 'patientId required' });
    const draft = getScribeDraft(req.user.id, patientId);
    if (!draft) return res.status(404).json({ error: 'No draft found' });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/scribe/sign — Review and Sign: convert draft to prescription */
router.post('/sign', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { draftId } = req.body;
    if (!draftId) return res.status(400).json({ error: 'draftId required' });
    const prescription = signScribeDraft(draftId, req.user.id);
    if (!prescription) return res.status(404).json({ error: 'Draft not found or already signed' });
    res.json(prescription);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
