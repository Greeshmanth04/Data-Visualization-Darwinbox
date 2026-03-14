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

export const setCache = async (key, data, ttl = 600) => {
    if (!isConnected || !client) return;
    try {
        await client.set(key, JSON.stringify(data), { EX: ttl });
    } catch (err) {
        console.error(`Cache set error [${key}]:`, err.message);
    }
};

export const deleteCache = async (key) => {
    if (!isConnected || !client) return;
    try {
        await client.del(key);
    } catch (err) {
        console.error(`Cache delete error [${key}]:`, err.message);
    }
};

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

export const setDataCache = async (key, payload, ttl = 3600) => {
    if (!isConnected || !client) {
        throw new Error('Redis unavailable — caching is restricted to Redis per configuration');
    }
    try {
        await client.set(key, JSON.stringify(payload), { EX: ttl });
    } catch (err) {
        console.error(`DataCache set error [${key}]:`, err.message);
        throw err;
    }
};

export const getDataCache = async (key) => {
    return getCache(key);
};

export const listDataCacheKeys = async () => {
    if (!isConnected || !client) return [];
    try {
        const keys = await client.keys('data:*');
        console.log(`[Cache] Listing keys for data:*, found ${keys.length} keys`);
        const results = [];
        for (const key of keys) {
            try {
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
            } catch (err) {
                console.error(`[Cache] Error parsing key ${key}:`, err.message);
            }
        }
        console.log(`[Cache] Returning ${results.length} valid cache entries`);
        return results;
    } catch (err) {
        console.error('DataCache list error:', err.message);
        return [];
    }
};

export const deleteDataCache = async (key) => {
    return deleteCache(key);
};
