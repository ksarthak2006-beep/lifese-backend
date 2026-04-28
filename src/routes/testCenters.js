import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db.js';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** GET /api/test-centers — Nearby blood test, X-ray, CT, MRI etc. with charges. Optional: lat, lng, type, radiusKm */
const router = Router();

router.get('/', authMiddleware, (req, res) => {
  try {
    const { lat, lng, type, radiusKm } = req.query;
    const db = getDb();
    let list = [...(db.testCenters || [])];
    if (type) {
      const t = String(type).toLowerCase().replace(/-/g, '_');
      list = list.filter((c) => (c.types || []).some((ct) => String(ct).toLowerCase().includes(t) || t.includes(String(ct).toLowerCase())));
    }
    const centerLat = lat ? parseFloat(lat) : null;
    const centerLng = lng ? parseFloat(lng) : null;
    const radius = radiusKm ? parseFloat(radiusKm) : 50;
    if (centerLat != null && centerLng != null) {
      list = list
        .map((c) => ({ ...c, distanceKm: haversineKm(centerLat, centerLng, c.latitude || 0, c.longitude || 0) }))
        .filter((c) => c.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
