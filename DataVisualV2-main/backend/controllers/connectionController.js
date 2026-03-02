import { DatabaseConnection } from '../models/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { MongoClient } from 'mongodb';

// Helper to fetch schema from MySQL
const fetchMysqlSchema = async (connectionConfig) => {
    // connectionConfig.uri = "mysql://user:pass@host:port/database"
    const uri = connectionConfig.uri;
    const urlObj = new URL(uri);
    const dbName = urlObj.pathname.replace('/', '');

    // Some drivers expect host, user, password, database separately or accept a full URI
    const connection = await mysql.createConnection(uri);
    try {
        const tables = [];
        const [tableRows] = await connection.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ?
        `, [dbName]);

        for (const row of tableRows) {
            const tableName = row.TABLE_NAME || row.table_name;
            const [columnRows] = await connection.query(`
                SELECT column_name, data_type, column_key
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
            `, [dbName, tableName]);

            const columns = columnRows.map(col => ({
                name: col.COLUMN_NAME || col.column_name,
                type: col.DATA_TYPE || col.data_type,
                isPrimaryKey: (col.COLUMN_KEY === 'PRI') || (col.column_key === 'PRI')
            }));

            const [fkRows] = await connection.query(`
                SELECT column_name, referenced_table_name, referenced_column_name 
                FROM information_schema.key_column_usage 
                WHERE referenced_table_name IS NOT NULL 
                AND table_schema = ? AND table_name = ?;
            `, [dbName, tableName]);

            const foreignKeys = fkRows.map(fk => ({
                column: fk.COLUMN_NAME || fk.column_name,
                referenceTable: fk.REFERENCED_TABLE_NAME || fk.referenced_table_name,
                referenceColumn: fk.REFERENCED_COLUMN_NAME || fk.referenced_column_name
            }));

            tables.push({ name: tableName, columns, foreignKeys });
        }
        return tables;
    } finally {
        await connection.end().catch(() => { });
    }
};

// Helper to fetch schema from Postgres
const fetchPostgresSchema = async (connectionConfig) => {
    let uri = connectionConfig.uri;
    // Strip sslmode from URI to avoid driver conflicts with the ssl object
    if (uri.includes('sslmode=')) {
        uri = uri.replace(/[?&]sslmode=[^&]+/, '');
        if (uri.endsWith('?') || uri.endsWith('&')) uri = uri.slice(0, -1);
    }

    const client = new pg.Client({
        connectionString: uri,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Need to parse public db name or just fetch schema public
    try {
        const tables = [];
        const tableResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        for (const row of tableResult.rows) {
            const tableName = row.table_name;

            const colResult = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
            `, [tableName]);

            const pkResult = await client.query(`
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc 
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name 
                    AND tc.table_schema = kcu.table_schema 
                WHERE tc.constraint_type = 'PRIMARY KEY' 
                AND tc.table_name = $1
            `, [tableName]);
            const pkCols = pkResult.rows.map(r => r.column_name);

            const columns = colResult.rows.map(col => ({
                name: col.column_name,
                type: col.data_type,
                isPrimaryKey: pkCols.includes(col.column_name)
            }));

            const fkResult = await client.query(`
                 SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
            `, [tableName]);

            const foreignKeys = fkResult.rows.map(fk => ({
                column: fk.column_name,
                referenceTable: fk.foreign_table_name,
                referenceColumn: fk.foreign_column_name
            }));

            tables.push({ name: tableName, columns, foreignKeys });
        }
        return tables;
    } finally {
        await client.end().catch(() => { });
    }
};

// Helper to fetch schema from MongoDB (inferred from sample documents)
const fetchMongodbSchema = async (connectionConfig) => {
    // Construct URI: mongodb://user:pass@host:port
    const uri = connectionConfig.uri;
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

    await client.connect();
    try {
        const urlObj = new URL(uri);
        const dbName = urlObj.pathname.replace('/', '') || 'test';
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        const tables = [];

        for (const collInfo of collections) {
            const collectionName = collInfo.name;
            const collection = db.collection(collectionName);

            // Sample up to 50 documents to infer schema
            const sampleDocs = await collection.find({}).limit(50).toArray();

            const fieldSet = new Set();
            sampleDocs.forEach(doc => {
                Object.keys(doc).forEach(key => fieldSet.add(key));
            });

            const columns = Array.from(fieldSet).map(key => ({
                name: key,
                type: key === '_id' ? 'ObjectId' : 'Mixed',
                isPrimaryKey: key === '_id'
            }));

            // MongoDB doesn't have strict foreign keys in the schema definition
            const foreignKeys = [];

            tables.push({ name: collectionName, columns, foreignKeys });
        }
        return tables;
    } finally {
        await client.close().catch(() => { });
    }
};


// Controllers

