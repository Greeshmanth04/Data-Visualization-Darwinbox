import CryptoJS from 'crypto-js';

export const encrypt = (text) => {
    return CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_KEY).toString();
};

export const decrypt = (ciphertext) => {
    if (!ciphertext) {
        return '';
    }
    const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
};
