import mysql from 'mysql2/promise';
import pg from 'pg';
import { MongoClient } from 'mongodb';

export const stripSslMode = (uri) => {
    if (!uri || !uri.includes('sslmode=')) {
        return uri;
    }
    let cleaned = uri.replace(/[?&]sslmode=[^&]+/, (match) => {
        return match.startsWith('?') ? '?' : '';
    });
    cleaned = cleaned.replace(/\?&/, '?').replace(/\?$/, '').replace(/&$/, '');
    return cleaned;
};

export const withMysql = async (uri, fn) => {
    const conn = await mysql.createConnection(uri);
    try {
        return await fn(conn);
    } finally {
        await conn.end().catch(() => { });
    }
};

export const withPostgres = async (uri, fn) => {
    const client = new pg.Client({
        connectionString: stripSslMode(uri),
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.end().catch(() => { });
    }
};

export const withMongo = async (uri, fn) => {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.close().catch(() => { });
    }
};

export const inferType = (val) => {
    if (typeof val === 'number') {
        return 'number';
    }
    if (typeof val === 'boolean') {
        return 'boolean';
    }
    return 'string';
};

export const buildColumns = (firstRow) => {
    if (!firstRow) {
        return [];
    }
    return Object.entries(firstRow).map(([name, value]) => ({
        name,
        type: inferType(value),
        description: name.charAt(0).toUpperCase() + name.slice(1).replace(/[/_]/g, ' ')
    }));
};

export const dbNameFromUri = (uri) => {
    try {
        return new URL(uri).pathname.replace('/', '') || 'test';
    } catch {
        return 'test';
    }
};
