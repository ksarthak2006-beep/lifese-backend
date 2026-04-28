import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getAvailabilityHeatmap } from '../services/availabilityHeatmapService.js';

const router = Router();

/** GET /api/availability/heatmap — Real-time map: doctors, ICU beds, oxygen, ambulance ETA */
router.get('/heatmap', authMiddleware, (req, res) => {
  try {
    const { lat, lng, radiusKm } = req.query;
    const data = getAvailabilityHeatmap(lat, lng, Number(radiusKm) || 10);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
