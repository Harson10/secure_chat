
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
// const AUTH_TAG_LENGTH = 16;

export const encryptionService = {
  generateKeyPair: () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
  },

  // Fonction utilitaire pour formater la clé privée
  formatPrivateKey: (privateKey: string): string => {
    if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('END PRIVATE KEY')) {
      return `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }
    return privateKey;
  },

  // Fonction utilitaire pour formater la clé publique
  formatPublicKey: (publicKey: string): string => {
    if (!publicKey.includes('BEGIN PUBLIC KEY') && !publicKey.includes('END PUBLIC KEY')) {
      return `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    }
    return publicKey;
  },

  encryptAsymmetric: (message: string, rawPublicKey: string) => {
    try {
      const publicKey = encryptionService.formatPublicKey(rawPublicKey);
      const encryptedBuffer = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(message, 'utf8')
      );
      return encryptedBuffer.toString('base64');
    } catch (error) {
      console.error('Error encrypting message asymmetrically:', error);
      throw new Error('Asymmetric encryption failed: ' + error);
    }
  },

  decryptAsymmetric: (encryptedMessage: string, rawPrivateKey: string) => {
    try {
      const privateKey = encryptionService.formatPrivateKey(rawPrivateKey);
      const decryptedBuffer = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedMessage, 'base64')
      );
      return decryptedBuffer.toString('utf8');
    } catch (error) {
      console.error('Error decrypting message asymmetrically:', error);
      throw new Error('Asymmetric decryption failed: ' + error);
    }
  },

  encryptSymmetric: (message: string, rawPrivateKey: string) => {
    try {
      const privateKey = encryptionService.formatPrivateKey(rawPrivateKey);
      const hash = crypto.createHash('sha256');
      hash.update(privateKey);
      const key = hash.digest();

      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(message, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      const result = JSON.stringify({
        iv: iv.toString('base64'),
        content: encrypted,
        authTag: authTag.toString('base64')
      });

      return Buffer.from(result).toString('base64');
    } catch (error) {
      console.error('Error encrypting message symmetrically:', error);
      throw new Error('Symmetric encryption failed: ' + error);
    }
  },

  decryptSymmetric: (encryptedMessage: string, rawPrivateKey: string) => {
    try {
      const privateKey = encryptionService.formatPrivateKey(rawPrivateKey);
      const hash = crypto.createHash('sha256');
      hash.update(privateKey);
      const key = hash.digest();

      const encryptedData = JSON.parse(Buffer.from(encryptedMessage, 'base64').toString());

      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encryptedData.iv, 'base64')
      );

      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));

      let decrypted = decipher.update(encryptedData.content, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Error decrypting message symmetrically:', error);
      throw new Error('Symmetric decryption failed: ' + error);
    }
  }
};