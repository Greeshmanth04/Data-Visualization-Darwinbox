import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';
import { connectTestDB, clearTestDB, closeTestDB } from './integrationSetup.js';
import { User, Dashboard } from '../models/index.js';
import jwt from 'jsonwebtoken';

// Suppress logs
// (Unsilenced logs for debugging)
let token;
let user;
let authHeader;

beforeAll(async () => {
    await connectTestDB();
    
    // Setup a test user and generate a real JWT token for authMiddleware
    user = await User.create({
        id: 'u_dashboard_tester',
        name: 'Dashboard Tester',
        email: 'dash_test@example.com',
        password: 'Password123!',
        role: 'ANALYST',
        status: 'active'
    });

    token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET || 'test_jwt_secret',
        { expiresIn: '1h' }
    );
    authHeader = `Bearer ${token}`;
});

beforeEach(async () => {
    // Clear dashboards before each test, but keep the user
    await Dashboard.deleteMany({});
});

afterAll(async () => {
    await clearTestDB();
    await closeTestDB();
});

describe('Dashboard API /api/dashboards', () => {

    test('should create a new dashboard', async () => {
        const payload = {
            userId: user.id,
            id: 'd_123',
            name: 'My New Dashboard',
            description: 'Test description',
            w: 12,
            h: 10
        };

        const res = await request(app)
            .post('/api/dashboards')
            .set('Authorization', authHeader)
            .send(payload);

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe('My New Dashboard');
        expect(res.body.ownerId).toBe(user.id);
    });

    test('should block creation if userId is missing', async () => {
        const res = await request(app)
            .post('/api/dashboards')
            .set('Authorization', authHeader)
            .send({ name: 'Invalid' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('User ID required');
    });

    test('should get dashboards for a user', async () => {
        await Dashboard.create({ id: 'd_1', name: 'Dash 1', ownerId: user.id });
        await Dashboard.create({ id: 'd_2', name: 'Dash 2', ownerId: user.id });
        await Dashboard.create({ id: 'd_3', name: 'Other Dash', ownerId: 'other_user' });

        const res = await request(app)
            .get(`/api/dashboards?userId=${user.id}`)
            .set('Authorization', authHeader);

        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body.map(d => d.name)).toContain('Dash 1');
    });

    test('should delete a dashboard if owned by user', async () => {
        await Dashboard.create({ id: 'd_to_delete', name: 'Delete me', ownerId: user.id });

        const res = await request(app)
            .delete('/api/dashboards/d_to_delete?userId=' + user.id)
            .set('Authorization', authHeader);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Deleted');

        const verify = await Dashboard.findOne({ id: 'd_to_delete' });
        expect(verify).toBeNull();
    });

    test('should forbid deleting a dashboard owned by someone else', async () => {
        await Dashboard.create({ id: 'd_forbidden', name: 'Not yours', ownerId: 'other_user' });

        const res = await request(app)
            .delete('/api/dashboards/d_forbidden?userId=' + user.id)
            .set('Authorization', authHeader);

        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe('Only owner can delete');
    });
});
