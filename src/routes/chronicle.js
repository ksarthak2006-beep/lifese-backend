import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  extractChronicleEventsFromBundle,
  createEventFromOcr,
  ingestChronicleEvents,
  searchChronicle,
  getChronicleTimeline,
} from '../services/chronicleService.js';
import { getLongitudinalRecord } from '../services/longitudinal.js';
import { getDb } from '../db.js';

const router = Router();

/** POST /api/chronicle/ingest — Ingest FHIR bundle or OCR document into the medical biography */
router.post('/ingest', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const patientId = req.body.patientId || req.user.id;
    const db = getDb();
    if (req.user.role === 'citizen' && patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    let events = [];
    if (req.body.bundle) {
      events = extractChronicleEventsFromBundle(req.body.bundle, patientId);
    } else if (req.body.ocr) {
      const one = createEventFromOcr(patientId, req.body.ocr);
      events = [one];
    }
    if (events.length === 0) return res.status(400).json({ error: 'Provide bundle or ocr payload' });

    const count = ingestChronicleEvents(patientId, events);
    res.status(201).json({ ingested: count, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/chronicle/timeline — Full biography timeline */
router.get('/timeline', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const patientId = req.query.patientId || req.user.id;
    if (req.user.role === 'citizen' && patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const events = getChronicleTimeline(patientId);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/chronicle/search?q= — Searchable medical biography ("When did your knee pain start?") */
router.get('/search', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const patientId = req.query.patientId || req.user.id;
    const q = req.query.q || '';
    if (req.user.role === 'citizen' && patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const result = searchChronicle(patientId, q);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/chronicle/search — Same with body { q, patientId? } */
router.post('/search', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const patientId = req.body.patientId || req.user.id;
    const q = req.body.q || '';
    if (req.user.role === 'citizen' && patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const result = searchChronicle(patientId, q);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/chronicle/sync — Sync longitudinal (LifeSe) data into chronicle so biography is searchable */
router.post('/sync', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const patientId = req.body.patientId || req.user.id;
    if (req.user.role === 'citizen' && patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const record = getLongitudinalRecord(patientId);
    if (!record) return res.status(404).json({ error: 'No longitudinal record' });
    const events = [];
    (record.encounters || []).forEach((e) => {
      events.push(createEventFromOcr(patientId, {
        date: e.date,
        type: 'visit',
        summary: e.diagnosis || 'Visit',
        fullText: [e.diagnosis, e.provider].filter(Boolean).join(' '),
        codes: e.diagnosis ? [e.diagnosis] : [],
      }));
    });
    (record.observations || []).forEach((o) => {
      events.push(createEventFromOcr(patientId, {
        date: o.date,
        type: 'lab',
        summary: `${o.display || o.code}: ${o.value} ${o.unit || ''}`.trim(),
        fullText: [o.display, o.code, o.value].join(' '),
        codes: [o.code, o.display].filter(Boolean),
      }));
    });
    const count = ingestChronicleEvents(patientId, events);
    res.json({ synced: count, message: 'Longitudinal data added to your medical biography.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
