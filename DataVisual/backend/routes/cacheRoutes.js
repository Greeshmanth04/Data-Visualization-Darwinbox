import express from 'express';
import {
    cacheDatasource,
    listCached,
    getCachedData,
    clearCached,
    createDashboardFromCache
} from '../controllers/cacheController.js';

const router = express.Router();

// Cache a datasource (fetch from external DB → Redis)
router.post('/datasource', cacheDatasource);

// List all cached datasets with metadata
router.get('/list', listCached);

// Create a Dashboard from a cached dataset
router.post('/dashboard', createDashboardFromCache);

// Get raw rows for a given cache key.
// The key is passed as a base64url-encoded query param to avoid route wildcard issues.
// GET /api/cache/data?key=<encodedKey>
router.get('/data', getCachedData);

// Delete / evict a cached entry — key passed as query param
// DELETE /api/cache/entry?key=<encodedKey>
router.delete('/entry', clearCached);

export default router;
