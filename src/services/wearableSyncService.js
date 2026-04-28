/**
 * Wearable / IoT Biometric Sync Service
 * Accepts biometric data from wearables (Mi Band, boAt, Garmin, Apple Watch)
 * and stores it as FHIR Observation resources via the existing FHIR mapper.
 */

import { getDb } from '../db.js';

const OBSERVATION_CODES = {
  heart_rate: { code: 'heart-rate', display: 'Heart Rate', unit: 'bpm', loinc: '8867-4' },
  steps: { code: 'step-count', display: 'Step Count', unit: 'steps', loinc: '55423-8' },
  spo2: { code: 'oxygen-saturation', display: 'SpO2 / Oxygen Saturation', unit: '%', loinc: '59408-5' },
  sleep_hours: { code: 'sleep-duration', display: 'Sleep Duration', unit: 'hours', loinc: '93832-4' },
  blood_pressure_systolic: { code: 'blood-pressure-systolic', display: 'Systolic BP', unit: 'mmHg', loinc: '8480-6' },
  blood_pressure_diastolic: { code: 'blood-pressure-diastolic', display: 'Diastolic BP', unit: 'mmHg', loinc: '8462-4' },
  weight: { code: 'weight', display: 'Body Weight', unit: 'kg', loinc: '29463-7' },
  temperature: { code: 'body-temperature', display: 'Body Temperature', unit: '°C', loinc: '8310-5' },
  stress_level: { code: 'stress-level', display: 'Stress Level (0-100)', unit: 'score', loinc: 'custom-stress' },
  calories_burned: { code: 'calories-burned', display: 'Calories Burned', unit: 'kcal', loinc: 'custom-calories' },
};

/**
 * Sync a batch of biometric readings from a wearable.
 * @param {string} userId
 * @param {string} deviceId - e.g. 'miband-7', 'apple-watch-8', 'boat-ring'
 * @param {Array<{type: string, value: number, timestamp?: string}>} readings
 */
export function syncWearableReadings(userId, deviceId, readings) {
  const db = getDb();
  if (!db.wearableData) db.wearableData = [];
  if (!db.observations) db.observations = [];

  const stored = [];
  for (const reading of readings) {
    const obsCfg = OBSERVATION_CODES[reading.type];
    if (!obsCfg) continue;

    const entry = {
      id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      patientId: userId,
      deviceId,
      type: reading.type,
      code: obsCfg.code,
      display: obsCfg.display,
      value: reading.value,
      unit: obsCfg.unit,
      loinc: obsCfg.loinc,
      timestamp: reading.timestamp || new Date().toISOString(),
      source: 'wearable',
    };
    db.wearableData.push(entry);
    db.observations.push(entry);
    stored.push(entry);
  }

  // Register device if new
  if (!db.linkedDevices) db.linkedDevices = [];
  const existingDevice = db.linkedDevices.find((d) => d.userId === userId && d.deviceId === deviceId);
  if (!existingDevice) {
    db.linkedDevices.push({
      id: `dev-${Date.now()}`,
      userId,
      deviceId,
      lastSync: new Date().toISOString(),
      syncCount: 1,
    });
  } else {
    existingDevice.lastSync = new Date().toISOString();
    existingDevice.syncCount = (existingDevice.syncCount || 0) + 1;
  }

  return { synced: stored.length, readings: stored };
}

/**
 * Get recent biometric readings for a user.
 */
export function getWearableReadings(userId, type = null, limit = 50) {
  const db = getDb();
  const data = (db.wearableData || []).filter
    ? db.wearableData.filter((r) => {
        if (r.userId !== userId) return false;
        if (type && r.type !== type) return false;
        return true;
      })
    : [];
  return data.slice(-limit).reverse();
}

/**
 * Get linked devices for a user.
 */
export function getLinkedDevices(userId) {
  const db = getDb();
  return (db.linkedDevices || []).filter
    ? db.linkedDevices.filter((d) => d.userId === userId)
    : [];
}

/**
 * Compute live biometric dashboard (latest value per type).
 */
export function getLiveBiometrics(userId) {
  const db = getDb();
  const all = (db.wearableData || []).filter
    ? db.wearableData.filter((r) => r.userId === userId)
    : [];

  const latest = {};
  for (const r of all) {
    if (!latest[r.type] || new Date(r.timestamp) > new Date(latest[r.type].timestamp)) {
      latest[r.type] = r;
    }
  }

  return Object.values(latest).map((r) => ({
    type: r.type,
    display: r.display,
    value: r.value,
    unit: r.unit,
    timestamp: r.timestamp,
    deviceId: r.deviceId,
  }));
}

export { OBSERVATION_CODES };
