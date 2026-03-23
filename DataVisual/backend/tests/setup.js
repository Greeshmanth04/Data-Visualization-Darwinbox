import { jest } from '@jest/globals';

// Mock environment variables for tests
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_bytes_long!';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '1h';

// Mock Redis client locally so we don't need a real redis server for unit tests
jest.mock('redis', () => {
    return {
        createClient: jest.fn(() => ({
            on: jest.fn(),
            connect: jest.fn().mockResolvedValue(),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
            keys: jest.fn().mockResolvedValue([]),
            ttl: jest.fn().mockResolvedValue(3600),
            quit: jest.fn().mockResolvedValue()
        }))
    };
});
