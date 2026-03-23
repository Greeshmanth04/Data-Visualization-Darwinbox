import { describe, test, expect } from '@jest/globals';
import { applyRowPolicies } from '../middleware/rbacMiddleware.js';

describe('RBAC Middleware - Row Policies', () => {
    const data = [
        { id: 1, department: 'Sales', revenue: 50000, is_active: true },
        { id: 2, department: 'Engineering', revenue: 10000, is_active: true },
        { id: 3, department: 'Sales', revenue: 2000, is_active: false },
        { id: 4, department: 'Marketing', revenue: 0, is_active: false }
    ];

    test('ADMIN role bypasses all policies and sees all data', () => {
        const policies = [{ role: 'ADMIN', column: 'department', operator: 'eq', value: 'None' }];
        const result = applyRowPolicies(data, policies, 'ADMIN');
        expect(result).toHaveLength(4);
    });

    test('bypasses if no policies exist for the role', () => {
        const policies = [{ role: 'VIEWER', column: 'department', operator: 'eq', value: 'Sales' }];
        const result = applyRowPolicies(data, policies, 'ANALYST');
        expect(result).toHaveLength(4); // Permissive default
    });

    test('eq (Equals) operator', () => {
        const policies = [{ role: 'VIEWER', column: 'department', operator: 'eq', value: 'Sales' }];
        const result = applyRowPolicies(data, policies, 'VIEWER');
        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual([1, 3]);
    });

    test('neq (Not Equals) operator', () => {
        const policies = [{ role: 'VIEWER', column: 'department', operator: 'neq', value: 'Sales' }];
        const result = applyRowPolicies(data, policies, 'VIEWER');
        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual([2, 4]);
    });

    test('gt/lt (Greater/Less Than) operators', () => {
        const policies = [{ role: 'ANALYST', column: 'revenue', operator: 'gt', value: 5000 }];
        const result = applyRowPolicies(data, policies, 'ANALYST');
        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual([1, 2]);
    });

    test('boolean comparisons', () => {
        const policies = [{ role: 'VIEWER', column: 'is_active', operator: 'eq', value: true }];
        const result = applyRowPolicies(data, policies, 'VIEWER');
        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual([1, 2]);
    });

    test('multiple policies with AND (implied)', () => {
        const policies = [
            { role: 'VIEWER', column: 'department', operator: 'eq', value: 'Sales' },
            { role: 'VIEWER', column: 'is_active', operator: 'eq', value: true }
        ];
        const result = applyRowPolicies(data, policies, 'VIEWER');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });

    test('multiple policies with explicit OR', () => {
        const policies = [
            { role: 'VIEWER', column: 'department', operator: 'eq', value: 'Engineering' },
            { role: 'VIEWER', column: 'revenue', operator: 'gt', value: 10000, combine: 'OR' }
        ];
        const result = applyRowPolicies(data, policies, 'VIEWER');
        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual([1, 2]);
    });
});
