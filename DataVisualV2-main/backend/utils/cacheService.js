import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client = null;
let isConnected = false;

const initRedis = async () => {
    try {
        client = createClient({ url: REDIS_URL });

        client.on('error', (err) => {
            if (isConnected) console.error('Redis Client Error:', err.message);
            isConnected = false;
        });

        client.on('connect', () => {
            console.log('Redis Client Connected');
            isConnected = true;
        });

        await client.connect();
    } catch (err) {
        console.warn('Redis unavailable — caching disabled. To enable, start Redis on', REDIS_URL);
        isConnected = false;
        client = null;
    }
};

// Initialize connection
initRedis();

/**
 * Get data from cache
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export const getCache = async (key) => {
    if (!isConnected || !client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`Cache get error [${key}]:`, err.message);
        return null;
    }
};

/**
 * Set data to cache
 * @param {string} key
 * @param {any} data
 * @param {number} ttl - Time to live in seconds
 */
export const setCache = async (key, data, ttl = 600) => {
    if (!isConnected || !client) return;
    try {
        await client.set(key, JSON.stringify(data), { EX: ttl });
    } catch (err) {
        console.error(`Cache set error [${key}]:`, err.message);
    }
};

/**
 * Delete data from cache
 * @param {string} key
 */
export const deleteCache = async (key) => {
    if (!isConnected || !client) return;
    try {
        await client.del(key);
    } catch (err) {
        console.error(`Cache delete error [${key}]:`, err.message);
    }
};

/**
 * Clear cache by pattern
 * @param {string} pattern
 */
export const clearPattern = async (pattern) => {
    if (!isConnected || !client) return;
    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
        }
    } catch (err) {
        console.error(`Cache clear pattern error [${pattern}]:`, err.message);
    }
};
