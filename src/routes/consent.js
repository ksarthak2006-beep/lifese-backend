import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { setConsentExpiry, getConsentsWithExpiry, getPendingConsentRequests, revokeExpiredConsents } from '../services/consentExpiryService.js';
import { requireDualApproval, createMultiSigRequest, approveAsPatient, approveAsGuardian, isMultiSigComplete } from '../services/multiSigService.js';

const router = Router();

router.post('/request', authMiddleware, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, scope, expiresInHours, dataCategory } = req.body;
    if (!patientId || !scope) return res.status(400).json({ error: 'Patient ID and scope required' });
    const db = getDb();
    const patient = db.users.find((u) => u.id === patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const hours = expiresInHours != null ? Number(expiresInHours) : (scope === '6_months' ? 180 * 24 : 24);
    const consent = {
      id: 'consent-' + uuidv4().slice(0, 8),
      patientId,
      doctorId: req.user.id,
      scope: scope === '6_months' ? '6_months' : 'current_visit',
      dataCategory: dataCategory || null,
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    };
    db.consents.push(consent);
    res.status(201).json(consent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approve', authMiddleware, requireRole('citizen'), async (req, res) => {
  try {
    const { consentId, dataCategory } = req.body;
    const db = getDb();
    const consent = db.consents.find((c) => c.id === consentId && c.patientId === req.user.id);
    if (!consent) return res.status(404).json({ error: 'Consent not found' });
    const category = dataCategory || consent.dataCategory;
    if (requireDualApproval(consentId, category)) {
      const msReq = createMultiSigRequest(req.user.id, consentId, consent.scope, category);
      approveAsPatient(msReq.id, req.user.id);
      return res.json({ requiresGuardian: true, multiSigRequestId: msReq.id, consent });
    }
    consent.status = 'active';
    consent.grantedAt = new Date().toISOString();
    res.json(consent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/multisig/guardian-approve', authMiddleware, (req, res) => {
  try {
    const { requestId } = req.body;
    const updated = approveAsGuardian(requestId, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Request not found or not guardian' });
    if (isMultiSigComplete(updated)) {
      const db = getDb();
      const consent = db.consents.find((c) => c.id === updated.consentId);
      if (consent) { consent.status = 'active'; consent.grantedAt = new Date().toISOString(); }
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-consents', authMiddleware, requireRole('citizen'), async (req, res) => {
  try {
    revokeExpiredConsents();
    const consents = getConsentsWithExpiry(req.user.id);
    res.json(consents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/consent/pending-requests — Pending access requests (doctor requested for specific timing) */
router.get('/pending-requests', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const list = getPendingConsentRequests(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/consent/:id/expiry — Set self-destruct expiry (e.g. "Doctor X can view for only 24 hours") */
router.put('/:id/expiry', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { expiresAt, expiresInHours } = req.body;
    const expires = expiresAt ? new Date(expiresAt) : (expiresInHours != null ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000) : null);
    if (!expires || isNaN(expires.getTime())) return res.status(400).json({ error: 'Provide expiresAt or expiresInHours' });
    const updated = setConsentExpiry(req.params.id, expires, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Consent not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, requireRole('citizen'), async (req, res) => {
  try {
    const db = getDb();
    const idx = db.consents.findIndex((c) => c.id === req.params.id && c.patientId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Consent not found' });
    db.consents[idx].status = 'revoked';
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/consent/:id/reject — Reject a pending access request */
router.post('/:id/reject', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const db = getDb();
    const c = db.consents.find((x) => x.id === req.params.id && x.patientId === req.user.id);
    if (!c) return res.status(404).json({ error: 'Consent not found' });
    if (c.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });
    c.status = 'rejected';
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
