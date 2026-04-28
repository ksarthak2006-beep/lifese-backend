import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { checkDrugInteractions } from '../utils/safety.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/clinical/drug-interactions
 * Analyzes a set of medications for potential interactions in real-time.
 */
router.post('/drug-interactions', authMiddleware, requireRole('doctor'), async (req, res) => {
    try {
        const { newMedications } = req.body;
        
        if (!newMedications || !Array.isArray(newMedications)) {
            return res.status(400).json({ error: 'List of medications is required.' });
        }

        const medNames = newMedications.map(m => (typeof m === 'string' ? m : m.name));
        const alerts = checkDrugInteractions(medNames);

        res.json({ alerts });
    } catch (err) {
        logger.error('Clinical safety check failed', { error: err.message });
        res.status(500).json({ error: 'Safety engine timeout or failure' });
    }
});

export default router;
