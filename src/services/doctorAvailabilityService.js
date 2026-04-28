/**
 * Doctor slots off / days off & Smart Slot Bidding (Dynamic Pricing)
 * Doctors can set days off or specific slots off; freed slots can be marked Flash Discount or Priority.
 */

import { getDb } from '../db.js';

export function setDayOff(providerId, date) {
  const db = getDb();
  if (!db.doctorUnavailability) db.doctorUnavailability = [];
  const dateStr = new Date(date).toISOString().slice(0, 10);
  const existing = db.doctorUnavailability.find(
    (u) => u.providerId === providerId && u.type === 'day_off' && u.date === dateStr
  );
  if (existing) return existing;
  const entry = { id: 'unav-' + Date.now(), providerId, type: 'day_off', date: dateStr, createdAt: new Date().toISOString() };
  db.doctorUnavailability.push(entry);
  return entry;
}

export function setSlotOff(providerId, slotId) {
  const db = getDb();
  if (!db.doctorUnavailability) db.doctorUnavailability = [];
  const existing = db.doctorUnavailability.find((u) => u.providerId === providerId && u.type === 'slot_off' && u.slotId === slotId);
  if (existing) return existing;
  const entry = { id: 'unav-' + Date.now(), providerId, type: 'slot_off', slotId, createdAt: new Date().toISOString() };
  db.doctorUnavailability.push(entry);
  return entry;
}

export function removeDayOff(providerId, date) {
  const db = getDb();
  const idx = (db.doctorUnavailability || []).findIndex(
    (u) => u.providerId === providerId && u.type === 'day_off' && u.date === date
  );
  if (idx === -1) return false;
  db.doctorUnavailability.splice(idx, 1);
  return true;
}

export function removeSlotOff(providerId, slotId) {
  const db = getDb();
  const idx = (db.doctorUnavailability || []).findIndex(
    (u) => u.providerId === providerId && u.type === 'slot_off' && u.slotId === slotId
  );
  if (idx === -1) return false;
  db.doctorUnavailability.splice(idx, 1);
  return true;
}

export function getDoctorUnavailability(providerId) {
  const db = getDb();
  return (db.doctorUnavailability || []).filter((u) => u.providerId === providerId);
}

/** Mark a slot as Flash Discounted or Priority (e.g. after cancellation) to fill on LifeSe network. */
export function setSlotBidding(providerId, slotId, { flashDiscount = false, priority = false }) {
  const db = getDb();
  if (!db.slotBidding) db.slotBidding = [];
  const existing = db.slotBidding.find((b) => b.providerId === providerId && b.slotId === slotId);
  if (existing) {
    existing.flashDiscount = flashDiscount;
    existing.priority = priority;
    return existing;
  }
  const entry = {
    id: 'bid-' + Date.now(),
    providerId,
    slotId,
    flashDiscount,
    priority,
    createdAt: new Date().toISOString(),
  };
  db.slotBidding.push(entry);
  return entry;
}

export function getSlotBidding(providerId) {
  const db = getDb();
  return (db.slotBidding || []).filter((b) => b.providerId === providerId);
}
