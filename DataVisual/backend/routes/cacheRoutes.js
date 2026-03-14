import express from 'express';
import {
    cacheDatasource,
    listCached,
    getCachedData,
    clearCached,
    createDashboardFromCache,
    storeRawData
} from '../controllers/cacheController.js';

const router = express.Router();

router.post('/datasource', cacheDatasource);
router.post('/raw', storeRawData);
router.get('/list', listCached);
router.post('/dashboard', createDashboardFromCache);
router.get('/data', getCachedData);
router.delete('/entry', clearCached);

export default router;
