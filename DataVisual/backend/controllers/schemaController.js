import { CrossDatabaseRelationship, DatabaseConnection, Dataset } from '../models/index.js';
import { decrypt } from '../utils/encryption.js';
import { withMysql, withPostgres, withMongo, dbNameFromUri, inferType } from '../utils/dbHelpers.js';
import alasql from 'alasql';

const clean = (doc) => {
    const o = doc.toObject();
    delete o._id;
    delete o.__v;
    return o;
};

const fetchRows = async (conn, tableName, limit = 5000) => {
    const uri = decrypt(conn.uri);
    const lim = parseInt(limit);
    if (conn.type === 'mysql') {
        return withMysql(uri, async (c) => {
            const [rows] = await c.execute(`SELECT * FROM \`${tableName}\` LIMIT ${lim}`);
            return rows;
        });
    } else if (conn.type === 'postgres') {
        return withPostgres(uri, async (c) => (await c.query(`SELECT * FROM "${tableName}" LIMIT ${lim}`)).rows);
    } else if (conn.type === 'mongodb') {
        return withMongo(uri, async (c) => {
            const docs = await c.db(dbNameFromUri(uri)).collection(tableName).find({}).limit(lim).toArray();
            return docs.map(d => {
                const { _id, ...rest } = d;
                return { _id: _id.toString(), ...rest };
            });
        });
    }
    throw new Error(`Unsupported DB type: ${conn.type}`);
};

const normalizeKey = (v) => {
    return v == null ? '__null__' : String(v).trim();
};

const joinRows = (srcRows, tgtRows, srcCol, tgtCol, tgtTable) => {
    const tgtPrefix = `${tgtTable}__`;
    const tgtColNames = tgtRows.length > 0 ? Object.keys(tgtRows[0]) : [];
    const getOutKey = (srcRow, k) => {
        return srcRow.hasOwnProperty(k) && k !== tgtCol ? `${tgtPrefix}${k}` : k;
    };

    if (!srcRows.length || !tgtRows.length) {
        return {
            rows: srcRows.map(r => {
                const row = { ...r };
                tgtColNames.forEach(k => {
                    if (k !== tgtCol) {
                        row[getOutKey(r, k)] = null;
                    }
                });
                return row;
            }),
            matchedCount: 0,
            unmatchedCount: srcRows.length
        };
    }

    // Build lookup map
    const tgtMap = new Map();
    tgtRows.forEach(row => {
        const key = normalizeKey(row[tgtCol]);
        if (!tgtMap.has(key)) {
            tgtMap.set(key, []);
        }
        tgtMap.get(key).push(row);
    });

    const merged = [];
    let matchedCount = 0;

    for (const srcRow of srcRows) {
        const matches = tgtMap.get(normalizeKey(srcRow[srcCol]));
        if (matches?.length) {
            matchedCount++;
            for (const tgtRow of matches) {
                const combined = { ...srcRow };
                tgtColNames.forEach(k => {
                    combined[getOutKey(srcRow, k)] = tgtRow[k] ?? null;
                });
                merged.push(combined);
            }
        } else {
            const combined = { ...srcRow };
            tgtColNames.forEach(k => {
                if (k !== tgtCol) {
                    combined[getOutKey(srcRow, k)] = null;
                }
            });
            merged.push(combined);
        }
    }

    return { rows: merged, matchedCount, unmatchedCount: srcRows.length - matchedCount };
};

export const getRelationships = async (req, res) => {
    try {
        const { connectionId } = req.query;
        const filter = connectionId
            ? { $or: [{ sourceConnectionId: connectionId }, { targetConnectionId: connectionId }] }
            : {};
        const rels = await CrossDatabaseRelationship.find(filter).sort({ createdAt: -1 });

        // Enrich with connection names
        const connIds = [...new Set(rels.flatMap(r => [r.sourceConnectionId, r.targetConnectionId]))];
        const conns = await DatabaseConnection.find({ id: { $in: connIds } });
        const nameMap = Object.fromEntries(conns.map(c => [c.id, c.name]));

        res.json(rels.map(r => ({
            ...clean(r),
            sourceConnectionName: nameMap[r.sourceConnectionId] || 'Unknown',
            targetConnectionName: nameMap[r.targetConnectionId] || 'Unknown'
        })));
    } catch (e) {
        res.status(500).json({ message: 'Failed to fetch relationships: ' + e.message });
    }
};

