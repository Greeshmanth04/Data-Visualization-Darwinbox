import express from 'express';
import multer from 'multer';
import * as datasetController from '../controllers/datasetController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', datasetController.getDatasets);
router.get('/:id', datasetController.getDatasetById);
router.put('/:id', datasetController.updateDataset);
router.delete('/:id', datasetController.deleteDataset);

router.post('/upload', upload.single('file'), datasetController.uploadFile);
router.post('/external', datasetController.saveExternalDataset);
router.post('/sqlview', datasetController.saveSqlView);

export default router;