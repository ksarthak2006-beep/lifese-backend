import express from 'express';
import { verifyProof } from '../services/zkService.js';

const router = express.Router();

// POST /api/zk/verify
router.post('/verify', async (req, res) => {
  try {
    const payload = req.body;
    const result = await verifyProof(payload);
    res.json(result);
  } catch (err) {
    console.error('ZK verify error', err);
    res.status(500).json({ valid: false, error: 'verification failed' });
  }
});

export default router;
