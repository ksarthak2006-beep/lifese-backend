import express from 'express';
export const router = express.Router();

// Mock analytics data aggregator
router.get('/summary', (req, res) => {
    res.json({
        revenue: {
            total: 125000,
            monthlyGrowth: 12,
            currency: 'INR'
        },
        admissions: {
            total: 45,
            active: 12,
            occupancyRate: 78
        },
        topDiagnoses: [
            { name: 'Hypertension', count: 124 },
            { name: 'Type 2 Diabetes', count: 89 },
            { name: 'Common Cold', count: 65 }
        ],
        diagnosisHeatmap: [
            { city: 'Mumbai', cases: 450, growth: 5 },
            { city: 'Delhi', cases: 380, growth: -2 },
            { city: 'Bangalore', cases: 310, growth: 8 }
        ]
    });
});

// Detailed Doctor Analytics
router.get('/doctors', (req, res) => {
    res.json([
        { id: 'DOC001', name: 'Dr. Priya Verma', specialty: 'Cardiology', activePatients: 45, status: 'On Duty', performance: 98 },
        { id: 'DOC002', name: 'Dr. Amit Patel', specialty: 'Neurology', activePatients: 32, status: 'On Break', performance: 95 },
        { id: 'DOC003', name: 'Dr. Sara Khan', specialty: 'Pediatrics', activePatients: 56, status: 'On Duty', performance: 99 },
    ]);
});

// Infrastructure & Bed Management
router.get('/infrastructure', (req, res) => {
    res.json({
        wards: [
            { name: 'ICU - Wing A', capacity: 20, occupied: 18, status: 'Critical' },
            { name: 'General Ward - B', capacity: 100, occupied: 65, status: 'Healthy' },
            { name: 'Pediatric - Wing C', capacity: 30, occupied: 12, status: 'Stable' },
        ],
        equipment: [
            { name: 'MRI Scanner 1', status: 'Operational', lastMaintenance: '2024-02-10' },
            { name: 'Ventilator Cluster 4', status: 'Maintenance Required', lastMaintenance: '2023-11-25' },
        ]
    });
});

// Detailed Clinical Trends
router.get('/diagnoses/detailed', (req, res) => {
    res.json({
        trends: [
            { name: 'Hypertension', data: [110, 115, 124, 118, 130, 124] },
            { name: 'Type 2 Diabetes', data: [80, 85, 89, 92, 88, 89] },
        ],
        demographics: [
            { group: '18-35', count: 450 },
            { group: '36-55', count: 1200 },
            { group: '55+', count: 850 },
        ]
    });
});

export default router;
