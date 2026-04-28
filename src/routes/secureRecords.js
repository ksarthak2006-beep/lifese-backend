import express from 'express';
const router = express.Router();

// In-memory store for ciphertext records (demo only)
const STORE = [];

// POST /api/secure-records
router.post('/', (req, res) => {
  const { ownerId, ciphertext, iv, meta } = req.body || {};
  if (!ownerId || !ciphertext || !iv) return res.status(400).json({ error: 'missing fields' });
  const id = `sr_${Date.now()}`;
  STORE.push({ id, ownerId, ciphertext, iv, meta, createdAt: Date.now() });
  res.json({ id, stored: true });
});

// GET /api/secure-records/:ownerId
router.get('/:ownerId', (req, res) => {
  const { ownerId } = req.params;
  const items = STORE.filter((s) => s.ownerId === ownerId);
  res.json({ items });
});

export default router;
