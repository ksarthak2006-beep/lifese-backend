import express from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/masters (add master)
router.post('/', (req, res) => {
  const db = getDb();
  if (!db.masters) db.masters = [];
  const { userId, type, value } = req.body;
  const id = uuidv4();
  db.masters.push({ id, userId, type, value });
  res.json({ ok: true, id });
});

// GET /api/masters/:userId
router.get('/:userId', (req, res) => {
  const db = getDb();
  const { userId } = req.params;
  const masters = db.masters?.filter((m) => m.userId === userId) || [];
  res.json({ masters });
});

export default router;
