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

router.get('/relationships', getRelationships);
router.post('/relationships', createRelationship);
router.put('/relationships/:id', updateRelationship);
router.delete('/relationships/:id', deleteRelationship);
router.post('/relationships/:id/execute', executeJoin);
router.post('/relationships/:id/dataset', createMergedDataset);
router.get('/audit', getAuditLog);
router.post('/cross-db-query', executeCrossDbQuery);

export default router;
