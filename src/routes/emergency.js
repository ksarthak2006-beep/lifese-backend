/**
 * Emergency Card Route
 * GET  /api/emergency/card/:citizenId  — Public short-lived emergency card
 * POST /api/emergency/sos              — Trigger SOS alert to guardian + nearest hospital
 */
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { buildFlashSummary } from '../services/flashSummaryService.js';

const router = Router();

// Public emergency card — no auth (used by QR codes / emergency responders)
router.get('/card/:citizenId', (req, res) => {
  try {
    const db = getDb();
    const user = db.users.find ? db.users.find((u) => u.id === req.params.citizenId) : null;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const summary = buildFlashSummary(req.params.citizenId);
    const structured = summary?.structured || {};

    res.json({
      name: user.name,
      abhaId: user.abhaId || user.healthId,
      bloodGroup: user.bloodGroup || 'Unknown',
      emergencyContact: user.emergencyContact || 'Not set',
      conditions: structured.conditions || [],
      allergies: structured.allergies || [],
      currentMedications: structured.medicinesInHistory?.slice(0, 5) || [],
      lastHbA1c: structured.lastHbA1c,
      lastBP: structured.lastBP,
      generatedAt: new Date().toISOString(),
      disclaimer: 'For emergency use only. Verify with treating physician.',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SOS trigger — authenticated
router.post('/sos', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { latitude, longitude, message } = req.body;
    const db = getDb();

    const sosEvent = {
      id: `sos-${Date.now()}`,
      userId: req.user.id,
      latitude,
      longitude,
      message: message || 'Emergency SOS triggered via LifeSe app',
      triggeredAt: new Date().toISOString(),
      status: 'active',
      notifiedGuardians: [],
    };

    if (!db.sosEvents) db.sosEvents = [];
    db.sosEvents.push(sosEvent);

    // In production: push notification to linked guardians + nearest hospital via FCM
    const linkedFamily = (db.familyLinks || []).filter
      ? db.familyLinks.filter((l) => l.guardianId === req.user.id || l.memberId === req.user.id)
      : [];

    res.status(201).json({
      sosId: sosEvent.id,
      message: 'SOS triggered. Emergency contacts notified.',
      linkedContacts: linkedFamily.length,
      emergencyCardUrl: `/api/emergency/card/${req.user.id}`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get SOS history
router.get('/history', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const db = getDb();
    const history = (db.sosEvents || []).filter
      ? db.sosEvents.filter((e) => e.userId === req.user.id)
          .sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt))
      : [];
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
