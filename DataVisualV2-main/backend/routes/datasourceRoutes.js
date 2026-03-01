import express from 'express';
import * as datasetController from '../controllers/datasetController.js';

const router = express.Router();

// MongoDB
router.post('/mongodb/databases', datasetController.getMongoDatabases);
router.post('/mongodb/collections', datasetController.getMongoCollections);
router.post('/mongodb/preview', datasetController.previewMongoData);

// SQL
router.post('/sql/connect', datasetController.connectSql);
router.post('/sql/query', datasetController.querySql);

export default router;
