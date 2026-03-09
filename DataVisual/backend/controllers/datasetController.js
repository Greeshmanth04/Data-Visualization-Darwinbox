import { Dataset } from '../models/index.js';
import { getCache, setCache, deleteCache } from '../utils/cacheService.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { withMysql, withPostgres, withMongo, inferType } from '../utils/dbHelpers.js';
import { applyRowPolicies } from '../middleware/rbacMiddleware.js';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Default access policies for new datasets. */
const defaultPolicies = () => [
    { role: 'ADMIN', canView: true, canEdit: true, restrictedColumns: [] },
    { role: 'ANALYST', canView: true, canEdit: false, restrictedColumns: [] },
    { role: 'VIEWER', canView: true, canEdit: false, restrictedColumns: [] }
];

/** Build column definitions from the first row of data. */
const colsFromRow = (row) => Object.keys(row).map(k => ({
    name: k, type: inferType(row[k]), description: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')
}));

/** Invalidate dataset caches (all roles). */
const invalidateCache = async (datasetId) => {
    if (datasetId) {
        // Bust role-scoped cache keys so no stale row-filtered data is served
        for (const role of ['ADMIN', 'ANALYST', 'VIEWER']) {
            await deleteCache(`schema:${datasetId}:${role}`);
            await deleteCache(`catalog:list:${role}`);
        }
    } else {
        for (const role of ['ADMIN', 'ANALYST', 'VIEWER']) {
            await deleteCache(`catalog:list:${role}`);
        }
    }
};

