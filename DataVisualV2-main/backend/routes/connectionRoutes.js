import express from 'express';
import { testConnection, createConnection, getConnections, deleteConnection, queryConnection } from '../controllers/connectionController.js';

const router = express.Router();

router.post('/test', testConnection);
router.post('/', createConnection);
router.get('/', getConnections);
router.delete('/:id', deleteConnection);
router.post('/:id/query', queryConnection);

export default router;
