/**
 * Wearable Sync Routes
 * POST /api/wearable/sync          — Sync wearable readings
 * GET  /api/wearable/readings      — Get readings
 * GET  /api/wearable/live          — Live biometric dashboard
 * GET  /api/wearable/devices       — List linked devices
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  syncWearableReadings,
  getWearableReadings,
  getLiveBiometrics,
  getLinkedDevices,
  OBSERVATION_CODES,
} from '../services/wearableSyncService.js';

const router = Router();

router.post('/sync', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { deviceId, readings } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });
    if (!Array.isArray(readings) || readings.length === 0) return res.status(400).json({ error: 'readings array is required' });
    const result = syncWearableReadings(req.user.id, deviceId, readings);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/readings', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const userId = req.query.patientId || req.user.id;
    const type = req.query.type || null;
    const limit = parseInt(req.query.limit) || 50;
    const readings = getWearableReadings(userId, type, limit);
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/live', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const userId = req.query.patientId || req.user.id;
    const live = getLiveBiometrics(userId);
    res.json(live);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/devices', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const devices = getLinkedDevices(req.user.id);
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/types', (req, res) => {
  res.json(Object.keys(OBSERVATION_CODES).map((key) => ({ key, ...OBSERVATION_CODES[key] })));
});

export default router;
