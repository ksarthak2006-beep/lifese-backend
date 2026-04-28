import express from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/reminders (add reminder)
router.post('/', (req, res) => {
  const db = getDb();
  if (!db.reminders) db.reminders = [];
  const { patientId, text, time, pillId } = req.body;
  const id = uuidv4();
  db.reminders.push({ id, patientId, text, time, pillId, createdAt: new Date().toISOString() });
  res.json({ ok: true, id });
});

// GET /api/reminders/:patientId
router.get('/:patientId', (req, res) => {
  const db = getDb();
  const { patientId } = req.params;
  const reminders = db.reminders?.filter((r) => r.patientId === patientId) || [];
  res.json({ reminders });
});

export default router;
