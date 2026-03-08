import express from 'express';
import { testConnection, createConnection, getConnections, deleteConnection, queryConnection, refreshConnectionSchema } from '../controllers/connectionController.js';

const router = express.Router();

router.post('/test', testConnection);
router.post('/', createConnection);
router.get('/', getConnections);
router.delete('/:id', deleteConnection);
router.post('/:id/query', queryConnection);
router.post('/:id/refresh', refreshConnectionSchema);

export default router;
