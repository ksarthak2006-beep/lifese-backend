import express from 'express';
export const router = express.Router();

let orders = [
    { id: 'ORD-001', patientId: 'demo-citizen-1', type: 'Medicine', items: ['Paracetamol 500mg', 'Cetirizine 10mg'], status: 'delivered', date: new Date(Date.now() - 86400000).toISOString() },
    { id: 'ORD-002', patientId: 'demo-citizen-1', type: 'Lab Collection', items: ['HbA1c', 'Lipid Profile'], status: 'scheduled', date: new Date().toISOString(), schedule: 'Feb 22, 10:00 AM' }
];

// Get user orders
router.get('/me', (req, res) => {
    const patientId = req.query.patientId || 'demo-citizen-1';
    res.json(orders.filter(o => o.patientId === patientId));
});

// Place a new order
router.post('/order', (req, res) => {
    const newOrder = {
        id: `ORD-00${orders.length + 1}`,
        patientId: req.body.patientId || 'demo-citizen-1',
        type: req.body.type,
        items: req.body.items,
        status: 'processing',
        date: new Date().toISOString()
    };
    orders.push(newOrder);
    res.json(newOrder);
});

export default router;
