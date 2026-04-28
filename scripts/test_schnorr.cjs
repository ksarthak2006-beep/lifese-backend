const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const crypto = require('crypto');
const http = require('http');

(async function(){
  const key = ec.genKeyPair();
  const priv = key.getPrivate('hex');
  const pub = '0x' + key.getPublic().encode('hex');

  const R = ec.genKeyPair();
  const Rpub = '0x' + R.getPublic().encode('hex');
  const Rpriv = R.getPrivate('hex');

  const message = 'uhi-proof-demo';

  const concat = Buffer.concat([
    Buffer.from(Rpub.replace(/^0x/, ''), 'hex'),
    Buffer.from(pub.replace(/^0x/, ''), 'hex'),
    Buffer.from(message, 'utf8')
  ]);
  const cHex = crypto.createHash('sha256').update(concat).digest('hex');
  const c = BigInt('0x' + cHex);
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const s = (BigInt('0x' + Rpriv) + c * BigInt('0x' + priv)) % n;

  const proof = { R: Rpub, s: '0x' + s.toString(16), pub, message };

  const d = JSON.stringify(proof);
  const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/zk/schnorr-verify', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, res => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => console.log(res.statusCode, b));
  });
  req.on('error', (e) => console.error('request error', e));
  req.write(d);
  req.end();
})();
