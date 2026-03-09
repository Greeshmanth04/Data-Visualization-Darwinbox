import { DatabaseConnection } from '../models/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { withMysql, withPostgres, withMongo, dbNameFromUri, inferType } from '../utils/dbHelpers.js';
import { logSchemaAction } from './schemaController.js';

// ── Schema fetchers ──────────────────────────────────────────────────────────

const fetchMysqlSchema = (uri) => withMysql(uri, async (conn) => {
    const dbName = new URL(uri).pathname.replace('/', '');
    const [tableRows] = await conn.query(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = ?', [dbName]
    );

    const tables = await Promise.all(tableRows.map(async (row) => {
        const name = row.TABLE_NAME || row.table_name;
        const [colRows, fkRows] = await Promise.all([
            conn.query(
                'SELECT column_name, data_type, column_key FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
                [dbName, name]
            ),
            conn.query(
                'SELECT column_name, referenced_table_name, referenced_column_name FROM information_schema.key_column_usage WHERE referenced_table_name IS NOT NULL AND table_schema = ? AND table_name = ?',
                [dbName, name]
            )
        ]);

        return {
            name,
            columns: colRows[0].map(c => ({
                name: c.COLUMN_NAME || c.column_name,
                type: c.DATA_TYPE || c.data_type,
                isPrimaryKey: (c.COLUMN_KEY || c.column_key) === 'PRI'
            })),
            foreignKeys: fkRows[0].map(fk => ({
                column: fk.COLUMN_NAME || fk.column_name,
                referenceTable: fk.REFERENCED_TABLE_NAME || fk.referenced_table_name,
                referenceColumn: fk.REFERENCED_COLUMN_NAME || fk.referenced_column_name
            }))
        };
    }));
    return tables;
});

const fetchPostgresSchema = (uri) => withPostgres(uri, async (client) => {
    const { rows: tableRows } = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );

    const tables = await Promise.all(tableRows.map(async ({ table_name }) => {
        const [colRes, pkRes, fkRes] = await Promise.all([
            client.query(
                'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
                ['public', table_name]
            ),
            client.query(
                `SELECT kcu.column_name FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                 WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1`, [table_name]
            ),
            client.query(
                `SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
                 FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                 JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
                 WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`, [table_name]
            )
        ]);

        const pkCols = new Set(pkRes.rows.map(r => r.column_name));
        return {
            name: table_name,
            columns: colRes.rows.map(c => ({ name: c.column_name, type: c.data_type, isPrimaryKey: pkCols.has(c.column_name) })),
            foreignKeys: fkRes.rows.map(fk => ({ column: fk.column_name, referenceTable: fk.foreign_table_name, referenceColumn: fk.foreign_column_name }))
        };
    }));
    return tables;
});

const fetchMongodbSchema = (uri) => withMongo(uri, async (client) => {
    const db = client.db(dbNameFromUri(uri));
    const collections = await db.listCollections().toArray();
    const tables = await Promise.all(collections.map(async ({ name }) => {
        const docs = await db.collection(name).find({}).limit(50).toArray();
        const fields = new Set();
        docs.forEach(d => Object.keys(d).forEach(k => fields.add(k)));
        return {
            name,
            columns: [...fields].map(k => ({ name: k, type: k === '_id' ? 'ObjectId' : 'Mixed', isPrimaryKey: k === '_id' })),
            foreignKeys: []
        };
    }));
    return tables;
});

/** Map DB type → schema fetcher */
const schemaFetchers = { mysql: fetchMysqlSchema, postgres: fetchPostgresSchema, mongodb: fetchMongodbSchema };

/** Strip internal Mongoose fields + encrypted URI from a connection object */
const sanitizeConn = (conn) => {
    const { _id, uri, __v, ...safe } = conn.toObject();
    return safe;
};

// ── Controllers ──────────────────────────────────────────────────────────────

