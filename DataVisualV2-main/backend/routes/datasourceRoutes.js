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

// Query a live dataset by its stored (encrypted) connection — safe, server-side decryption
router.post('/dataset/:id/query', datasetController.queryDataset);


export default router;
