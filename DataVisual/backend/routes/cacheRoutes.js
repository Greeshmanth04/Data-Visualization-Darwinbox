import express from 'express';
import {
    cacheDatasource,
    listCached,
    getCachedData,
    clearCached,
    createDashboardFromCache
} from '../controllers/cacheController.js';

const router = express.Router();

router.post('/datasource', cacheDatasource);
router.get('/list', listCached);
router.post('/dashboard', createDashboardFromCache);
router.get('/data', getCachedData);
router.delete('/entry', clearCached);

export default router;
