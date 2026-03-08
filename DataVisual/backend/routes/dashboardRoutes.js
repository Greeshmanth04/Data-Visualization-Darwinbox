import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/', dashboardController.getDashboards);
router.post('/', dashboardController.createDashboard);
router.get('/:id', dashboardController.getDashboardById);
router.put('/:id', dashboardController.updateDashboard);
router.delete('/:id', dashboardController.deleteDashboard);
router.post('/:id/share', dashboardController.shareDashboard);

export default router;
