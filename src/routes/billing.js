import express from 'express';
export const router = express.Router();

// Mock database for billing
let invoices = [
    { id: 'INV-001', patientId: '9876543210', amount: 500, description: 'General Consultation - Dr. Smith', status: 'pending', date: new Date().toISOString() },
    { id: 'INV-002', patientId: '9876543210', amount: 1200, description: 'Lab Tests - Blood Panel', status: 'paid', date: new Date(Date.now() - 86400000).toISOString() }
];

// Get user invoices
router.get('/me', (req, res) => {
    const patientId = req.query.patientId || '9876543210'; // Default for demo
    const userInvoices = invoices.filter(inv => inv.patientId === patientId);
    res.json(userInvoices);
});

// Pay an invoice
router.post('/:id/pay', (req, res) => {
    const { id } = req.params;
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice) {
        invoice.status = 'paid';
        res.json({ success: true, message: 'Payment successful', invoice });
    } else {
        res.status(404).json({ error: 'Invoice not found' });
    }
});

export default router;
