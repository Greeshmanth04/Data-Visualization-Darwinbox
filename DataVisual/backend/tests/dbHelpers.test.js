import { describe, test, expect } from '@jest/globals';
import {
    stripSslMode,
    inferType,
    buildColumns,
    dbNameFromUri
} from '../utils/dbHelpers.js';

describe('Database Helpers', () => {
    describe('stripSslMode', () => {
        test('removes sslmode parameter from postgres uris', () => {
            expect(stripSslMode('postgres://user:pass@host:5432/db?sslmode=require')).toBe('postgres://user:pass@host:5432/db');
            expect(stripSslMode('postgres://user:pass@host:5432/db?sslmode=disable&other=true')).toBe('postgres://user:pass@host:5432/db?other=true');
        });

        test('returns original string if no sslmode', () => {
            expect(stripSslMode('postgres://localhost/db')).toBe('postgres://localhost/db');
            expect(stripSslMode(null)).toBe(null);
        });
    });

    describe('inferType', () => {
        test('infers numbers', () => {
            expect(inferType(42)).toBe('number');
            expect(inferType(3.14)).toBe('number');
        });

        test('infers booleans', () => {
            expect(inferType(true)).toBe('boolean');
            expect(inferType(false)).toBe('boolean');
        });

        test('defaults to string for everything else', () => {
            expect(inferType('hello')).toBe('string');
            expect(inferType(null)).toBe('string');
            expect(inferType({})).toBe('string');
            expect(inferType([])).toBe('string');
        });
    });

    describe('buildColumns', () => {
        test('returns empty array for falsy input', () => {
            expect(buildColumns(null)).toEqual([]);
            expect(buildColumns(undefined)).toEqual([]);
        });

        test('builds schema definition from a data row', () => {
            const row = {
                id: 1,
                user_name: 'Alice',
                is_active: true
            };

            const columns = buildColumns(row);
            
            expect(columns).toHaveLength(3);
            
            expect(columns[0]).toEqual({ name: 'id', type: 'number', description: 'Id' });
            expect(columns[1]).toEqual({ name: 'user_name', type: 'string', description: 'User name' });
            expect(columns[2]).toEqual({ name: 'is_active', type: 'boolean', description: 'Is active' });
        });
    });

    describe('dbNameFromUri', () => {
        test('extracts database name from standard URI', () => {
            expect(dbNameFromUri('mongodb://localhost:27017/analytics')).toBe('analytics');
            expect(dbNameFromUri('postgres://user:pass@host/mydb?sslmode=require')).toBe('mydb');
        });

        test('returns "test" for malformed or missing paths', () => {
            expect(dbNameFromUri('mongodb://localhost:27017/')).toBe('test');
            expect(dbNameFromUri('invalid-uri')).toBe('test');
        });
    });
});
