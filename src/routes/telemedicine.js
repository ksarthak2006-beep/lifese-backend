import express from 'express';
export const router = express.Router();

let activeCalls = [];

// Get active call session for a patient
router.get('/session/:patientId', (req, res) => {
    const { patientId } = req.params;
    const session = activeCalls.find(c => c.patientId === patientId && c.status === 'active');
    res.json(session || { status: 'inactive' });
});

// Start a call (Doctor initiates)
router.post('/start', (req, res) => {
    const { patientId, doctorId, channelName } = req.body;
    const newCall = {
        id: `call_${Date.now()}`,
        patientId,
        doctorId,
        channelName: channelName || `room_${patientId}`,
        status: 'active',
        startTime: new Date().toISOString()
    };
    activeCalls.push(newCall);
    res.json(newCall);
});

// End a call
router.post('/end/:callId', (req, res) => {
    const { callId } = req.params;
    const call = activeCalls.find(c => c.id === callId);
    if (call) {
        call.status = 'ended';
        call.endTime = new Date().toISOString();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Call not found' });
    }
});

export default router;
