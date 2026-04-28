import express from 'express';
const router = express.Router();

// POST /api/alerts/predict
// Body: { patientId, vitals: { heartRate: [...], glucose: [...], bp: [...] } }
// This is a placeholder that returns mock alerts. Integrate an AI model here.
router.post('/predict', (req, res) => {
  try {
    const { patientId } = req.body;
    // Simple heuristic demo: if last glucose reading > 180, flag urgent
    const glucose = (req.body.vitals && req.body.vitals.glucose) || [];
    const last = glucose.length ? glucose[glucose.length - 1] : null;
    const alerts = [];
    if (last && last > 180) alerts.push({ level: 'urgent', message: 'High glucose detected (possible hyperglycemia)', code: 'GLUC_HIGH' });
    // Add placeholder predictive rule for heart rate
    const hr = (req.body.vitals && req.body.vitals.heartRate) || [];
    const hrLast = hr.length ? hr[hr.length - 1] : null;
    if (hrLast && hrLast > 120) alerts.push({ level: 'warning', message: 'Tachycardia detected', code: 'TACHY' });

    return res.json({ patientId, alerts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
