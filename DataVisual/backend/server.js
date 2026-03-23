import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authMiddleware from './middleware/authMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
import datasourceRoutes from './routes/datasourceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import cacheRoutes from './routes/cacheRoutes.js';
import schemaRoutes from './routes/schemaRoutes.js';

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to real DB only when not running tests
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}
// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/datasets', authMiddleware, datasetRoutes);
app.use('/api/datasource', authMiddleware, datasourceRoutes);
app.use('/api/dashboards', authMiddleware, dashboardRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/connections', authMiddleware, connectionRoutes);
app.use('/api/cache', authMiddleware, cacheRoutes);
app.use('/api/schema', authMiddleware, schemaRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err.message);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error'
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;