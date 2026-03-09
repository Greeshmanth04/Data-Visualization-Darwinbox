/**
 * Shared database helper utilities.
 * Centralises connect/query/cleanup patterns for MySQL, PostgreSQL, and MongoDB.
 */

import mysql from 'mysql2/promise';
import pg from 'pg';
import { MongoClient } from 'mongodb';

// ── SSL helpers ──────────────────────────────────────────────────────────────

/** Strip sslmode param from a Postgres URI to avoid driver conflicts. */
export const stripSslMode = (uri) => {
    if (!uri || !uri.includes('sslmode=')) return uri;
    let cleaned = uri.replace(/[?&]sslmode=[^&]+/, '');
    if (cleaned.endsWith('?') || cleaned.endsWith('&')) cleaned = cleaned.slice(0, -1);
    return cleaned;
};

// ── Connection factories ─────────────────────────────────────────────────────

/**
 * Run a callback with a MySQL connection, auto-closing afterwards.
 * @param {string} uri  MySQL connection URI
 * @param {(conn: mysql.Connection) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withMysql = async (uri, fn) => {
    const conn = await mysql.createConnection(uri);
    try { return await fn(conn); }
    finally { await conn.end().catch(() => { }); }
};

/**
 * Run a callback with a Postgres client, auto-closing afterwards.
 * Automatically strips sslmode and adds SSL config.
 * @param {string} uri  Postgres connection URI
 * @param {(client: pg.Client) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withPostgres = async (uri, fn) => {
    const client = new pg.Client({
        connectionString: stripSslMode(uri),
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    try { return await fn(client); }
    finally { await client.end().catch(() => { }); }
};

/**
 * Run a callback with a MongoDB client, auto-closing afterwards.
 * @param {string} uri  MongoDB connection URI
 * @param {(client: MongoClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withMongo = async (uri, fn) => {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();
    try { return await fn(client); }
    finally { await client.close().catch(() => { }); }
};

// ── Common type inference ────────────────────────────────────────────────────

/** Infer a column type string from a JS value. */
export const inferType = (val) =>
    typeof val === 'number' ? 'number'
        : typeof val === 'boolean' ? 'boolean'
            : 'string';

/** Build a columns array from the first row of data. */
export const buildColumns = (firstRow) => {
    if (!firstRow) return [];
    return Object.entries(firstRow).map(([name, value]) => ({
        name,
        type: inferType(value),
        description: name.charAt(0).toUpperCase() + name.slice(1).replace(/[/_]/g, ' ')
    }));
};

/** Extract the database name from a URI's pathname. */
export const dbNameFromUri = (uri) => {
    try { return new URL(uri).pathname.replace('/', '') || 'test'; }
    catch { return 'test'; }
};
