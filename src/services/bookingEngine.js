import { getDb, rawDb } from '../db.js';

const SLOT_DURATION_MIN = 30;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;

function generateSlotsForDate(dateStr, providerId, bookedSlots = []) {
  const date = new Date(dateStr);
  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_DURATION_MIN) {
      const start = new Date(date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + SLOT_DURATION_MIN * 60 * 1000);
      if (end <= new Date()) continue;

      const slotTime = start.toISOString();
      // Check if slot is taken in SQLite
      const isBooked = bookedSlots.some((b) => b.slot === slotTime);

      slots.push({
        slotId: `${providerId}-${slotTime}`,
        start: slotTime,
        end: end.toISOString(),
        available: !isBooked,
        providerId
      });
    }
  }
  return slots;
}

export function getAggregatedSlots(options = {}) {
  const { date } = options;
  const db = getDb();
  const dateStr = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const providers = db.users.filter((u) => u.role === 'DOCTOR');

  const allProviders = [];
  providers.forEach((p) => {
    // Get booked slots for this doctor from SQLite
    const booked = db.bookings.filter((b) => b.doctorId === p.id && b.slot.startsWith(dateStr));
    const slots = generateSlotsForDate(dateStr, p.id, booked);

    allProviders.push({
      providerId: p.id,
      providerName: p.name,
      providerStatus: p.verificationStatus,
      slots: slots.filter((s) => s.available),
    });
  });

  return { date: dateStr, providers: allProviders };
}

export function bookSlot(patientId, slotId, providerId, meta = {}) {
  const db = getDb();
  const slotTime = slotId.includes('-') ? slotId.split('-').slice(1).join('-') : slotId;

  const booking = {
    id: 'book-' + Date.now(),
    patientId: patientId,
    doctorId: providerId,
    slot: slotTime,
    status: 'PENDING_PAYMENT'
  };

  db.bookings.push(booking);
  return booking;
}
