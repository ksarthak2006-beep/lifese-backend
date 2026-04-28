/**
 * LifeSe HL7 FHIR R4 Export Engine
 * 
 * Converts internal LifeSe data structures to fully-compliant HL7 FHIR R4
 * (Fast Healthcare Interoperability Resources) format.
 * 
 * This makes LifeSe records portable to any hospital in the US, EU, or Middle East
 * that accepts SMART on FHIR / Blue Button 2.0 data.
 * 
 * Spec reference: https://hl7.org/fhir/R4/
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db.js';
import logger from '../utils/logger.js';

const router = Router();

// ─── FHIR R4 Resource Builders ────────────────────────────────────────────────

function buildPatientResource(user) {
  return {
    resourceType: 'Patient',
    id: user.id,
    meta: {
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
      lastUpdated: new Date().toISOString(),
    },
    identifier: [
      {
        system: 'https://ndhm.gov.in/abha-id',
        value: user.healthId || user.abhaId || user.id,
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' }]
        }
      }
    ],
    name: [{
      use: 'official',
      text: user.name,
      family: user.name?.split(' ').pop(),
      given: [user.name?.split(' ')[0]],
    }],
    telecom: [
      user.phone && { system: 'phone', value: user.phone, use: 'mobile' },
      user.email && { system: 'email', value: user.email, use: 'home' },
    ].filter(Boolean),
    gender: user.gender || 'unknown',
    birthDate: user.dob || undefined,
    address: user.address ? [{
      use: 'home',
      text: user.address,
      country: 'IN',
    }] : [],
    extension: [{
      url: 'http://hl7.org/fhir/StructureDefinition/patient-nationality',
      valueCode: 'IN',
    }],
  };
}

function buildPractitionerResource(doctor) {
  return {
    resourceType: 'Practitioner',
    id: doctor.id,
    identifier: [{
      system: 'https://ndhm.gov.in/doctor-id',
      value: doctor.healthId || doctor.id,
    }],
    name: [{ use: 'official', text: doctor.name }],
    qualification: [{
      code: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'MD', display: 'Doctor of Medicine' }],
        text: 'Medical Doctor',
      },
      issuer: { display: 'National Medical Commission of India' },
    }],
  };
}

function buildMedicationRequestResource(prescription, medicine, patient, doctor) {
  return {
    resourceType: 'MedicationRequest',
    id: `${prescription.id}-${medicine.name?.replace(/\s+/g, '-').toLowerCase()}`,
    meta: {
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest'],
    },
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      text: medicine.name,
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        display: medicine.name,
      }],
    },
    subject: { reference: `Patient/${patient.id}`, display: patient.name },
    requester: { reference: `Practitioner/${doctor?.id || 'unknown'}`, display: doctor?.name },
    authoredOn: prescription.visitDate || prescription.signedAt || new Date().toISOString(),
    dosageInstruction: [{
      text: medicine.dosage || undefined,
      timing: medicine.timing
        ? { code: { text: medicine.timing } }
        : undefined,
    }],
    note: prescription.notes ? [{ text: prescription.notes }] : [],
    reasonCode: prescription.diagnosis
      ? [{ text: prescription.diagnosis }]
      : [],
  };
}

function buildConditionResource(prescription, patient) {
  if (!prescription.diagnosis) return null;
  return {
    resourceType: 'Condition',
    id: `cond-${prescription.id}`,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
    },
    verificationStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }],
    },
    subject: { reference: `Patient/${patient.id}` },
    onsetDateTime: prescription.visitDate,
    note: [{ text: prescription.diagnosis }],
    code: { text: prescription.diagnosis },
  };
}

function buildObservationResource(vitalKey, vitalValue, prescriptionId, patientId, visitDate) {
  const LOINC_MAP = {
    heartRate:  { code: '8867-4',  display: 'Heart rate' },
    systolic:   { code: '8480-6',  display: 'Systolic blood pressure' },
    diastolic:  { code: '8462-4',  display: 'Diastolic blood pressure' },
    temp:       { code: '8310-5',  display: 'Body temperature' },
    pulse:      { code: '8867-4',  display: 'Pulse rate' },
  };

  const loinc = LOINC_MAP[vitalKey];
  if (!loinc || !vitalValue) return null;

  return {
    resourceType: 'Observation',
    id: `obs-${prescriptionId}-${vitalKey}`,
    status: 'final',
    category: [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: loinc.code, display: loinc.display }],
      text: loinc.display,
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: visitDate,
    valueQuantity: {
      value: parseFloat(vitalValue) || vitalValue,
      unit: vitalKey === 'temp' ? '°C' : vitalKey.includes('pressure') ? 'mmHg' : '/min',
    },
  };
}

/**
 * Wraps resources in an HL7 FHIR R4 Bundle (searchset type).
 */
