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
    const { column, operator, value } = policy;
    const cellRaw = row[column];

    // Cast for numeric comparisons
    const cell = typeof value === 'number' ? Number(cellRaw) : cellRaw;

    switch (operator) {
        case 'eq': return cell == value;                                        // loose equality handles string/number mix
        case 'neq': return cell != value;
        case 'contains': return String(cellRaw ?? '').toLowerCase().includes(String(value).toLowerCase());
        case 'gt': return cell > value;
        case 'lt': return cell < value;
        case 'gte': return cell >= value;
        case 'lte': return cell <= value;
        default: return true; // unknown operator → permissive
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
