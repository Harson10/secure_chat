import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export const encryptionService = {
  generateKeyPair: () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
  },

  formatPrivateKey: (privateKey: string): string => {
    if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('END PRIVATE KEY')) {
      return `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }
    return privateKey;
  },

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

      const encryptedData = {
        iv: iv.toString('base64'),
        content: encrypted,
        authTag: authTag.toString('base64')
      };

      const jsonString = JSON.stringify(encryptedData);
      console.log('Debug - Encrypted Data JSON:', jsonString);

      const base64Result = Buffer.from(jsonString).toString('base64');
      console.log('Debug - Final base64:', base64Result);

      return base64Result;
    } catch (error) {
      console.error('Error encrypting message symmetrically:', error);
      throw new Error('Symmetric encryption failed: ' + error);
    }
  },

  decryptSymmetric: (encryptedMessage: string, rawPrivateKey: string) => {
    try {
      console.log('Debug - Input encryptedMessage:', encryptedMessage);

      // Vérification initiale
      if (!encryptedMessage) {
        throw new Error('Encrypted message is empty or null');
      }

      // Tentative de décodage base64
      let jsonStr;
      try {
        jsonStr = Buffer.from(encryptedMessage, 'base64').toString('utf8');
        console.log('Debug - Decoded JSON string:', jsonStr);
      } catch (e) {
        console.error('Debug - Base64 decode error:', e);
        throw new Error('Failed to decode base64 message');
      }

      // Tentative de parsing JSON
      let encryptedData;
      try {
        encryptedData = JSON.parse(jsonStr);
        console.log('Debug - Parsed JSON data:', encryptedData);
      } catch (e) {
        console.error('Debug - JSON parse error:', e);
        throw new Error('Failed to parse JSON: ' + e);
      }

      // Vérification de la structure
      if (!encryptedData || typeof encryptedData !== 'object') {
        throw new Error('Decrypted data is not an object');
      }

      if (!encryptedData.iv || !encryptedData.content || !encryptedData.authTag) {
        throw new Error(`Missing required fields. Got: ${Object.keys(encryptedData).join(', ')}`);
      }

      const privateKey = encryptionService.formatPrivateKey(rawPrivateKey);
      const hash = crypto.createHash('sha256');
      hash.update(privateKey);
      const key = hash.digest();

      try {
        const decipher = crypto.createDecipheriv(
          ALGORITHM,
          key,
          Buffer.from(encryptedData.iv, 'base64')
        );

        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));

        let decrypted = decipher.update(encryptedData.content, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        console.log('Debug - Successfully decrypted message');
        return decrypted;
      } catch (e) {
        console.error('Debug - Decryption error:', e);
        throw new Error('Failed during final decryption step: ' + e);
      }
    } catch (error) {
      console.error('Debug - Top level error:', error);
      throw new Error('Symmetric decryption failed: ' + error);
    }
  }
};