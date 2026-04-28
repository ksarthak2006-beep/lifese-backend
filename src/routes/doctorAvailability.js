import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  setDayOff,
  setSlotOff,
  removeDayOff,
  removeSlotOff,
  getDoctorUnavailability,
  setSlotBidding,
  getSlotBidding,
} from '../services/doctorAvailabilityService.js';

const router = Router();

/** GET /api/doctor-availability — List my unavailability (days off, slots off) */
router.get('/', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const list = getDoctorUnavailability(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctor-availability/day-off — Set a day off */
router.post('/day-off', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    const entry = setDayOff(req.user.id, date);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/doctor-availability/day-off/:date — Remove day off */
router.delete('/day-off/:date', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const removed = removeDayOff(req.user.id, req.params.date);
    if (!removed) return res.status(404).json({ error: 'Day off not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctor-availability/slot-off — Set a specific slot off */
router.post('/slot-off', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { slotId } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId required' });
    const entry = setSlotOff(req.user.id, slotId);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/doctor-availability/slot-off?slotId= — Remove slot off */
router.delete('/slot-off', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const slotId = req.query.slotId || req.body?.slotId;
    if (!slotId) return res.status(400).json({ error: 'slotId required (query or body)' });
    const removed = removeSlotOff(req.user.id, slotId);
    if (!removed) return res.status(404).json({ error: 'Slot off not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/doctor-availability/bidding — List my slot bidding (flash/priority) */
router.get('/bidding', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const list = getSlotBidding(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctor-availability/bidding — Mark slot as Flash Discount or Priority (e.g. after cancellation) */
router.post('/bidding', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { slotId, flashDiscount, priority } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId required' });
    const entry = setSlotBidding(req.user.id, slotId, { flashDiscount: !!flashDiscount, priority: !!priority });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
