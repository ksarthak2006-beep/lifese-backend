import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';

const router = express.Router();

// GET /api/rx-config/:userId
router.get('/:userId', (req, res) => {
  const db = getDb();
  const userId = req.params.userId;
  const configs = db.rxConfigs || [];
  const found = configs.filter((c) => c.userId === userId);
  res.json({ configs: found });
});

// POST /api/rx-config (save template)
router.post('/', (req, res) => {
  const db = getDb();
  if (!db.rxConfigs) db.rxConfigs = [];
  const payload = req.body;
  const id = uuidv4();
  const item = { id, ...payload, createdAt: new Date().toISOString() };
  db.rxConfigs.push(item);
  res.json({ ok: true, item });
});

export default router;
