import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';

const router = Router();

router.get('/profile', authMiddleware, requireRole('citizen', 'doctor'), async (req, res) => {
  try {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/citizen/profile — Update medical profile ────────
router.patch('/profile', authMiddleware, requireRole('citizen'), async (req, res) => {
  try {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allowedFields = [
      'bloodGroup', 'allergies', 'conditions', 'currentMedications',
      'organDonor', 'insurancePolicyNumber', 'emergencyNote',
      'dateOfBirth', 'weight', 'height', 'gender'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    user.profileUpdatedAt = new Date().toISOString();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Emergency Contacts CRUD ────────────────────────────────────

// GET /api/citizen/emergency-contacts
router.get('/emergency-contacts', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const db = getDb();
    if (!db.emergencyContacts) db.emergencyContacts = [];
    const contacts = db.emergencyContacts.filter((c) => c.userId === req.user.id);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/citizen/emergency-contacts
router.post('/emergency-contacts', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const { name, phone, relationship } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const db = getDb();
    if (!db.emergencyContacts) db.emergencyContacts = [];

    const existing = db.emergencyContacts.filter((c) => c.userId === req.user.id);
    if (existing.length >= 5) return res.status(400).json({ error: 'Maximum 5 emergency contacts allowed' });

    const contact = {
      id: `ec-${Date.now()}`,
      userId: req.user.id,
      name,
      phone,
      relationship: relationship || 'Other',
      createdAt: new Date().toISOString(),
    };
    db.emergencyContacts.push(contact);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/citizen/emergency-contacts/:id
router.delete('/emergency-contacts/:id', authMiddleware, requireRole('citizen'), (req, res) => {
  try {
    const db = getDb();
    if (!db.emergencyContacts) db.emergencyContacts = [];
    const idx = db.emergencyContacts.findIndex((c) => c.id === req.params.id && c.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Contact not found' });
    db.emergencyContacts.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline', authMiddleware, requireRole('citizen'), async (req, res) => {
  try {
    const db = getDb();
    const visits = db.prescriptions
      .filter((p) => p.patientId === req.user.id)
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    const withDoctor = visits.map((v) => {
      const doctor = db.users.find((u) => u.id === v.doctorId);
      return { ...v, doctorName: doctor?.name || 'Unknown' };
    });
    res.json(withDoctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