export const createRelationship = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can create relationships.' });
    }
    const { sourceConnectionId, sourceTable, sourceColumn, targetConnectionId, targetTable, targetColumn, joinType } = req.body;
    if (!sourceConnectionId || !sourceTable || !sourceColumn || !targetConnectionId || !targetTable || !targetColumn) {
        return res.status(400).json({ message: 'Missing required fields for relationship' });
    }
    try {
        const rel = new CrossDatabaseRelationship({
            id: `rel_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            sourceConnectionId, sourceTable, sourceColumn,
            targetConnectionId, targetTable, targetColumn,
            joinType: joinType || '1:N',
            createdBy: req.user?.userId || 'unknown'
        });
        await rel.save();
        res.status(201).json(clean(rel));
    } catch (e) {
        res.status(500).json({ message: 'Failed to create relationship: ' + e.message });
    }
};

export const updateRelationship = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can update relationships.' });
    }
    try {
        const rel = await CrossDatabaseRelationship.findOne({ id: req.params.id });
        if (!rel) {
            return res.status(404).json({ message: 'Relationship not found' });
        }

        const allowed = ['sourceConnectionId', 'sourceTable', 'sourceColumn', 'targetConnectionId', 'targetTable', 'targetColumn', 'joinType'];
        allowed.forEach(f => {
            if (req.body[f] !== undefined) {
                rel[f] = req.body[f];
            }
        });
        await rel.save();
        res.json(clean(rel));
    } catch (e) {
        res.status(500).json({ message: 'Failed to update relationship: ' + e.message });
    }
};

export const deleteRelationship = async (req, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only admins can delete relationships.' });
    }
    try {
        const result = await CrossDatabaseRelationship.findOneAndDelete({ id: req.params.id });
        if (!result) {
            return res.status(404).json({ message: 'Relationship not found' });
        }
        res.json({ message: 'Relationship deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Failed to delete relationship: ' + e.message });
    }
};

export const executeJoin = async (req, res) => {
    const limit = Math.min(parseInt(req.body?.limit || 2000), 10000);

    try {
        const rel = await CrossDatabaseRelationship.findOne({ id: req.params.id });
        if (!rel) {
            return res.status(404).json({ message: 'Relationship not found' });
        }

        const [srcConn, tgtConn] = await Promise.all([
            DatabaseConnection.findOne({ id: rel.sourceConnectionId }),
            DatabaseConnection.findOne({ id: rel.targetConnectionId })
        ]);
        if (!srcConn) {
            return res.status(404).json({ message: `Source connection not found: ${rel.sourceConnectionId}` });
        }
        if (!tgtConn) {
            return res.status(404).json({ message: `Target connection not found: ${rel.targetConnectionId}` });
        }

        const [srcRows, tgtRows] = await Promise.all([
            fetchRows(srcConn, rel.sourceTable, limit),
            fetchRows(tgtConn, rel.targetTable, limit)
        ]);

        const sampleKeys = (rows, col) => [...new Set(rows.slice(0, 10).map(r => r[col]))].slice(0, 5);
        const { rows: merged, matchedCount, unmatchedCount } = joinRows(srcRows, tgtRows, rel.sourceColumn, rel.targetColumn, rel.targetTable);

        const columns = merged.length > 0
            ? Object.keys(merged[0]).map(k => ({ name: k, type: inferType(merged[0][k]) }))
            : [];

        res.json({
            data: merged,
            columns,
            meta: {
                sourceTable: rel.sourceTable, sourceDB: srcConn.name, sourceType: srcConn.type,
                targetTable: rel.targetTable, targetDB: tgtConn.name, targetType: tgtConn.type,
                joinColumn: `${rel.sourceTable}.${rel.sourceColumn} = ${rel.targetTable}.${rel.targetColumn}`,
                joinType: rel.joinType, rowCount: merged.length,
                sourceRowCount: srcRows.length, targetRowCount: tgtRows.length,
                matchedCount, unmatchedCount,
                srcSampleKeys: sampleKeys(srcRows, rel.sourceColumn),
                tgtSampleKeys: sampleKeys(tgtRows, rel.targetColumn)
            }
        });
    } catch (e) {
        res.status(500).json({ message: 'Join execution failed: ' + e.message });
    }
};

export const createMergedDataset = async (req, res) => {
    const { name, description, data, columns } = req.body;
    if (!name || !data || !columns) {
        return res.status(400).json({ message: 'name, data, columns are required' });
    }

    try {
        const rel = await CrossDatabaseRelationship.findOne({ id: req.params.id });
        const [srcConn, tgtConn] = rel
            ? await Promise.all([
                DatabaseConnection.findOne({ id: rel.sourceConnectionId }),
                DatabaseConnection.findOne({ id: rel.targetConnectionId })
            ])
            : [null, null];

        const dataset = new Dataset({
            id: `ds_merge_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name,
            description: description || `Cross-DB join: ${srcConn?.name || '?'} × ${tgtConn?.name || '?'}`,
            columns: columns.map(c => ({
                name: c.name,
                type: inferType(c.type === 'number' ? 0 : c.type === 'boolean' ? true : ''),
                description: c.name,
                displayName: c.name
            })),
            data,
            sourceType: 'postgres',
            isLive: false,
            sourceMetadata: {
                type: 'cross_db_join',
                relationshipId: req.params.id,
                sourceDB: srcConn?.name,
                targetDB: tgtConn?.name
            }
        });

        await dataset.save();
        res.status(201).json(dataset.toObject());
    } catch (e) {
        res.status(500).json({ message: 'Failed to create merged dataset: ' + e.message });
    }
};

