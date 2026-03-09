/**
 * Row-Based Access Control (RBAC) helpers.
 * Filters an array of rows according to the dataset's rowPolicies
 * for the requesting user's role.
 *
 * ADMIN users always bypass row filtering (they see all rows).
 * If no policies are defined for a role, all rows are returned (permissive default).
 */

/**
 * Evaluate a single row against one RowPolicy.
 * @param {object} row  - one data row
 * @param {object} policy - { column, operator, value }
 * @returns {boolean}
 */
const evalPolicy = (row, policy) => {
    const { column, operator, value: policyValue } = policy;
    const cellValue = row[column];

    // Helper to normalize values for comparison
    const normalize = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'boolean') return val;
        // If policy value is numeric, try to treat cell as number
        if (typeof policyValue === 'number' && !isNaN(Number(val))) return Number(val);
        // If policy value is boolean-ish and cell is boolean-ish
        if (typeof policyValue === 'boolean') {
            if (typeof val === 'string') {
                if (val.toLowerCase() === 'true') return true;
                if (val.toLowerCase() === 'false') return false;
            }
        }
        return String(val).toLowerCase();
    };

    const cell = normalize(cellValue);
    const target = typeof policyValue === 'string' ? policyValue.toLowerCase() : policyValue;

    switch (operator) {
        case 'eq': return cell === target;
        case 'neq': return cell !== target;
        case 'contains':
            return String(cellValue ?? '').toLowerCase().includes(String(policyValue).toLowerCase());
        case 'gt': return cell > target;
        case 'lt': return cell < target;
        case 'gte': return cell >= target;
        case 'lte': return cell <= target;
        default: return true;
    }
};

/**
 * Filter rows according to rowPolicies for the given role.
 *
 * @param {any[]}    rows        - array of data rows
 * @param {object[]} rowPolicies - Dataset.rowPolicies array from MongoDB
 * @param {string}   role        - caller's role ('ADMIN' | 'ANALYST' | 'VIEWER')
 * @returns {any[]} filtered rows
 */
export const applyRowPolicies = (rows, rowPolicies, role) => {
    // ADMINs always see everything
    if (role === 'ADMIN') return rows;

    if (!Array.isArray(rows) || rows.length === 0) return rows;

    // Gather policies for this role
    const policies = (rowPolicies || []).filter(p => p.role === role);
    if (policies.length === 0) return rows; // permissive default

    return rows.filter(row => {
        // Walk through policies, applying AND/OR logic cumulatively
        // The 'combine' of the FIRST policy is irrelevant (it opens the chain)
        let result = evalPolicy(row, policies[0]);

        for (let i = 1; i < policies.length; i++) {
            const p = policies[i];
            const matched = evalPolicy(row, p);
            if (p.combine === 'OR') {
                result = result || matched;
            } else {
                result = result && matched; // AND (default)
            }
        }

        return result;
    });
};
