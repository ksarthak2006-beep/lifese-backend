/**
 * HSM / Secure Vault Integration for LifeSe request signing
 * Store private keys in HashiCorp Vault (or HSM) instead of env vars.
 * Stub: in production use Vault KV or Transit engine for signing.
 */

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN;
const USE_VAULT = Boolean(VAULT_TOKEN);

async function vaultRead(path) {
  if (!USE_VAULT) return null;
  const res = await fetch(`${VAULT_ADDR}/v1/${path}`, {
    headers: { 'X-Vault-Token': VAULT_TOKEN },
  });
  if (!res.ok) throw new Error(`Vault read failed: ${res.status}`);
  const data = await res.json();
  return data?.data;
}

/**
 * Get signing key from Vault (KV or Transit). Fallback: env LIFESE_PRIVATE_KEY.
 */
export async function getSigningKey() {
  try {
    const data = await vaultRead('secret/data/lifese-signing-key');
    if (data?.private_key) return data.private_key;
  } catch {
    // fallback
  }
  return process.env.LIFESE_PRIVATE_KEY || null;
}

/**
 * Sign payload for LifeSe request (stub: in production use key from Vault + crypto.sign).
 */
export async function signLifeseRequest(payload) {
  const key = await getSigningKey();
  if (key) {
    const crypto = await import('crypto');
    const sig = crypto.createSign('RSA-SHA256').update(JSON.stringify(payload)).sign(key, 'base64');
    return { signature: sig, algorithm: 'RSA-SHA256' };
  }
  return { signature: null, algorithm: null };
}
