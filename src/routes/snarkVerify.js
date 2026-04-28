import fs from 'fs';
import path from 'path';
import express from 'express';

const router = express.Router();

// POST /api/zk/snark-verify
// Body: { proof, publicSignals }
router.post('/snark-verify', async (req, res) => {
  try {
    const vkPath = path.resolve(process.cwd(), 'backend', 'zkp', 'verification_key.json');
    if (!fs.existsSync(vkPath)) {
      return res.status(400).json({ error: 'verification key not found on server. build zkp artifacts and place under backend/zkp' });
    }

    const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
    const { proof, publicSignals } = req.body;
    if (!proof || !publicSignals) return res.status(400).json({ error: 'missing proof or publicSignals' });

    // Dynamic import of snarkjs — allows server to run without the package installed.
    let groth16;
    try {
      const snark = await import('snarkjs');
      groth16 = snark.groth16;
      if (!groth16) throw new Error('groth16 not available in snarkjs');
    } catch (e) {
      console.warn('snarkjs not installed; snark verification disabled');
      return res.status(501).json({ error: 'snarkjs not installed on server. Install snarkjs to enable SNARK verification.' });
    }

    const valid = await groth16.verify(vKey, publicSignals, proof);
    return res.json({ valid });
  } catch (err) {
    console.error('snark verify error', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
