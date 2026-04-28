/**
 * Automated FHIR R4 Mapping Service
 * Converts legacy hospital data or PDF-extracted content into FHIR R4 bundles.
 * In production: integrate with PDF OCR (e.g. pdf-parse, Tesseract) and FHIR validator.
 */

import { v4 as uuidv4 } from 'uuid';

const FHIR_VERSION = '4.0.1';
const BASE_URL = process.env.LIFESE_BASE_URL || process.env.UHI_BASE_URL || 'http://localhost:3001/fhir';

/**
 * Map legacy patient record to FHIR Patient resource
 */
function mapPatientToFhir(legacy) {
  return {
    resourceType: 'Patient',
    id: legacy.id || uuidv4().slice(0, 8),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Patient'] },
    identifier: [
      { use: 'official', system: 'https://abdm.gov.in/abha', value: legacy.abhaId || legacy.healthId || '' },
      ...(legacy.mrn ? [{ system: `${BASE_URL}/mrn`, value: legacy.mrn }] : []),
    ],
    name: [{ use: 'official', family: legacy.familyName || legacy.name?.split(' ').pop(), given: legacy.name?.split(' ').slice(0, -1) || [legacy.name] }],
    gender: legacy.gender || 'unknown',
    birthDate: legacy.dob || legacy.birthDate,
    telecom: [].concat(
      legacy.phone ? [{ system: 'phone', value: legacy.phone, use: 'mobile' }] : [],
      legacy.email ? [{ system: 'email', value: legacy.email }] : []
    ),
    address: legacy.address ? [{ use: 'home', line: [legacy.address] }] : undefined,
  };
}

/**
 * Map legacy observation (e.g. lab result) to FHIR Observation
 */
function mapObservationToFhir(legacy, patientRef) {
  const obs = {
    resourceType: 'Observation',
    id: legacy.id || uuidv4().slice(0, 8),
    status: 'final',
    subject: patientRef,
    effectiveDateTime: legacy.date || legacy.effectiveDateTime || new Date().toISOString(),
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: legacy.loincCode || legacy.code || 'unknown',
        display: legacy.display || legacy.testName,
      }],
    },
  };
  if (legacy.valueQuantity) {
    obs.valueQuantity = {
      value: legacy.valueQuantity.value,
      unit: legacy.valueQuantity.unit,
      system: 'http://unitsofmeasure.org',
      code: legacy.valueQuantity.code || legacy.valueQuantity.unit,
    };
  } else if (legacy.value !== undefined) {
    obs.valueQuantity = { value: legacy.value, unit: legacy.unit || '' };
  } else if (legacy.valueString) {
    obs.valueString = legacy.valueString;
  }
  return obs;
}

/**
 * Map legacy encounter/visit to FHIR Encounter
 */
function mapEncounterToFhir(legacy, patientRef) {
  return {
    resourceType: 'Encounter',
    id: legacy.id || uuidv4().slice(0, 8),
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: patientRef,
    period: {
      start: legacy.visitDate || legacy.period?.start || new Date().toISOString(),
      end: legacy.period?.end,
    },
    reasonCode: legacy.diagnosis ? [{ text: legacy.diagnosis }] : undefined,
  };
}

/**
 * Build a FHIR R4 Bundle from legacy records (e.g. from PDF extraction or hospital export)
 */
export function legacyToFhirBundle(legacyPayload) {
  const { patient: legacyPatient, encounters = [], observations = [] } = legacyPayload;
  if (!legacyPatient) throw new Error('Patient data required for FHIR mapping');

  const patient = mapPatientToFhir(legacyPatient);
  const patientRef = { reference: `Patient/${patient.id}` };
  const entries = [
    { fullUrl: `${BASE_URL}/Patient/${patient.id}`, resource: patient },
  ];

  encounters.forEach((enc) => {
    const encResource = mapEncounterToFhir(enc, patientRef);
    entries.push({ fullUrl: `${BASE_URL}/Encounter/${encResource.id}`, resource: encResource });
  });

  observations.forEach((obs) => {
    const obsResource = mapObservationToFhir(obs, patientRef);
    entries.push({ fullUrl: `${BASE_URL}/Observation/${obsResource.id}`, resource: obsResource });
  });

  return {
    resourceType: 'Bundle',
    id: uuidv4(),
    meta: { lastUpdated: new Date().toISOString() },
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}

/**
 * Parse PDF-extracted text (stub: in production use pdf-parse + NLP/pattern matching)
 * Returns structured legacy payload for legacyToFhirBundle
 */
export function pdfTextToLegacyPayload(pdfText) {
  const lines = (pdfText || '').split(/\n/).map((s) => s.trim()).filter(Boolean);
  const patient = { id: uuidv4().slice(0, 8), name: 'Unknown', healthId: '' };
  const observations = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('name') && line.includes(':')) patient.name = line.split(':').slice(1).join(':').trim();
    if (lower.includes('abha') && line.includes(':')) patient.abhaId = line.split(':').slice(1).join(':').trim();
    const numMatch = line.match(/(\d+\.?\d*)\s*(mg\/dl|mmol\/l|%|g\/dl)?/i);
    if (numMatch && (lower.includes('glucose') || lower.includes('hba1c') || lower.includes('creatinine'))) {
      observations.push({
        testName: line.split(/\d/)[0].trim() || 'Lab value',
        value: parseFloat(numMatch[1]),
        unit: numMatch[2] || '',
        date: new Date().toISOString(),
      });
    }
  }
  return { patient, encounters: [], observations };
}
