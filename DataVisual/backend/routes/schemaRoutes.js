import express from 'express';
import {
    getRelationships,
    createRelationship,
    updateRelationship,
    deleteRelationship,
    getAuditLog,
    executeJoin,
    createMergedDataset,
    executeCrossDbQuery
} from '../controllers/schemaController.js';

const router = express.Router();

// Cross-DB relationships
router.get('/relationships', getRelationships);
router.post('/relationships', createRelationship);
router.put('/relationships/:id', updateRelationship);
router.delete('/relationships/:id', deleteRelationship);

// Execute join + create merged dataset
router.post('/relationships/:id/execute', executeJoin);
router.post('/relationships/:id/dataset', createMergedDataset);

// Audit log
router.get('/audit', getAuditLog);

// Cross-DB SQL query
router.post('/cross-db-query', executeCrossDbQuery);

export default router;
