import express from 'express';
export const router = express.Router();

// Mock database for insurance
let claims = [
    { id: 'CLM-001', patientId: '9876543210', provider: 'Star Health', policyNum: 'SHP-12345', amount: 1200, status: 'approved', date: new Date().toISOString() },
    { id: 'CLM-002', patientId: '9876543210', provider: 'HDFC Ergo', policyNum: 'HE-998877', amount: 4500, status: 'processing', date: new Date(Date.now() - 172800000).toISOString() }
];

// Get user claims
router.get('/me', (req, res) => {
    const patientId = req.query.patientId || '9876543210';
    const userClaims = claims.filter(c => c.patientId === patientId);
    res.json(userClaims);
});

// Submit a new claim
router.post('/submit', (req, res) => {
    const newClaim = {
        id: `CLM-00${claims.length + 1}`,
        patientId: req.body.patientId || '9876543210',
        provider: req.body.provider,
        policyNum: req.body.policyNum,
        amount: req.body.amount,
        status: 'processing',
        date: new Date().toISOString()
    };
    claims.push(newClaim);
    res.json(newClaim);
});

export default router;
