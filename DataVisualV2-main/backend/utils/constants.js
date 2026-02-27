
const UserRole = {
    ADMIN: 'ADMIN',
    ANALYST: 'ANALYST',
    VIEWER: 'VIEWER'
};

export const MOCK_USERS = [
    { id: '1', name: 'Alex Admin', role: UserRole.ADMIN, avatar: 'https://picsum.photos/id/1005/100/100', email: 'alex@lumina.com', status: 'active' },
    { id: '2', name: 'Sarah Analyst', role: UserRole.ANALYST, avatar: 'https://picsum.photos/id/1011/100/100', email: 'sarah@lumina.com', status: 'active' },
    { id: '3', name: 'Victor Viewer', role: UserRole.VIEWER, avatar: 'https://picsum.photos/id/1012/100/100', email: 'victor@lumina.com', status: 'active' },
];

export const SALES_DATA = {
    id: 'sales_2024',
    name: 'Global Sales 2024',
    description: 'Consolidated sales data across all regions for the fiscal year 2024.',
    columns: [
        { name: 'date', type: 'date', description: 'Transaction date' },
        { name: 'region', type: 'string', description: 'Sales region (NA, EMEA, APAC)' },
        { name: 'product', type: 'string', description: 'Product category' },
        { name: 'revenue', type: 'number', description: 'Total revenue in USD' },
        { name: 'units', type: 'number', description: 'Units sold' },
    ],
    data: [
        { date: '2024-01-01', region: 'NA', product: 'Electronics', revenue: 15000, units: 120 },
        { date: '2024-01-02', region: 'NA', product: 'Clothing', revenue: 8000, units: 400 },
        { date: '2024-01-03', region: 'EMEA', product: 'Electronics', revenue: 12000, units: 90 },
        { date: '2024-01-04', region: 'APAC', product: 'Home', revenue: 5000, units: 200 },
        { date: '2024-01-05', region: 'NA', product: 'Electronics', revenue: 18000, units: 150 },
        { date: '2024-01-06', region: 'EMEA', product: 'Clothing', revenue: 9500, units: 450 },
        { date: '2024-01-07', region: 'APAC', product: 'Electronics', revenue: 11000, units: 100 },
        { date: '2024-02-01', region: 'NA', product: 'Home', revenue: 6000, units: 210 },
        { date: '2024-02-05', region: 'EMEA', product: 'Electronics', revenue: 14000, units: 110 },
        { date: '2024-02-10', region: 'APAC', product: 'Clothing', revenue: 7200, units: 350 },
        { date: '2024-03-01', region: 'NA', product: 'Electronics', revenue: 22000, units: 180 },
        { date: '2024-03-05', region: 'EMEA', product: 'Home', revenue: 6500, units: 230 },
    ],
    accessPolicies: [
        { role: UserRole.ADMIN, canView: true, canEdit: true, restrictedColumns: [] },
        { role: UserRole.ANALYST, canView: true, canEdit: false, restrictedColumns: [] },
        { role: UserRole.VIEWER, canView: true, canEdit: false, restrictedColumns: ['revenue', 'units'] },
    ]
};

export const USERS_DATA = {
    id: 'app_users',
    name: 'Application Users',
    description: 'Registered users and their activity metrics.',
    columns: [
        { name: 'user_id', type: 'string', description: 'Unique user identifier' },
        { name: 'join_date', type: 'date', description: 'Date of registration' },
        { name: 'last_active', type: 'date', description: 'Last login timestamp' },
        { name: 'subscription_tier', type: 'string', description: 'Free, Pro, or Enterprise' },
    ],
    data: [
        { user_id: 'u_001', join_date: '2023-11-01', last_active: '2024-03-10', subscription_tier: 'Pro' },
        { user_id: 'u_002', join_date: '2023-12-15', last_active: '2024-03-11', subscription_tier: 'Free' },
        { user_id: 'u_003', join_date: '2024-01-20', last_active: '2024-03-09', subscription_tier: 'Enterprise' },
        { user_id: 'u_004', join_date: '2024-02-05', last_active: '2024-03-12', subscription_tier: 'Pro' },
    ],
    accessPolicies: [
        { role: UserRole.ADMIN, canView: true, canEdit: true, restrictedColumns: [] },
        { role: UserRole.ANALYST, canView: true, canEdit: false, restrictedColumns: ['subscription_tier'] },
        { role: UserRole.VIEWER, canView: false, canEdit: false, restrictedColumns: [] },
    ]
};

export const INITIAL_DASHBOARDS = [
    {
        id: 'dash_001',
        name: 'Executive Overview',
        description: 'High-level business metrics for Q1 2024.',
        ownerId: 'admin_01',
        widgets: [
            { id: 'w_1', title: 'Total Revenue', type: 'metric', datasetId: 'sales_2024', config: { dataKey: 'revenue' }, w: 3, h: 1 },
            { id: 'w_2', title: 'Total Units Sold', type: 'metric', datasetId: 'sales_2024', config: { dataKey: 'units' }, w: 3, h: 1 },
            { id: 'w_3', title: 'Revenue Trend', type: 'line', datasetId: 'sales_2024', config: { xAxis: 'date', dataKey: 'revenue', color: '#3b82f6' }, w: 6, h: 2 },
            { id: 'w_4', title: 'Revenue by Region', type: 'pie', datasetId: 'sales_2024', config: { dataKey: 'revenue', xAxis: 'region' }, w: 4, h: 2 },
            { id: 'w_5', title: 'Sales by Product', type: 'bar', datasetId: 'sales_2024', config: { xAxis: 'product', dataKey: 'revenue', color: '#10b981' }, w: 4, h: 2 },
        ]
    }
];

export const SAMPLE_QUERIES = [
    "SELECT * FROM sales_2024 WHERE region = 'NA'",
    "SELECT product, SUM(revenue) FROM sales_2024 GROUP BY product",
    "SELECT date, revenue FROM sales_2024 ORDER BY date DESC LIMIT 5"
];
