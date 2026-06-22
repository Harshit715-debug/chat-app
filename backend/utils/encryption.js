/**
 * Message encryption at rest using AES-256-GCM.
 *
 * Each message is encrypted with a random IV. The stored value packs
 * iv + authTag + ciphertext together (all hex-encoded) so a single
 * string can be saved to MongoDB and later decrypted deterministically.
 *
 * NOTE: This protects data at rest (e.g. a DB dump/leak) and is combined
 * with TLS in transit (HTTPS + WSS in production) for end-to-end coverage
 * between server and clients. For true end-to-end encryption where even
 * the server cannot read messages, keys would need to be generated and
 * held client-side instead (see README "Security notes").
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

function getKey() {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'MESSAGE_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

function encryptMessage(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack as iv:authTag:ciphertext (hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptMessage(packed) {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = packed.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptMessage, decryptMessage };
