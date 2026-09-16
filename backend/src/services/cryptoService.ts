import crypto from 'crypto';
import { getBackendConfig } from '../config';

const ALGORITHM = 'aes-256-gcm';

class CryptoService {
  static getKey(): Buffer {
    const encryptionKey = getBackendConfig().encryptionKey;
    return Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
  }

  static encrypt(value: string): string {
    if (!value) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  static decrypt(value: string): string {
    if (!value) return '';
    const [ivHex, tagHex, encryptedHex] = value.split(':');
    if (!ivHex || !tagHex || !encryptedHex) {
      return value;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

export default CryptoService;