export const executeCrossDbQuery = async (req, res) => {
    const { query, limit = 5000 } = req.body;
    if (!query) {
        return res.status(400).json({ message: 'query is required' });
    }

    try {
        // Identify all connections and tables in the query
        // Expected format: <connectionName>.<tableName>
        const tablePattern = /([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g;
        const matches = [...query.matchAll(tablePattern)];

        const sources = new Map();
        for (const [full, connName, tableName] of matches) {
            if (!sources.has(full)) {
                const conn = await DatabaseConnection.findOne({
                    name: { $regex: new RegExp(`^${connName}$`, 'i') }
                });
                if (conn) {
                    sources.set(full, { conn, tableName, original: full });
                }
            }
        }

        if (sources.size === 0) {
            return res.status(400).json({
                message: 'No valid cross-database tables found. Use "connectionName.tableName" format.'
            });
        }

        // Fetch data from all required sources
        const fetchPromises = Array.from(sources.values()).map(async (src) => {
            const rows = await fetchRows(src.conn, src.tableName, limit);
            return { id: src.original, rows };
        });

        const allData = await Promise.all(fetchPromises);

        // Prepare alasql environment
        let virtualQuery = query;
        allData.forEach((data, index) => {
            const tempTableName = `table_${index}`;
            const escapedName = data.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            virtualQuery = virtualQuery.replace(new RegExp(escapedName, 'g'), tempTableName);
            alasql(`CREATE TABLE IF NOT EXISTS ${tempTableName};`);
            alasql(`TRUNCATE TABLE ${tempTableName};`);
            alasql(`INSERT INTO ${tempTableName} SELECT * FROM ?`, [data.rows]);
        });

        // Execute the query
        const result = alasql(virtualQuery);

        // Clean up
        allData.forEach((_, index) => {
            alasql(`DROP TABLE IF EXISTS table_${index};`);
        });

        const columns = result.length > 0
            ? Object.keys(result[0]).map(k => ({ name: k, type: inferType(result[0][k]) }))
            : [];

        res.json({ data: result, columns });
    } catch (e) {
        res.status(500).json({ message: 'Cross-DB query execution failed: ' + e.message });
    }
};
