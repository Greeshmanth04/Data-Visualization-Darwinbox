import express from 'express';
import * as exportController from '../controllers/exportController.js';

const router = express.Router();

router.post('/csv', exportController.exportCSV);

export default router;
