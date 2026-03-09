import crypto from 'crypto';
import { withMysql, withPostgres, withMongo, dbNameFromUri, buildColumns } from '../utils/dbHelpers.js';
import { setDataCache, getDataCache, listDataCacheKeys, deleteDataCache } from '../utils/cacheService.js';
import { Dashboard } from '../models/index.js';

function makeCacheKey(sourceType, sourceName) {
    const hash = crypto.createHash('sha1')
        .update(`${sourceType}:${sourceName}:${Date.now()}`)
        .digest('hex').slice(0, 10);
    return `data:${sourceType}:${hash}`;
}

const aggregate = (rows, groupCol, valueCol, maxEntries = 20) => {
    const map = {};
    rows.forEach(r => {
        const cat = String(r[groupCol] ?? 'Unknown');
        map[cat] = (map[cat] || 0) + (Number(r[valueCol]) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, maxEntries)
        .map(([name, value]) => ({ name, value }));
};

export const cacheDatasource = async (req, res) => {
    const { sourceType, uri, table, collection, database, limit = 1000, ttl = 3600 } = req.body;
    if (!sourceType || !uri) return res.status(400).json({ message: 'sourceType and uri are required' });

    let rows = [];
    let sourceName = table || collection || database || sourceType;

    try {
        if (sourceType === 'mysql') {
            if (!table) return res.status(400).json({ message: 'table is required for MySQL' });
            rows = await withMysql(uri, async c => { const [r] = await c.execute(`SELECT * FROM \`${table}\` LIMIT ${parseInt(limit)}`); return r; });
            sourceName = table;
        } else if (sourceType === 'postgres') {
            if (!table) return res.status(400).json({ message: 'table is required for PostgreSQL' });
            rows = await withPostgres(uri, async c => (await c.query(`SELECT * FROM "${table}" LIMIT ${parseInt(limit)}`)).rows);
            sourceName = table;
        } else if (sourceType === 'mongodb') {
            if (!collection) return res.status(400).json({ message: 'collection is required for MongoDB' });
            rows = await withMongo(uri, async c => {
                const dbName = database || dbNameFromUri(uri);
                const docs = await c.db(dbName).collection(collection).find({}).limit(parseInt(limit)).toArray();
                return docs.map(d => { const { _id, ...rest } = d; return { _id: _id.toString(), ...rest }; });
            });
            sourceName = `${database || dbNameFromUri(uri)}.${collection}`;
        } else {
            return res.status(400).json({ message: `Unsupported sourceType: ${sourceType}` });
        }

        if (rows.length === 0) return res.json({ message: 'Source returned no rows — nothing cached.', rowCount: 0 });

        const columns = buildColumns(rows[0]);
        const cacheKey = makeCacheKey(sourceType, sourceName);
        await setDataCache(cacheKey, { rows, columns, sourceType, sourceName }, parseInt(ttl));

        res.status(201).json({ cacheKey, sourceName, sourceType, rowCount: rows.length, columns, ttl: parseInt(ttl), message: `${rows.length} rows cached successfully` });
    } catch (e) {
        res.status(500).json({ message: 'Failed to cache datasource: ' + e.message });
    }
};

export const listCached = async (_req, res) => {
    try { res.json(await listDataCacheKeys()); }
    catch (e) { res.status(500).json({ message: 'Failed to list cache entries: ' + e.message }); }
};

export const getCachedData = async (req, res) => {
    const key = req.query.key ? Buffer.from(req.query.key, 'base64').toString('utf8') : null;
    if (!key) return res.status(400).json({ message: 'key query parameter is required' });
    try {
        const payload = await getDataCache(key);
        if (!payload) return res.status(404).json({ message: 'Cache entry not found or expired' });
        res.json(payload);
    } catch (e) { res.status(500).json({ message: 'Failed to retrieve cached data: ' + e.message }); }
};

export const clearCached = async (req, res) => {
    const key = req.query.key ? Buffer.from(req.query.key, 'base64').toString('utf8') : null;
    if (!key) return res.status(400).json({ message: 'key query parameter is required' });
    try { await deleteDataCache(key); res.json({ message: 'Cache entry cleared', key }); }
    catch (e) { res.status(500).json({ message: 'Failed to clear cache entry: ' + e.message }); }
};

export const createDashboardFromCache = async (req, res) => {
    const { cacheKey, name, description, userId } = req.body;
    if (!cacheKey || !name || !userId) return res.status(400).json({ message: 'cacheKey, name, and userId are required' });

    try {
        const payload = await getDataCache(cacheKey);
        if (!payload) return res.status(404).json({ message: 'Cache entry not found or expired. Please re-fetch the data.' });

        const { rows, columns, sourceType, sourceName } = payload;
        const numCols = columns.filter(c => c.type === 'number');
        const strCols = columns.filter(c => c.type === 'string');
        const widgets = [];

        // KPI cards (up to 4 numeric columns)
        numCols.slice(0, 4).forEach((col, i) => {
            const total = rows.reduce((sum, r) => sum + (Number(r[col.name]) || 0), 0);
            widgets.push({
                id: `w_kpi_${i}`, type: 'kpi', title: col.description || col.name, datasetId: cacheKey,
                config: { field: col.name, value: total, aggregation: 'sum', prefix: '', suffix: '' },
                layout: { x: i * 3, y: 0, w: 3, h: 2 }
            });
        });

        // Bar chart
        if (strCols.length > 0 && numCols.length > 0) {
            widgets.push({
                id: 'w_bar_0', type: 'bar', title: `${numCols[0].name} by ${strCols[0].name}`, datasetId: cacheKey,
                config: { xField: strCols[0].name, yField: numCols[0].name, data: aggregate(rows, strCols[0].name, numCols[0].name), color: '#3b82f6' },
                layout: { x: 0, y: 2, w: 6, h: 4 }
            });
        }

        // Pie chart
        if (strCols.length > 1 && numCols.length > 0) {
            widgets.push({
                id: 'w_pie_0', type: 'pie', title: `${numCols[0].name} Distribution by ${strCols[1].name}`, datasetId: cacheKey,
                config: { field: strCols[1].name, valueField: numCols[0].name, data: aggregate(rows, strCols[1].name, numCols[0].name, 8) },
                layout: { x: 6, y: 2, w: 6, h: 4 }
            });
        }

        // Data table
        widgets.push({
            id: 'w_table_0', type: 'table', title: `${sourceName} — Data Preview`, datasetId: cacheKey,
            config: { columns: columns.map(c => c.name), data: rows.slice(0, 100) },
            layout: { x: 0, y: 6, w: 12, h: 5 }
        });

        const newDashboard = await Dashboard.create({
            id: `db_cache_${Date.now()}`, name,
            description: description || `Created from cached ${sourceType} data: ${sourceName}`,
            ownerId: userId, widgets, sharedWith: [], tags: ['cached', sourceType], isPublic: false
        });

        res.status(201).json({ dashboard: newDashboard, widgetCount: widgets.length, rowsUsed: rows.length, message: `Dashboard "${name}" created with ${widgets.length} widgets from cached data` });
    } catch (e) {
        res.status(500).json({ message: 'Failed to create dashboard from cache: ' + e.message });
    }
};
