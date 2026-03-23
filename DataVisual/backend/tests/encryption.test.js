import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('Encryption Utility', () => {
    // Note: process.env.ENCRYPTION_KEY is mocked in tests/setup.js

    test('should encrypt and decrypt a standard string to get the original value', () => {
        const secretText = 'my_super_secret_database_password_123!';
        
        const ciphertext = encrypt(secretText);
        expect(ciphertext).toBeDefined();
        expect(ciphertext).not.toBe(secretText);
        expect(typeof ciphertext).toBe('string');
        
        const decryptedText = decrypt(ciphertext);
        expect(decryptedText).toBe(secretText);
    });

    test('should return empty string when decrypting null or undefined', () => {
        expect(decrypt(null)).toBe('');
        expect(decrypt(undefined)).toBe('');
        expect(decrypt('')).toBe('');
    });

});
