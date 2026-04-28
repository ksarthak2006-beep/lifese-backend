/**
 * Hyper-Local Availability Heatmap — "Immediate Care"
 * Real-time map: doctors, Live ICU beds, oxygen, ambulance ETA.
 * Integrates with LifeSe discovery; in production call HSPA/location APIs.
 */

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

/**
 * Get live availability: doctors, ICU beds, oxygen suppliers, ambulances with ETA.
 * Stub data for demo; production: LifeSe discovery + hospital/ambulance APIs.
 */
export function getAvailabilityHeatmap(lat, lng, radiusKm = 10) {
  const db = getDb();
  const doctors = (db.users || []).filter((u) => u.role === 'doctor').map((d, i) => ({
    id: d.id,
    type: 'doctor',
    name: d.name,
    lat: (parseFloat(lat) || 20.3) + (i - 0.5) * 0.02,
    lng: (parseFloat(lng) || 85.8) + (i - 0.5) * 0.02,
    available: true,
    nextSlot: '15 min',
    distanceKm: 0,
  }));

  const icuBeds = (db.availabilitySnapshot?.icu || []).length > 0
    ? db.availabilitySnapshot.icu
    : [
      { id: 'icu-1', facility: 'City Hospital', lat: parseFloat(lat) || 20.3, lng: parseFloat(lng) || 85.8, beds: 2, ventilated: 1 },
      { id: 'icu-2', facility: 'Medanta Unit', lat: (parseFloat(lat) || 20.3) + 0.03, lng: (parseFloat(lng) || 85.8) + 0.01, beds: 1, ventilated: 0 },
    ];
  const oxygen = (db.availabilitySnapshot?.oxygen || []).length > 0
    ? db.availabilitySnapshot.oxygen
    : [
      { id: 'ox-1', name: 'Oxygen Depot Central', lat: (parseFloat(lat) || 20.3) - 0.01, lng: (parseFloat(lng) || 85.8) + 0.02, available: true, eta: '20 min' },
    ];
  const ambulances = (db.availabilitySnapshot?.ambulances || []).length > 0
    ? db.availabilitySnapshot.ambulances
    : [
      { id: 'amb-1', provider: '108 Ambulance', lat: (parseFloat(lat) || 20.3) + 0.05, lng: (parseFloat(lng) || 85.8) - 0.02, eta: '8 min', available: true },
      { id: 'amb-2', provider: 'Private EMS', lat: (parseFloat(lat) || 20.3) - 0.02, lng: (parseFloat(lng) || 85.8) + 0.03, eta: '12 min', available: true },
    ];

  const centerLat = parseFloat(lat) || 20.3;
  const centerLng = parseFloat(lng) || 85.8;
  const withDistance = (items, latKey = 'lat', lngKey = 'lng') =>
    items.map((x) => ({
      ...x,
      distanceKm: haversineKm(centerLat, centerLng, x[latKey], x[lngKey]),
    })).filter((x) => x.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    center: { lat: centerLat, lng: centerLng },
    radiusKm,
    doctors: withDistance(doctors),
    icuBeds: withDistance(icuBeds),
    oxygen: withDistance(oxygen),
    ambulances: withDistance(ambulances),
    summary: {
      doctors: doctors.length,
      icuTotal: icuBeds.reduce((s, i) => s + (i.beds || 0), 0),
      oxygenPoints: oxygen.length,
      ambulances: ambulances.length,
    },
  };
}
