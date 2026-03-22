import CryptoJS from 'crypto-js';

const getKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        console.warn('[Security] ENCRYPTION_KEY not set in .env — encryption/decryption will fail.');
    }
    return key;
};

export const encrypt = (text) => {
    return CryptoJS.AES.encrypt(text, getKey()).toString();
};

export const decrypt = (ciphertext) => {
    if (!ciphertext) {
        return '';
    }
    const bytes = CryptoJS.AES.decrypt(ciphertext, getKey());
    return bytes.toString(CryptoJS.enc.Utf8);
};