export const testConnection = async (req, res) => {
    const { type, uri } = req.body;
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can test connections.' });
    try {
        if (type === 'mysql') await withMysql(uri, c => c.query('SELECT 1'));
        else if (type === 'postgres') await withPostgres(uri, c => c.query('SELECT 1'));
        else if (type === 'mongodb') await withMongo(uri, c => c.db(dbNameFromUri(uri)).command({ ping: 1 }));
        else return res.status(400).json({ message: 'Unsupported database type' });
        res.json({ success: true, message: 'Connection successful' });
    } catch (e) {
        res.status(400).json({ message: `Connection failed: ${e.message}` });
    }
};

export const createConnection = async (req, res) => {
    const { name, type, uri } = req.body;
    if (!name || !type || !uri) return res.status(400).json({ message: 'Missing required fields' });
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can add connections.' });

    const fetcher = schemaFetchers[type];
    if (!fetcher) return res.status(400).json({ message: 'Unsupported database type' });

    try {
        const tables = await fetcher(uri);
        const conn = new DatabaseConnection({
            id: `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name, type, uri: encrypt(uri), tables
        });
        await conn.save();
        res.status(201).json(sanitizeConn(conn));
    } catch (e) {
        res.status(500).json({ message: 'Failed to create connection: ' + e.message });
    }
};

export const getConnections = async (_req, res) => {
    try {
        const connections = await DatabaseConnection.find({});
        res.json(connections.map(sanitizeConn));
    } catch (e) {
        res.status(500).json({ message: 'Failed to fetch connections: ' + e.message });
    }
};

export const deleteConnection = async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can delete connections.' });
    try {
        const result = await DatabaseConnection.findOneAndDelete({ id: req.params.id });
        if (!result) return res.status(404).json({ message: 'Connection not found' });
        res.json({ message: 'Connection deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Failed to delete connection: ' + e.message });
    }
};

export const queryConnection = async (req, res) => {
    const { table, collection, limit = 50 } = req.body;
    try {
        const conn = await DatabaseConnection.findOne({ id: req.params.id });
        if (!conn) return res.status(404).json({ message: 'Connection not found' });

        const uri = decrypt(conn.uri);
        const lim = parseInt(limit);
        let data = [], columns = [];

        if (conn.type === 'mysql') {
            data = await withMysql(uri, async c => { const [rows] = await c.execute(`SELECT * FROM \`${table}\` LIMIT ${lim}`); return rows; });
        } else if (conn.type === 'postgres') {
            const result = await withPostgres(uri, c => c.query(`SELECT * FROM "${table}" LIMIT ${lim}`));
            data = result.rows;
            if (result.fields) columns = result.fields.map(f => ({ name: f.name, type: f.dataTypeID }));
        } else if (conn.type === 'mongodb') {
            data = await withMongo(uri, async c => {
                const docs = await c.db(dbNameFromUri(uri)).collection(collection || table).find({}).limit(lim).toArray();
                return docs.map(d => { const { _id, ...rest } = d; return { _id: _id.toString(), ...rest }; });
            });
        } else {
            return res.status(400).json({ message: 'Unsupported database type' });
        }

        if (data.length > 0 && columns.length === 0) {
            columns = Object.keys(data[0]).map(k => ({ name: k, type: inferType(data[0][k]) }));
        }
        res.json({ data, columns });
    } catch (e) {
        res.status(500).json({ message: 'Query failed: ' + e.message });
    }
};

export const refreshConnectionSchema = async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can refresh schema.' });
    try {
        const conn = await DatabaseConnection.findOne({ id: req.params.id });
        if (!conn) return res.status(404).json({ message: 'Connection not found' });

        const fetcher = schemaFetchers[conn.type];
        if (!fetcher) return res.status(400).json({ message: 'Unsupported database type' });

        const uri = decrypt(conn.uri);
        conn.tables = await fetcher(uri);
        await conn.save();

        await logSchemaAction(req.user?.userId || 'unknown', 'REFRESH_SCHEMA', {
            connectionId: req.params.id, connectionName: conn.name, tableCount: conn.tables.length
        });

        res.json(sanitizeConn(conn));
    } catch (e) {
        res.status(500).json({ message: 'Failed to refresh schema: ' + e.message });
    }
};
