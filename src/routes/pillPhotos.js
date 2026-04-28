import express from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/pill-photos (upload demo, base64 only for MVP)
router.post('/', (req, res) => {
  const db = getDb();
  if (!db.pillPhotos) db.pillPhotos = [];
  const { patientId, photo, name } = req.body;
  if (!photo) return res.status(400).json({ error: 'photo required' });
  const id = uuidv4();
  db.pillPhotos.push({ id, patientId, name, photo, uploadedAt: new Date().toISOString() });
  res.json({ ok: true, id });
});

// GET /api/pill-photos/:patientId
router.get('/:patientId', (req, res) => {
  const db = getDb();
  const { patientId } = req.params;
  const photos = db.pillPhotos?.filter((p) => p.patientId === patientId) || [];
  res.json({ photos });
});

export default router;
