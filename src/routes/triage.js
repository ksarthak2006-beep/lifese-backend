import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { triageFromSymptoms } from '../services/triageService.js';
import { getAggregatedSlots } from '../services/bookingEngine.js';
import { getDb } from '../db.js';

const router = Router();

/** POST /api/triage/symptoms — AI symptom checker; returns recommended specialty */
router.post('/symptoms', authMiddleware, (req, res) => {
  try {
    const { text, voiceTranscript } = req.body;
    const input = text || voiceTranscript || '';
    const result = triageFromSymptoms(input);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/triage/suggest-doctor — Suggest doctor by specialty + optional location (e.g. within 5km) */
router.get('/suggest-doctor', authMiddleware, (req, res) => {
  try {
    const { specialty, date, radiusKm } = req.query;
    const slots = getAggregatedSlots({ date, type: 'doctor', radiusKm });
    const db = getDb();
    let providers = slots.providers || [];
    if (specialty) {
      const spec = (specialty || '').toLowerCase();
      providers = providers.filter((p) => (p.providerName || '').toLowerCase().includes(spec));
    }
    res.json({ specialty: specialty || 'Any', providers, date: slots.date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
