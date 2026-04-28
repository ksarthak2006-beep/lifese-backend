/**
 * Health Score Routes
 * GET  /api/health-score/me        — Get current user's health score
 * GET  /api/health-score/history   — Get score history for trending
 * GET  /api/health-score/:userId   — Get score for a specific user (doctor/admin)
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { calculateHealthScore, getScoreHistory, snapshotHealthScore } from '../services/healthScoreService.js';

const router = Router();

router.get('/me', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const score = calculateHealthScore(req.user.id);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = getScoreHistory(req.user.id, limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/snapshot', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const score = snapshotHealthScore(req.user.id);
    res.status(201).json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:userId', authMiddleware, requireRole('doctor', 'admin'), (req, res) => {
  try {
    const score = calculateHealthScore(req.params.userId);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
