import express from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/timeline (add event)
router.post('/', (req, res) => {
  const db = getDb();
  if (!db.timelineEvents) db.timelineEvents = [];
  const { patientId, type, value, date, color } = req.body;
  const id = uuidv4();
  db.timelineEvents.push({ id, patientId, type, value, date, color });
  res.json({ ok: true, id });
});

// GET /api/timeline/:patientId
router.get('/:patientId', (req, res) => {
  const db = getDb();
  const { patientId } = req.params;
  const events = db.timelineEvents?.filter((e) => e.patientId === patientId) || [];
  res.json({ events });
});

export default router;
