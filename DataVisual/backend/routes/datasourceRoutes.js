import express from 'express';
import * as datasetController from '../controllers/datasetController.js';

const router = express.Router();

router.post('/mongodb/databases', datasetController.getMongoDatabases);
router.post('/mongodb/collections', datasetController.getMongoCollections);
router.post('/mongodb/preview', datasetController.previewMongoData);
router.post('/sql/connect', datasetController.connectSql);
router.post('/sql/query', datasetController.querySql);
router.post('/dataset/:id/query', datasetController.queryDataset);

export default router;