/** Ensure only SELECT queries are executed. */
const assertSelect = (query) => {
    if (!query?.toLowerCase().trim().startsWith('select')) throw new Error('Only SELECT queries are allowed');
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const getDatasets = async (req, res) => {
    try {
        const role = req.user?.role || 'VIEWER';
        const cacheKey = `catalog:list:${role}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const datasets = await Dataset.find({});

        // Filter data for each dataset according to row policies
        const filteredDatasets = datasets.map(ds => {
            const dsObj = ds.toObject();
            if (dsObj.data?.length) {
                dsObj.data = applyRowPolicies(dsObj.data, dsObj.rowPolicies, role);
            }
            if (role !== 'ADMIN') delete dsObj.rowPolicies;
            return dsObj;
        });

        await setCache(cacheKey, filteredDatasets, 1800);
        res.json(filteredDatasets);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

export const getDatasetById = async (req, res) => {
    try {
        const role = req.user?.role || 'VIEWER';
        const cacheKey = `schema:${req.params.id}:${role}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const dataset = await Dataset.findOne({ id: req.params.id });
        if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

        // Apply row-level filtering before responding
        const datasetObj = dataset.toObject();
        datasetObj.data = applyRowPolicies(datasetObj.data, datasetObj.rowPolicies, role);

        // Non-admins don't need to see the raw policy definitions
        if (role !== 'ADMIN') delete datasetObj.rowPolicies;

        await setCache(cacheKey, datasetObj, 3600);
        res.json(datasetObj);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

export const updateDataset = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({ id: req.params.id });
        if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

        // Admin-only: column type changes
        if (req.body.columns && dataset.columns) {
            const typeMap = Object.fromEntries(dataset.columns.map(c => [c.name, c.type]));
            if (req.body.columns.some(c => typeMap[c.name] && c.type !== typeMap[c.name]) && req.user?.role !== 'ADMIN') {
                return res.status(403).json({ message: 'Only admins can change column datatypes.' });
            }
        }

        // Only ADMINs may update rowPolicies via updateDataset (the dedicated endpoint is preferred)
        const editableFields = ['name', 'description', 'columns', 'accessPolicies'];
        if (req.user?.role === 'ADMIN') editableFields.push('rowPolicies');
        editableFields.forEach(f => {
            if (req.body[f] !== undefined) dataset[f] = req.body[f];
        });

        const updated = await dataset.save();
        await invalidateCache(req.params.id);
        res.json(updated);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

export const deleteDataset = async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can delete datasets.' });
        const result = await Dataset.findOneAndDelete({ id: req.params.id });
        if (!result) return res.status(404).json({ message: 'Dataset not found' });
        await invalidateCache(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── MongoDB exploration ──────────────────────────────────────────────────────

export const getMongoDatabases = async (req, res) => {
    try {
        const dbs = await withMongo(req.body.uri, async c => {
            const result = await c.db().admin().listDatabases();
            return result.databases.map(d => d.name);
        });
        res.json({ databases: dbs });
    } catch (e) { res.status(400).json({ message: 'Failed to fetch databases: ' + e.message }); }
};

export const getMongoCollections = async (req, res) => {
    try {
        const cols = await withMongo(req.body.uri, async c => {
            const list = await c.db(req.body.database).listCollections().toArray();
            return list.map(l => l.name);
        });
        res.json({ collections: cols });
    } catch (e) { res.status(400).json({ message: 'Failed to fetch collections: ' + e.message }); }
};

export const previewMongoData = async (req, res) => {
    try {
        const data = await withMongo(req.body.uri, c =>
            c.db(req.body.database).collection(req.body.collection).find({}).limit(1000).toArray()
        );
        res.json({ data });
    } catch (e) { res.status(400).json({ message: 'Failed to preview data: ' + e.message }); }
};

// ── SQL exploration ──────────────────────────────────────────────────────────

export const connectSql = async (req, res) => {
    const { type, uri } = req.body;
    try {
        if (type === 'mysql') {
            const tables = await withMysql(uri, async c => { const [rows] = await c.execute('SHOW TABLES'); return rows.map(r => Object.values(r)[0]); });
            res.json({ tables });
        } else if (type === 'postgres') {
            const tables = await withPostgres(uri, async c => {
                const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
                return r.rows.map(r => r.table_name);
            });
            res.json({ tables });
        } else {
            res.status(400).json({ message: 'Unsupported SQL type' });
        }
    } catch (e) { res.status(400).json({ message: `Failed to connect to ${type}: ` + e.message }); }
};

export const querySql = async (req, res) => {
    const { type, uri, query } = req.body;
    try {
        assertSelect(query);
        let rows;
        if (type === 'mysql') {
            rows = await withMysql(uri, async c => { const [r] = await c.execute(query); return r; });
        } else if (type === 'postgres') {
            rows = await withPostgres(uri, async c => (await c.query(query)).rows);
        } else {
            return res.status(400).json({ message: 'Unsupported SQL type' });
        }
        res.json({ data: rows });
    } catch (e) { res.status(400).json({ message: 'Query failed: ' + e.message }); }
};

// ── Dataset creation ─────────────────────────────────────────────────────────

export const saveExternalDataset = async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can add datasets.' });
    const { name, description, sourceType, connectionConfig, sourceMetadata, columns, data } = req.body;
    try {
        const encryptedConfig = encrypt(typeof connectionConfig === 'string' ? connectionConfig : JSON.stringify(connectionConfig));
        const newDataset = await Dataset.create({
            id: `ds_${Date.now()}`, name, description, columns, data, sourceType,
            connectionConfig: encryptedConfig, sourceMetadata, isLive: true,
            accessPolicies: defaultPolicies()
        });
        await invalidateCache();
        res.status(201).json(newDataset);
    } catch (e) { res.status(500).json({ message: 'Failed to save external dataset: ' + e.message }); }
};

export const uploadFile = async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can upload datasets.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const { buffer, originalname, mimetype } = req.file;
        let data = [];

        if (mimetype.includes('json') || originalname.endsWith('.json')) {
            data = JSON.parse(buffer.toString('utf-8'));
        } else if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || originalname.endsWith('.xlsx')) {
            const wb = XLSX.read(buffer, { type: 'buffer' });
            data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else if (mimetype.includes('csv') || originalname.endsWith('.csv')) {
            await new Promise((resolve, reject) => {
                Readable.from(buffer.toString('utf-8')).pipe(csv())
                    .on('data', row => {
                        Object.keys(row).forEach(k => { if (!isNaN(row[k]) && !isNaN(parseFloat(row[k]))) row[k] = parseFloat(row[k]); });
                        data.push(row);
                    }).on('end', resolve).on('error', reject);
            });
        }

        if (data.length === 0) return res.status(400).json({ message: 'Parsed data is empty' });

        const newDataset = await Dataset.create({
            id: `ds_${Date.now()}`, name: originalname.split('.')[0],
            description: `Uploaded dataset from ${originalname}`,
            columns: colsFromRow(data[0]), data, accessPolicies: defaultPolicies()
        });
        await invalidateCache();
        res.status(201).json(newDataset);
    } catch (e) { res.status(500).json({ message: 'Failed to process file: ' + e.message }); }
};

// ── Live query ───────────────────────────────────────────────────────────────

export const queryDataset = async (req, res) => {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ message: 'Query is required' });

    try {
        const dataset = await Dataset.findOne({ id: req.params.id });
        if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
        if (!dataset.isLive || !dataset.connectionConfig) return res.status(400).json({ message: 'Dataset does not have a live connection' });

        const config = JSON.parse(decrypt(dataset.connectionConfig));
        const sourceType = dataset.sourceType || config.type;
        let rows = [];

        if (sourceType === 'mysql') {
            assertSelect(query);
            const mysqlUri = config.uri || `mysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
            rows = await withMysql(mysqlUri, async c => { const [r] = await c.execute(query); return r; });
        } else if (sourceType === 'postgres') {
            assertSelect(query);
            const pgConn = config.uri ? { connectionString: config.uri } : { host: config.host, port: config.port, user: config.user, password: config.password, database: config.database };
            rows = await withPostgres(pgConn.connectionString || `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`, async c => (await c.query(query)).rows);
        } else if (sourceType === 'mongodb') {
            rows = await withMongo(config.uri, async c => {
                const col = c.db(config.database).collection(config.collection || dataset.sourceMetadata);
                let queryObj = {}, limit = 500;
                try {
                    const findMatch = query.match(/find\s*\((.*?)\)/s);
                    if (findMatch?.[1]?.trim() && findMatch[1].trim() !== '{}') {
                        try { queryObj = JSON.parse(findMatch[1].trim()); } catch { /* fallback to {} */ }
                    }
                    const limitMatch = query.match(/limit\s*\(\s*(\d+)\s*\)/i);
                    if (limitMatch?.[1]) limit = parseInt(limitMatch[1]);
                } catch { /* fallback to {} */ }
                return col.find(queryObj).limit(limit).toArray();
            });
        } else {
            return res.status(400).json({ message: `Unsupported live dataset type: ${sourceType}` });
        }

        // Apply row policies to live query results
        const role = req.user?.role || 'VIEWER';
        if (rows && dataset.rowPolicies?.length) {
            rows = applyRowPolicies(rows, dataset.rowPolicies, role);
        }
        res.json({ data: rows });
    } catch (e) { res.status(400).json({ message: 'Query failed: ' + e.message }); }
};

// ── Save SQL view ────────────────────────────────────────────────────────────

export const saveSqlView = async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can save SQL views.' });
    const { name, description, sourceDatasetId, query, staticData } = req.body;

    try {
        const source = await Dataset.findOne({ id: sourceDatasetId });
        if (!source) return res.status(404).json({ message: 'Source dataset not found' });

        const base = {
            id: `ds_view_${Date.now()}`, name,
            description: description || `Created from ${source.name}`,
            accessPolicies: defaultPolicies()
        };

        let payload;
        if (source.isLive) {
            payload = {
                ...base, sourceType: source.sourceType, connectionConfig: source.connectionConfig,
                sourceMetadata: query, isLive: true,
                columns: staticData?.length ? colsFromRow(staticData[0]) : [],
                data: []
            };
        } else {
            if (!staticData?.length) return res.status(400).json({ message: 'Static query results are required to save an in-memory view.' });
            payload = {
                ...base, sourceType: 'json', connectionConfig: '', isLive: false,
                sourceMetadata: `Export from ${source.name}`,
                columns: colsFromRow(staticData[0]), data: staticData
            };
        }

        const newDataset = await Dataset.create(payload);
        await invalidateCache();
        res.status(201).json(newDataset);
    } catch (e) { res.status(500).json({ message: 'Failed to save SQL view: ' + e.message }); }
};

// ── Row-Based Access Control ──────────────────────────────────────────────────

/**
 * PATCH /api/datasets/:id/row-policies
 * Replace the full rowPolicies array for a dataset. ADMIN only.
 */
export const updateRowPolicies = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can manage row policies.' });
    }
    const { rowPolicies } = req.body;
    if (!Array.isArray(rowPolicies)) {
        return res.status(400).json({ message: 'rowPolicies must be an array.' });
    }
    try {
        const dataset = await Dataset.findOne({ id: req.params.id });
        if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

        dataset.rowPolicies = rowPolicies;
        await dataset.save();
        await invalidateCache(req.params.id);
        res.json({ message: 'Row policies updated.', rowPolicies: dataset.rowPolicies });
    } catch (e) { res.status(500).json({ message: 'Failed to update row policies: ' + e.message }); }
};