function buildBundle(patientId, resources, bundleType = 'collection') {
  return {
    resourceType: 'Bundle',
    id: `lifese-export-${patientId}-${Date.now()}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
    },
    type: bundleType,
    timestamp: new Date().toISOString(),
    total: resources.length,
    link: [{
      relation: 'self',
      url: `https://lifese.health/api/fhir/export/${patientId}`,
    }],
    entry: resources.map(resource => ({
      fullUrl: `https://lifese.health/api/fhir/${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/fhir/export/:patientId
 * Exports a full HL7 FHIR R4 Bundle for a patient's clinical history.
 */
router.get('/export/:patientId', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const { patientId } = req.params;

    // Authorization: Citizens can only export their own data
    if (req.user.role === 'citizen' && req.user.id !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const patient = db.users.find(u => u.id === patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const prescriptions = db.prescriptions.filter(p => p.patientId === patientId);
    const resources = [];

    // 1. Patient resource
    resources.push(buildPatientResource(patient));

    // 2. Per-prescription resources
    for (const rx of prescriptions) {
      const doctor = db.users.find(u => u.id === rx.doctorId);

      if (doctor) resources.push(buildPractitionerResource(doctor));

      // Condition (Diagnosis)
      const condition = buildConditionResource(rx, patient);
      if (condition) resources.push(condition);

      // MedicationRequests (one per medicine)
      (rx.medicines || []).forEach(med => {
        resources.push(buildMedicationRequestResource(rx, med, patient, doctor));
      });

      // Vital-sign Observations
      if (rx.vitals) {
        Object.entries(rx.vitals).forEach(([key, val]) => {
          const obs = buildObservationResource(key, val, rx.id, patientId, rx.visitDate);
          if (obs) resources.push(obs);
        });
      }
    }

    const bundle = buildBundle(patientId, resources);

    // Set standard FHIR content-type
    res.setHeader('Content-Type', 'application/fhir+json; fhirVersion=4.0');
    res.setHeader('Content-Disposition', `attachment; filename="lifese-fhir-${patientId}.json"`);
    res.json(bundle);

    logger.info('FHIR bundle exported', { patientId, resourceCount: resources.length });
  } catch (err) {
    logger.error('FHIR export failed', { error: err.message });
    res.status(500).json({ error: 'FHIR export failed' });
  }
});

/**
 * GET /api/fhir/capability
 * CapabilityStatement — standard FHIR server identity declaration.
 */
router.get('/capability', (req, res) => {
  res.setHeader('Content-Type', 'application/fhir+json; fhirVersion=4.0');
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'LifeSe Health Platform',
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['application/fhir+json'],
    rest: [{
      mode: 'server',
      resource: [
        { type: 'Patient', interaction: [{ code: 'read' }] },
        { type: 'MedicationRequest', interaction: [{ code: 'read' }] },
        { type: 'Condition', interaction: [{ code: 'read' }] },
        { type: 'Observation', interaction: [{ code: 'read' }] },
        { type: 'Practitioner', interaction: [{ code: 'read' }] },
      ],
    }],
  });
});

export default router;
