import crypto from 'crypto';

const algorithm = 'aes-256-cbc';

// Get encryption key from environment
const getKey = () => {
  const key = process.env.DATA_KEY;
  if (!key) {
    throw new Error('DATA_KEY environment variable is required for encryption');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt sensitive data using AES-256-CBC
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted data as hex string with format: iv:encrypted
 */
export const encrypt = (text) => {
  try {
    const key = getKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt sensitive data using AES-256-CBC
 * @param {string} encryptedData - Encrypted data in format: iv:encrypted
 * @returns {string} - Decrypted text
 */
export const decrypt = (encryptedData) => {
  try {
    const key = getKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, encrypted] = parts;
    
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};
