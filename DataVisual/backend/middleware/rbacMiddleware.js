const evalPolicy = (row, policy) => {
    const { column, operator, value: policyValue } = policy;
    const cellValue = row[column];

    const normalize = (val) => {
        if (val === null || val === undefined) {
            return '';
        }
        if (typeof val === 'boolean') {
            return val;
        }
        if (typeof policyValue === 'number' && !isNaN(Number(val))) {
            return Number(val);
        }
        if (typeof policyValue === 'boolean') {
            if (typeof val === 'string') {
                if (val.toLowerCase() === 'true') {
                    return true;
                }
                if (val.toLowerCase() === 'false') {
                    return false;
                }
            }
        }
        return String(val).toLowerCase();
    };

    const cell = normalize(cellValue);
    const target = typeof policyValue === 'string' ? policyValue.toLowerCase() : policyValue;

    switch (operator) {
        case 'eq':
            return cell === target;
        case 'neq':
            return cell !== target;
        case 'contains':
            return String(cellValue ?? '').toLowerCase().includes(String(policyValue).toLowerCase());
        case 'gt':
            return cell > target;
        case 'lt':
            return cell < target;
        case 'gte':
            return cell >= target;
        case 'lte':
            return cell <= target;
        default:
            return true;
    }
};

export const applyRowPolicies = (rows, rowPolicies, role) => {
    if (role === 'ADMIN') {
        return rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        return rows;
    }

    const policies = (rowPolicies || []).filter(p => p.role === role);
    if (policies.length === 0) {
        return rows; 
    }

    return rows.filter(row => {
        let result = evalPolicy(row, policies[0]);

        for (let i = 1; i < policies.length; i++) {
            const p = policies[i];
            const matched = evalPolicy(row, p);
            if (p.combine === 'OR') {
                result = result || matched;
            } else {
                result = result && matched; 
            }
        }

        return result;
    });
};
