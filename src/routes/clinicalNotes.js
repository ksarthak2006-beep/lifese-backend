import express from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/clinical-notes (add note)
router.post('/', (req, res) => {
  const db = getDb();
  if (!db.clinicalNotes) db.clinicalNotes = [];
  const { patientId, doctorId, text, mappedFields } = req.body;
  const id = uuidv4();
  db.clinicalNotes.push({ id, patientId, doctorId, text, mappedFields, createdAt: new Date().toISOString() });
  res.json({ ok: true, id });
});

// GET /api/clinical-notes/:patientId
router.get('/:patientId', (req, res) => {
  const db = getDb();
  const { patientId } = req.params;
  const notes = db.clinicalNotes?.filter((n) => n.patientId === patientId) || [];
  res.json({ notes });
});

export default router;
