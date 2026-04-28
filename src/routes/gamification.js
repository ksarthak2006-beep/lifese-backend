import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { awardPoints, getTotalPoints, getLeaderboard } from '../services/gamificationService.js';
import { getDb } from '../db.js';

const router = Router();

/** GET /api/gamification/me — My health points and history */
router.get('/me', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const db = getDb();
    const history = (db.healthPoints || []).filter((h) => h.userId === req.user.id);
    const total = getTotalPoints(db.healthPoints, req.user.id);
    res.json({ total, history: history.slice(-20) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/gamification/award — Award points for a care task (e.g. upload_lab, medicine_on_time) */
router.post('/award', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { action, meta } = req.body;
    const result = awardPoints(req.user.id, action || 'care_task', meta);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/gamification/leaderboard */
router.get('/leaderboard', authMiddleware, (req, res) => {
  try {
    const list = getLeaderboard(Number(req.query.limit) || 10);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
