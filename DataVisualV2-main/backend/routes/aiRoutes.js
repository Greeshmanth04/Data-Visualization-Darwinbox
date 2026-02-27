import express from 'express';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

router.post('/generate-query', aiController.generateQuery);

export default router;
