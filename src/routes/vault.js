import express from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get encrypted blobs for a patient
// Backend cannot decrypt this. Only user with their key can.
router.get('/:patientId', (req, res) => {
    const { patientId } = req.params;
    const db = getDb();
    const blobs = db.vault.filter(v => v.patientId === patientId);
    res.json(blobs);
});

// Store a new encrypted blob
router.post('/', (req, res) => {
    const { patientId, blob, type, metadata } = req.body;

    if (!patientId || !blob) {
        return res.status(400).json({ error: 'PatientId and encrypted blob required' });
    }

    const db = getDb();
    const newEntry = {
        id: `vault-${uuidv4()}`,
        patientId,
        blob, // Opaque encrypted data
        type, // e.g., 'prescription', 'vitals'
        metadata: metadata || {}, // Minor metadata like timestamp (non-PII)
        createdAt: new Date().toISOString()
    };

    db.vault.push(newEntry);

    res.status(201).json(newEntry);
});

export default router;