export const testConnection = async (req, res) => {
    const { type, uri } = req.body;

    try {
        if (type === 'mysql') {
            const connection = await mysql.createConnection(uri);
            await connection.query('SELECT 1');
            await connection.end().catch(() => { });
        } else if (type === 'postgres') {
            let pgUri = uri;
            if (pgUri.includes('sslmode=')) {
                pgUri = pgUri.replace(/[?&]sslmode=[^&]+/, '');
                if (pgUri.endsWith('?') || pgUri.endsWith('&')) pgUri = pgUri.slice(0, -1);
            }
            const client = new pg.Client({
                connectionString: pgUri,
                ssl: { rejectUnauthorized: false }
            });
            await client.connect();
            await client.query('SELECT 1');
            await client.end().catch(() => { });
        } else if (type === 'mongodb') {
            const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
            await client.connect();
            const urlObj = new URL(uri);
            const dbName = urlObj.pathname.replace('/', '') || 'admin';
            await client.db(dbName).command({ ping: 1 });
            await client.close().catch(() => { });
        } else {
            return res.status(400).json({ message: 'Unsupported database type' });
        }
        res.json({ success: true, message: 'Connection successful' });
    } catch (e) {
        res.status(400).json({ message: `Connection failed: ${e.message}` });
    }
};

export const createConnection = async (req, res) => {
    const { name, type, uri } = req.body;

    if (!name || !type || !uri) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can add connections.' });
    }

    try {
        let tables = [];

        // Fetch schema based on type
        if (type === 'mysql') {
            tables = await fetchMysqlSchema({ uri });
        } else if (type === 'postgres') {
            tables = await fetchPostgresSchema({ uri });
        } else if (type === 'mongodb') {
            tables = await fetchMongodbSchema({ uri });
        } else {
            return res.status(400).json({ message: 'Unsupported database type' });
        }

        // Encrypt the entire URI payload
        const encryptedUri = encrypt(uri);

        const newConnection = new DatabaseConnection({
            id: `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name,
            type,
            uri: encryptedUri,
            tables
        });

        await newConnection.save();

        // Scrub password from response
        const responseData = newConnection.toObject();
        delete responseData.uri; // Remove the URI from the response

        res.status(201).json(responseData);
    } catch (e) {
        res.status(500).json({ message: 'Failed to create connection: ' + e.message });
    }
};

export const getConnections = async (req, res) => {
    try {
        const connections = await DatabaseConnection.find({});
        // NEVER expose raw URI containing passwords in GET routes
        const safeConnections = connections.map(conn => {
            const { _id, uri, createdAt, updatedAt, __v, ...safeProps } = conn.toObject();
            return safeProps;
        });
        res.json(safeConnections);
    } catch (e) {
        res.status(500).json({ message: 'Failed to fetch connections: ' + e.message });
    }
};

export const deleteConnection = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can delete connections.' });
    }
    try {
        const result = await DatabaseConnection.findOneAndDelete({ id: req.params.id });
        if (!result) return res.status(404).json({ message: 'Connection not found' });
        res.json({ message: 'Connection deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Failed to delete connection: ' + e.message });
    }
};

// Query live data from a saved connection
export const queryConnection = async (req, res) => {
    const { id } = req.params;
    const { table, collection, limit = 50 } = req.body;

    try {
        const conn = await DatabaseConnection.findOne({ id });
        if (!conn) return res.status(404).json({ message: 'Connection not found' });

        const uri = decrypt(conn.uri);
        const type = conn.type;
        let data = [];
        let columns = [];

        if (type === 'mysql') {
            const connection = await mysql.createConnection(uri);
            try {
                const [rows] = await connection.execute(`SELECT * FROM \`${table}\` LIMIT ${parseInt(limit)}`);
                data = rows;
                if (rows.length > 0) {
                    columns = Object.keys(rows[0]).map(k => ({ name: k, type: typeof rows[0][k] }));
                }
            } finally {
                await connection.end().catch(() => { });
            }
        } else if (type === 'postgres') {
            let pgUri = uri;
            if (pgUri.includes('sslmode=')) {
                pgUri = pgUri.replace(/[?&]sslmode=[^&]+/, '');
                if (pgUri.endsWith('?') || pgUri.endsWith('&')) pgUri = pgUri.slice(0, -1);
            }
            const client = new pg.Client({ connectionString: pgUri, ssl: { rejectUnauthorized: false } });
            await client.connect();
            try {
                const result = await client.query(`SELECT * FROM "${table}" LIMIT ${parseInt(limit)}`);
                data = result.rows;
                if (result.fields) {
                    columns = result.fields.map(f => ({ name: f.name, type: f.dataTypeID }));
                }
            } finally {
                await client.end().catch(() => { });
            }
        } else if (type === 'mongodb') {
            const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
            await client.connect();
            try {
                const urlObj = new URL(uri);
                const dbName = urlObj.pathname.replace('/', '') || 'admin';
                const db = client.db(dbName);
                const collName = collection || table;
                const docs = await db.collection(collName).find({}).limit(parseInt(limit)).toArray();
                data = docs.map(d => { const { _id, ...rest } = d; return { _id: _id.toString(), ...rest }; });
                if (data.length > 0) {
                    columns = Object.keys(data[0]).map(k => ({ name: k, type: typeof data[0][k] }));
                }
            } finally {
                await client.close().catch(() => { });
            }
        } else {
            return res.status(400).json({ message: 'Unsupported database type' });
        }

        res.json({ data, columns });
    } catch (e) {
        res.status(500).json({ message: 'Query failed: ' + e.message });
    }
};
