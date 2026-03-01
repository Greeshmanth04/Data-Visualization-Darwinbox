import { Dataset } from '../models/index.js';
import { getCache, setCache, deleteCache } from '../utils/cacheService.js';
import { encrypt } from '../utils/encryption.js';
import { MongoClient } from 'mongodb';
import mysql from 'mysql2/promise';
import pg from 'pg';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

export const getDatasets = async (req, res) => {
    try {
        const cacheKey = 'catalog:list';
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const datasets = await Dataset.find({});
        await setCache(cacheKey, datasets, 1800);
        res.json(datasets);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const updateDataset = async (req, res) => {
    try {
        const updated = await Dataset.findOneAndUpdate({ id: req.params.id }, req.body, { returnDocument: 'after' });
        if (!updated) return res.status(404).json({ message: 'Dataset not found' });
        await deleteCache('catalog:list');
        await deleteCache(`schema:${req.params.id}`);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const deleteDataset = async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only admins can delete datasets.' });
        }
        const result = await Dataset.findOneAndDelete({ id: req.params.id });
        if (!result) return res.status(404).json({ message: 'Dataset not found' });
        await deleteCache('catalog:list');
        await deleteCache(`schema:${req.params.id}`);
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const getDatasetById = async (req, res) => {
    try {
        const cacheKey = `schema:${req.params.id}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const dataset = await Dataset.findOne({ id: req.params.id });
        if (dataset) {
            await setCache(cacheKey, dataset, 3600);
        }
        res.json(dataset);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const getMongoDatabases = async (req, res) => {
    const { uri } = req.body;
    let client;
    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const adminDb = client.db().admin();
        const result = await adminDb.listDatabases();
        res.json({ databases: result.databases.map(db => db.name) });
    } catch (e) {
        res.status(400).json({ message: 'Failed to fetch databases: ' + e.message });
    } finally {
        if (client) await client.close().catch(() => { });
    }
};

export const getMongoCollections = async (req, res) => {
    const { uri, database } = req.body;
    let client;
    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const db = client.db(database);
        const collections = await db.listCollections().toArray();
        res.json({ collections: collections.map(c => c.name) });
    } catch (e) {
        res.status(400).json({ message: 'Failed to fetch collections: ' + e.message });
    } finally {
        if (client) await client.close().catch(() => { });
    }
};

export const previewMongoData = async (req, res) => {
    const { uri, database, collection } = req.body;
    let client;
    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const db = client.db(database);
        const data = await db.collection(collection).find({}).limit(1000).toArray();
        res.json({ data });
    } catch (e) {
        res.status(400).json({ message: 'Failed to preview data: ' + e.message });
    } finally {
        if (client) await client.close().catch(() => { });
    }
};

export const connectSql = async (req, res) => {
    const { type, host, port, database, user, password } = req.body;
    try {
        if (type === 'mysql') {
            const connection = await mysql.createConnection({ host, port, user, password, database });
            try {
                const [rows] = await connection.execute('SHOW TABLES');
                res.json({ tables: rows.map(r => Object.values(r)[0]) });
            } finally {
                await connection.end().catch(() => { });
            }
        } else if (type === 'postgres') {
            const client = new pg.Client({ host, port, user, password, database });
            await client.connect();
            try {
                const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
                res.json({ tables: result.rows.map(r => r.table_name) });
            } finally {
                await client.end().catch(() => { });
            }
        } else {
            res.status(400).json({ message: 'Unsupported SQL type' });
        }
    } catch (e) {
        res.status(400).json({ message: `Failed to connect to ${type}: ` + e.message });
    }
};

export const querySql = async (req, res) => {
    const { type, host, port, database, user, password, query } = req.body;
    if (!query || !query.toLowerCase().trim().startsWith('select')) {
        return res.status(400).json({ message: 'Only SELECT queries are allowed' });
    }
    try {
        const cacheKey = `query:${Buffer.from(JSON.stringify({ host, database, query })).toString('base64')}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ data: cached });

        let rows = [];
        if (type === 'mysql') {
            const connection = await mysql.createConnection({ host, port, user, password, database });
            try {
                const [result] = await connection.execute(query);
                rows = result;
            } finally {
                await connection.end().catch(() => { });
            }
        } else if (type === 'postgres') {
            const client = new pg.Client({ host, port, user, password, database });
            await client.connect();
            try {
                const result = await client.query(query);
                rows = result.rows;
            } finally {
                await client.end().catch(() => { });
            }
        }
        await setCache(cacheKey, rows, 600);
        res.json({ data: rows });
    } catch (e) {
        res.status(400).json({ message: 'Query failed: ' + e.message });
    }
};

export const saveExternalDataset = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can add datasets.' });
    }
    const { name, description, sourceType, connectionConfig, sourceMetadata, columns, data } = req.body;
    try {
        const datasetId = `ds_${Date.now()}`;
        const encryptedConfig = typeof connectionConfig === 'string'
            ? encrypt(connectionConfig)
            : encrypt(JSON.stringify(connectionConfig));

        const newDataset = await Dataset.create({
            id: datasetId,
            name,
            description,
            columns,
            data,
            sourceType,
            connectionConfig: encryptedConfig,
            sourceMetadata,
            isLive: true,
            accessPolicies: [
                { role: 'ADMIN', canView: true, canEdit: true, restrictedColumns: [] },
                { role: 'ANALYST', canView: true, canEdit: false, restrictedColumns: [] },
                { role: 'VIEWER', canView: true, canEdit: false, restrictedColumns: [] }
            ]
        });
        await deleteCache('catalog:list');
        res.status(201).json(newDataset);
    } catch (e) {
        res.status(500).json({ message: 'Failed to save external dataset: ' + e.message });
    }
};

export const uploadFile = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can upload datasets.' });
    }
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
        const { buffer, originalname, mimetype } = req.file;
        const name = originalname.split('.')[0];
        const datasetId = `ds_${Date.now()}`;
        let data = [];
        let columns = [];

        if (mimetype.includes('json') || originalname.endsWith('.json')) {
            data = JSON.parse(buffer.toString('utf-8'));
        } else if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || originalname.endsWith('.xlsx')) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        } else if (mimetype.includes('csv') || originalname.endsWith('.csv')) {
            await new Promise((resolve, reject) => {
                const stream = Readable.from(buffer.toString('utf-8'));
                stream.pipe(csv()).on('data', (row) => {
                    Object.keys(row).forEach(key => {
                        if (!isNaN(row[key]) && !isNaN(parseFloat(row[key]))) row[key] = parseFloat(row[key]);
                    });
                    data.push(row);
                }).on('end', resolve).on('error', reject);
            });
        }

        if (data.length === 0) return res.status(400).json({ message: 'Parsed data is empty' });

        columns = Object.keys(data[0]).map(key => ({
            name: key,
            type: typeof data[0][key] === 'number' ? 'number' : (typeof data[0][key] === 'boolean' ? 'boolean' : 'string'),
            description: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
        }));

        const newDataset = await Dataset.create({
            id: datasetId,
            name,
            description: `Uploaded dataset from ${originalname}`,
            columns,
            data,
            accessPolicies: [
                { role: 'ADMIN', canView: true, canEdit: true, restrictedColumns: [] },
                { role: 'ANALYST', canView: true, canEdit: false, restrictedColumns: [] },
                { role: 'VIEWER', canView: true, canEdit: false, restrictedColumns: [] }
            ]
        });

        await deleteCache('catalog:list');
        res.status(201).json(newDataset);
    } catch (e) {
        res.status(500).json({ message: 'Failed to process file: ' + e.message });
    }
};
