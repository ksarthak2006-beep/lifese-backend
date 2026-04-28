/**
 * Doctor Second-Opinion Collaboration Routes
 * POST /api/consult/request         — Doctor requests second opinion from specialist
 * POST /api/consult/:id/respond     — Specialist responds to request
 * GET  /api/consult/incoming        — Incoming requests for me (specialist)
 * GET  /api/consult/outgoing        — My sent requests (doctor)
 * GET  /api/consult/specialists     — List all available specialists
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  requestSecondOpinion,
  respondToOpinion,
  getIncomingRequests,
  getOutgoingRequests,
  getSpecialists,
} from '../services/secondOpinionService.js';

const router = Router();

router.post('/request', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { patientId, specialistId, question, urgency, anonymize } = req.body;
    if (!patientId || !specialistId || !question) {
      return res.status(400).json({ error: 'patientId, specialistId, and question are required' });
    }
    const request = requestSecondOpinion({
      requestingDoctorId: req.user.id,
      patientId,
      specialistId,
      question,
      urgency,
      anonymize: anonymize !== false,
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/respond', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const { response, diagnosis, recommendations } = req.body;
    if (!response) return res.status(400).json({ error: 'response is required' });
    const updated = respondToOpinion({
      requestId: req.params.id,
      specialistId: req.user.id,
      response,
      diagnosis,
      recommendations,
    });
    res.json(updated);
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

router.get('/incoming', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const requests = getIncomingRequests(req.user.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/outgoing', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const requests = getOutgoingRequests(req.user.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/specialists', authMiddleware, requireRole('doctor'), (req, res) => {
  try {
    const specialists = getSpecialists();
    res.json(specialists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
