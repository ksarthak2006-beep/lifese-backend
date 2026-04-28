import express from 'express';
export const router = express.Router();

const content = [
    {
        id: 'EDU-001',
        title: 'Managing Early Stage Hypertension',
        type: 'Video',
        tags: ['Hypertension', 'BP'],
        duration: '5m',
        summary: 'A localized guide on low-sodium diets and stress management for hypertension management.'
    },
    {
        id: 'EDU-002',
        title: 'HbA1c: What Your Numbers Mean',
        type: 'Article',
        tags: ['Diabetes', 'HbA1c'],
        duration: '3m read',
        summary: 'Understanding blood sugar trends and clinical long-term safety.'
    }
];

// Get personalized recommendations based on patient clinical history
router.get('/recommendations', (req, res) => {
    // In production, this would query clinical history and map to content tags
    // For demo, we return all content as "personalized"
    res.json(content);
});

export default router;
