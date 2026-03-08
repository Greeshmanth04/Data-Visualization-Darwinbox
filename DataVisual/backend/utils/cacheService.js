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

// ─── Data-level cache helpers (for cache-first Data Catalog) ────────────────

/**
 * Store raw data rows in the cache under a data:<sourceType>:<uniqueKey> key.
 * @param {string} key  - full cache key e.g. "data:mongodb:abc123"
 * @param {object} payload - { rows, columns, sourceType, sourceName }
 * @param {number} ttl  - seconds (default 3600)
 */
export const setDataCache = async (key, payload, ttl = 3600) => {
    if (!isConnected || !client) return;
    try {
        await client.set(key, JSON.stringify(payload), { EX: ttl });
    } catch (err) {
        console.error(`DataCache set error [${key}]:`, err.message);
    }
};

/**
 * Retrieve raw data payload from cache.
 * @param {string} key
 * @returns {Promise<{rows:any[], columns:any[], sourceType:string, sourceName:string}|null>}
 */
export const getDataCache = async (key) => {
    if (!isConnected || !client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`DataCache get error [${key}]:`, err.message);
        return null;
    }
};

/**
 * List all data:* cache keys with metadata (rowCount, columns, ttl).
 * @returns {Promise<Array<{key, sourceType, sourceName, rowCount, columns, ttl}>>}
 */
export const listDataCacheKeys = async () => {
    if (!isConnected || !client) return [];
    try {
        const keys = await client.keys('data:*');
        const results = [];
        for (const key of keys) {
            const [raw, ttl] = await Promise.all([
                client.get(key),
                client.ttl(key)
            ]);
            if (!raw) continue;
            const payload = JSON.parse(raw);
            results.push({
                key,
                sourceType: payload.sourceType || 'unknown',
                sourceName: payload.sourceName || key,
                rowCount: Array.isArray(payload.rows) ? payload.rows.length : 0,
                columns: payload.columns || [],
                ttl
            });
        }
        return results;
    } catch (err) {
        console.error('DataCache list error:', err.message);
        return [];
    }
};

/**
 * Delete a single data cache entry.
 * @param {string} key
 */
export const deleteDataCache = async (key) => {
    if (!isConnected || !client) return;
    try {
        await client.del(key);
    } catch (err) {
        console.error(`DataCache delete error [${key}]:`, err.message);
    }
};
