import * as snarkjs from 'snarkjs';
import fs from 'fs';
import path from 'path';

/**
 * Production Zero-Knowledge Proof Verifier (Groth16)
 * @param {Object} proofPayload { proof, publicSignals }
 * @param {String} circuitName Optional circuit identifier
 */
export async function verifyProof(proofPayload, circuitName = 'square') {
  const { proof, publicSignals } = proofPayload;

  try {
    // 1. In production, these keys are stored in backend/data/circuits/
    const vKeyPath = path.join(process.cwd(), 'data', 'circuits', `${circuitName}.vkey.json`);

    // Check if real verification key exists
    if (fs.existsSync(vKeyPath)) {
      const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf8'));
      const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      return { valid: isValid, info: isValid ? 'ZK Proof Verified' : 'Invalid ZK Proof' };
    }

    // 2. Logic Fallback: If no keys are found, log a production warning
    if (process.env.NODE_ENV === 'production') {
      console.error(`🔥 ERROR: ZK Verification Key missing at ${vKeyPath}`);
      return { valid: false, error: 'Internal Security Error: Verification Key Missing' };
    }

    // 3. Dev Mode: Return successful mock if real keys aren't provisioned yet
    return { valid: true, info: 'Local Dev: Mocked valid (provision circuits for production)' };
  } catch (err) {
    console.error('❌ ZK Verification Exception:', err.message);
    return { valid: false, error: err.message };
  }
}

export default { verifyProof };
