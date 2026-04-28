import express from 'express';
import elliptic from 'elliptic';
import crypto from 'crypto';
const EC = elliptic.ec;
const ec = new EC('secp256k1');

const router = express.Router();

function hexToBytes(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return Buffer.from(hex, 'hex');
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// POST /api/zk/schnorr-verify
router.post('/schnorr-verify', async (req, res) => {
  try {
    const { R, s, pub, message } = req.body || {};
    if (!R || !s || !pub || !message) return res.status(400).json({ error: 'missing fields' });

    // compute challenge c = H(R || pub || message)
    const Rbytes = hexToBytes(R);
    const Pbytes = hexToBytes(pub);
    const mbytes = Buffer.from(message, 'utf8');
    const concat = Buffer.concat([Rbytes, Pbytes, mbytes]);
    const cHex = sha256Hex(concat);
    const cHexNorm = cHex;
    const sHex = s.replace(/^0x/, '');

    // s*G via private scalar
    const sG = ec.keyFromPrivate(sHex, 'hex').getPublic();
    const pubPoint = ec.keyFromPublic(pub.replace(/^0x/, ''), 'hex').getPublic();
    const Rpoint = ec.keyFromPublic(R.replace(/^0x/, ''), 'hex').getPublic();
    // compute R + c*Pub where c is the challenge hex
    const cScalar = cHexNorm; // hex string
    const cPub = pubPoint.mul(cScalar);
    const Rc = Rpoint.add(cPub);
    const ok = sG.eq(Rc);
    res.json({ valid: !!ok });
  } catch (err) {
    console.error('schnorr verify error', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
