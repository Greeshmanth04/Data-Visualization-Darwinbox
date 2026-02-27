import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authMiddleware from './middleware/authMiddleware.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
import datasourceRoutes from './routes/datasourceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import exportRoutes from './routes/exportRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
connectDB();

// Routes
// Auth routes are PUBLIC (login & register don't need a token)
app.use('/api/auth', authRoutes);

// All other routes are PROTECTED by JWT middleware
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/datasets', authMiddleware, datasetRoutes);
app.use('/api/datasource', authMiddleware, datasourceRoutes);
app.use('/api/dashboards', authMiddleware, dashboardRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/export', authMiddleware, exportRoutes);

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});