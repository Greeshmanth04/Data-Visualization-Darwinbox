import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';
import { connectTestDB, clearTestDB, closeTestDB } from './integrationSetup.js';
import { User } from '../models/index.js';

// Suppress console.log/error during tests for cleaner output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
    await connectTestDB();
});

beforeEach(async () => {
    await clearTestDB();
});

afterAll(async () => {
    await closeTestDB();
});

describe('Auth API /api/auth', () => {

    const validUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'ANALYST'
    };

    describe('POST /register', () => {
        test('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(validUser);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('message', 'Registration successful');
        });

        test('should return 400 if user already exists', async () => {
            await request(app).post('/api/auth/register').send(validUser);
            
            const res = await request(app)
                .post('/api/auth/register')
                .send(validUser);

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('message', 'User already exists');
        });
    });

    describe('POST /login', () => {
        beforeEach(async () => {
            // Register user before login tests
            await request(app).post('/api/auth/register').send(validUser);
            // Manually activate the user since registration leaves them 'pending'
            await User.updateOne({ email: validUser.email }, { status: 'active' });
        });

        test('should login user with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: validUser.email,
                    password: validUser.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.email).toBe(validUser.email);
            expect(res.body.user).not.toHaveProperty('password');
        });

        test('should return 401 for invalid email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'wrong@example.com',
                    password: validUser.password
                });

            expect(res.statusCode).toBe(401);
            expect(res.body).toHaveProperty('message', 'Invalid credentials');
        });

        test('should return 401 for invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: validUser.email,
                    password: 'WrongPassword!'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body).toHaveProperty('message', 'Invalid credentials');
        });

        test('should return 400 if fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: validUser.email
                });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('message', 'Email and password are required');
        });
    });

});
