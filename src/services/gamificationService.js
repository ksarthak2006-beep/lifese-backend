/**
 * Gamified Adherence — Health Points system
 * Points for: care tasks, uploading lab report, medicine on time, step goal.
 * Redeemable for pharmacy discounts or insurance premiums.
 */

import { getDb } from '../db.js';

const POINTS = {
  upload_lab: 50,
  medicine_on_time: 10,
  step_goal: 20,
  care_task: 15,
  consent_shared: 5,
  follow_up_done: 30,
};

export function awardPoints(userId, action, meta = {}) {
  const db = getDb();
  if (!db.healthPoints) db.healthPoints = [];
  const pts = POINTS[action] ?? 10;
  const entry = {
    id: 'hp-' + Date.now(),
    userId,
    action,
    points: pts,
    meta,
    at: new Date().toISOString(),
  };
  db.healthPoints.push(entry);
  return { points: pts, total: getTotalPoints(db.healthPoints, userId) };
}

export function getTotalPoints(history, userId) {
  return (history || []).filter((h) => h.userId === userId).reduce((s, h) => s + h.points, 0);
}

export function getLeaderboard(limit = 10) {
  const db = getDb();
  const history = db.healthPoints || [];
  const users = db.users || [];
  const byUser = {};
  history.forEach((h) => { byUser[h.userId] = (byUser[h.userId] || 0) + h.points; });
  return Object.entries(byUser)
    .map(([uid, pts]) => ({ userId: uid, name: users.find((u) => u.id === uid)?.name, points: pts }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
