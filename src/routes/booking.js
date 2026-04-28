import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getAggregatedSlots, bookSlot } from '../services/bookingEngine.js';
import { getDb, rawDb } from '../db.js';

const router = Router();

/** GET /api/booking/slots — Real-time availability across providers */
router.get('/slots', authMiddleware, (req, res) => {
  try {
    const { date, type, radiusKm, lat, lng } = req.query;
    const result = getAggregatedSlots({ date, type, radiusKm, lat, lng });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/booking/book — Book a slot */
router.post('/book', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { slotId, providerId, reason } = req.body;
    if (!slotId || !providerId) return res.status(400).json({ error: 'slotId and providerId required' });
    const booking = bookSlot(req.user.id, slotId, providerId, { reason });
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/booking/pay — Process mock payment and confirm booking */
router.post('/pay', authMiddleware, requireRole('citizen'), async (req, res) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    const db = getDb();

    // SQL Search
    const booking = db.bookings.find(bookingId);

    if (!booking || booking.patientId !== req.user.id) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'CONFIRMED') {
      return res.status(400).json({ error: 'Already paid' });
    }

    // Explicit SQLite Update
    rawDb.prepare(`
      UPDATE bookings 
      SET status = ?, createdAt = ? 
      WHERE id = ?
    `).run('CONFIRMED', new Date().toISOString(), bookingId);

    const updated = db.bookings.find(bookingId);
    res.json({ success: true, booking: updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
