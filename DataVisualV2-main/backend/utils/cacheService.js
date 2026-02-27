import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client = null;
let isConnected = false;

const initRedis = async () => {
    try {
        client = createClient({ url: REDIS_URL });

        client.on('error', (err) => {
            console.error('Redis Client Error:', err);
            isConnected = false;
        });

        client.on('connect', () => {
            console.log('Redis Client Connected');
            isConnected = true;
        });

        await client.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
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
        if (data) {
            console.log(`[CACHE HIT] key: ${key}`);
            return JSON.parse(data);
        }
        console.log(`[CACHE MISS] key: ${key}`);
        return null;
    } catch (err) {
        console.error(`Error getting cache for key ${key}:`, err);
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
        await client.set(key, JSON.stringify(data), {
            EX: ttl
        });
        console.log(`[CACHE SET] key: ${key}, ttl: ${ttl}s`);
    } catch (err) {
        console.error(`Error setting cache for key ${key}:`, err);
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
        console.log(`[CACHE DEL] key: ${key}`);
    } catch (err) {
        console.error(`Error deleting cache for key ${key}:`, err);
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
            console.log(`[CACHE CLEAR PATTERN] pattern: ${pattern}, keys deleted: ${keys.length}`);
        }
    } catch (err) {
        console.error(`Error clearing pattern ${pattern}:`, err);
    }
};
