import { User, Dataset, Dashboard, UserRole, CrossDBRelationship, DatabaseConnection } from '../types';

const API_URL = '/api';
const TOKEN_KEY = 'darwin_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, options?: RequestInit, mockFn?: () => Promise<T>): Promise<T> {
    // Track whether the error came from an HTTP response (vs a network-level failure)
    let isNetworkError = true;
    try {
        const token = getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.headers as Record<string, string> || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const callerHeaders = options?.headers as Record<string, string> | undefined;
        if (callerHeaders && Object.keys(callerHeaders).length === 0) {
            delete headers['Content-Type'];
        }

        const res = await fetch(`${API_URL}${path}`, { ...options, headers });

        // Once we have a response the network is reachable
        isNetworkError = false;

        // Handle 401 — auto-logout
        if (res.status === 401) {
            removeToken();
            localStorage.removeItem('darwin_session');
            window.location.reload();
            throw new Error('Session expired. Please login again.');
        }

        // Safe JSON parse — handles empty bodies (204, truncated, etc.)
        const safeJson = async (): Promise<any> => {
            const text = await res.text();
            if (!text || !text.trim()) return null;
            try { return JSON.parse(text); } catch { return { message: text }; }
        };

        if (!res.ok) {
            const body = await safeJson();
            throw new Error((body && body.message) ? body.message : `Server error ${res.status}`);
        }

        const body = await safeJson();
        return body as T;
    } catch (error: any) {
        // Re-throw HTTP errors (server was reachable, so no mock fallback)
        if (!isNetworkError) throw error;

        // Only network-level failures fall back to mock data
        console.warn(`Backend unreachable (${path}). Using fallback mock data.`);
        if (mockFn) {
            await new Promise(r => setTimeout(r, 400));
            return mockFn();
        }
        throw error;
    }
}

const getStoredUsers = () => JSON.parse(localStorage.getItem('darwin_users') || '[]');
const setStoredUsers = (users: any[]) => localStorage.setItem('darwin_users', JSON.stringify(users));

export const api = {
    auth: {
        login: async (email: string, password: string) => {
            const response = await request<any>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            }, async () => {
                const users = getStoredUsers();
                const user = users.find((u: any) => u.email === email && u.password === password);
                if (!user) throw new Error("Invalid email or password");
                if (user.status === 'pending') throw new Error("Account pending approval");
                if (user.status === 'rejected') throw new Error("Account disabled");
                const { password: _, ...safeUser } = user;
                // Mock mode: no real token, just return user
                return { token: 'mock_token', user: safeUser };
            });

            if (response.token) {
                setToken(response.token);
            }
            localStorage.setItem('darwin_session', JSON.stringify(response.user));
            return response.user;
        },

        register: (name: string, email: string, password: string) => request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        }, async () => {
            const users = getStoredUsers();
            if (users.find((u: any) => u.email === email)) throw new Error("User already exists");
            const newUser = {
                id: `u_${Date.now()}`,
                name, email, password,
                role: UserRole.ANALYST,
                status: 'pending',
            };
            setStoredUsers([...users, newUser]);
            return { message: 'Success' };
        }),

        me: () => request<User>('/auth/me', {}, async () => {
            // Mock mode: restore from localStorage
            const session = localStorage.getItem('darwin_session');
            if (session) return JSON.parse(session);
            throw new Error('No session');
        })
    },

    users: {
        getAll: () => request('/users', {}, async () => {
            const users = getStoredUsers();
            return users.map((u: any) => {
                const { password, ...safe } = u;
                return safe;
            });
        }),

        update: (id: string, updates: Partial<User>) => request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, async () => {
            const users = getStoredUsers();
            const updated = users.map((u: any) => u.id === id ? { ...u, ...updates } : u);
            setStoredUsers(updated);
            return updated.find((u: any) => u.id === id);
        }),

        delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }, async () => {
            const users = getStoredUsers();
            setStoredUsers(users.filter((u: any) => u.id !== id));
            return { message: 'Deleted' };
        })
    },

    datasets: {
        getAll: () => request('/datasets', {}, async () => {
            const stored = localStorage.getItem('darwin_datasets');
            return stored ? JSON.parse(stored) : [];
        }),

        update: (dataset: Dataset) => request(`/datasets/${dataset.id}`, {
            method: 'PUT',
            body: JSON.stringify(dataset)
        }, async () => {
            const stored = localStorage.getItem('darwin_datasets');
            const current = stored ? JSON.parse(stored) : [];
            const updated = current.map((d: Dataset) => d.id === dataset.id ? dataset : d);
            localStorage.setItem('darwin_datasets', JSON.stringify(updated));
            return dataset;
        }),

        delete: (id: string) => request(`/datasets/${id}`, { method: 'DELETE' }, async () => {
            const stored = localStorage.getItem('darwin_datasets');
            const current = stored ? JSON.parse(stored) : [];
            const updated = current.filter((d: Dataset) => d.id !== id);
            localStorage.setItem('darwin_datasets', JSON.stringify(updated));
            return { message: 'Deleted' };
        }),

        upload: (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return request('/datasets/upload', {
                method: 'POST',
                body: formData,
                headers: {} // Let browser set content-type for FormData
            }, async () => {
                throw new Error("Upload not supported in mock mode");
            });
        },

        listMongoDBDatabases: (uri: string) => request<{ databases: string[] }>('/datasource/mongodb/databases', { method: 'POST', body: JSON.stringify({ uri }) }),
        listMongoDBCollections: (uri: string, database: string) => request<{ collections: string[] }>('/datasource/mongodb/collections', { method: 'POST', body: JSON.stringify({ uri, database }) }),
        previewMongoDB: (uri: string, database: string, collection: string) => request<{ data: any[] }>('/datasource/mongodb/preview', { method: 'POST', body: JSON.stringify({ uri, database, collection }) }),

        connectSQL: (config: any) => request<{ tables: string[] }>('/datasource/sql/connect', {
            method: 'POST',
            body: JSON.stringify(config)
        }),

        querySQL: (config: any) => request<{ data: any[] }>('/datasource/sql/query', {
            method: 'POST',
            body: JSON.stringify(config)
        }),

        createExternal: (dataset: Partial<Dataset>) => request<Dataset>('/datasets/external', {
            method: 'POST',
            body: JSON.stringify(dataset)
        }),

        createSqlView: (payload: { name: string, description: string, sourceDatasetId: string, query: string, staticData: any[] }) => request<Dataset>('/datasets/sqlview', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

        queryDataset: (datasetId: string, query: string) => request<{ data: any[] }>(`/datasource/dataset/${datasetId}/query`, {
            method: 'POST',
            body: JSON.stringify({ query })
        }),

        updateRowPolicies: (datasetId: string, rowPolicies: import('../types').RowPolicy[]) =>
            request<{ message: string; rowPolicies: import('../types').RowPolicy[] }>(
                `/datasets/${datasetId}/row-policies`,
                { method: 'PATCH', body: JSON.stringify({ rowPolicies }) }
            )
    },

    connections: {
        test: (config: any) => request<{ success: boolean; message: string }>('/connections/test', {
            method: 'POST',
            body: JSON.stringify(config)
        }),
        create: (config: any) => request<any>('/connections', {
            method: 'POST',
            body: JSON.stringify(config)
        }),
        getAll: () => request<any[]>('/connections', { method: 'GET' }),
        delete: (id: string) => request<{ message: string }>(`/connections/${id}`, { method: 'DELETE' }),
        query: (id: string, payload: { table?: string; collection?: string; limit?: number }) =>
            request<{ data: any[]; columns: { name: string; type: string }[] }>(`/connections/${id}/query`, {
                method: 'POST',
                body: JSON.stringify(payload)
            }),
        refresh: (id: string) => request<DatabaseConnection>(`/connections/${id}/refresh`, {
            method: 'POST'
        })
    },

    schema: {
        getRelationships: (connectionId?: string) => {
            const query = connectionId ? `?connectionId=${connectionId}` : '';
            return request<CrossDBRelationship[]>(`/schema/relationships${query}`);
        },
        createRelationship: (rel: Omit<CrossDBRelationship, 'id'>) =>
            request<CrossDBRelationship>('/schema/relationships', {
                method: 'POST',
                body: JSON.stringify(rel)
            }),
        updateRelationship: (id: string, updates: Partial<CrossDBRelationship>) =>
            request<CrossDBRelationship>(`/schema/relationships/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            }),
        deleteRelationship: (id: string) =>
            request<{ message: string }>(`/schema/relationships/${id}`, {
                method: 'DELETE'
            }),
        executeJoin: (id: string, limit = 2000) =>
            request<{
                data: any[];
                columns: { name: string; type: string }[];
                meta: {
                    sourceTable: string; sourceDB: string; sourceType: string;
                    targetTable: string; targetDB: string; targetType: string;
                    joinColumn: string; joinType: string; rowCount: number;
                };
            }>(`/schema/relationships/${id}/execute`, {
                method: 'POST',
                body: JSON.stringify({ limit })
            }),
        createMergedDataset: (id: string, payload: {
            name: string;
            description?: string;
            data: any[];
            columns: { name: string; type: string }[];
        }) => request<any>(`/schema/relationships/${id}/dataset`, {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    },

    dashboards: {
        getAll: (userId: string) => request(`/dashboards?userId=${userId}`, {}, async () => {
            const stored = localStorage.getItem('darwin_dashboards');
            const allDashboards: any[] = stored ? JSON.parse(stored) : [];
            return allDashboards.filter((d: any) => {
                const ownerId = d.ownerId || 'admin_01';
                return ownerId === userId || (d.sharedWith && d.sharedWith.some((s: any) => s.userId === userId));
            });
        }),

        create: (userId: string, dashboard: Partial<Dashboard>) => request('/dashboards', {
            method: 'POST',
            body: JSON.stringify({ ...dashboard, userId })
        }, async () => {
            const stored = localStorage.getItem('darwin_dashboards');
            const current = stored ? JSON.parse(stored) : [];
            const newDash = { ...dashboard, id: dashboard.id || `db_${Date.now()}`, ownerId: userId } as Dashboard;
            const updated = [...current, newDash];
            localStorage.setItem('darwin_dashboards', JSON.stringify(updated));
            return newDash;
        }),

        update: (userId: string, dashboard: Dashboard) => request(`/dashboards/${dashboard.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...dashboard, userId })
        }, async () => {
            const stored = localStorage.getItem('darwin_dashboards');
            const current = stored ? JSON.parse(stored) : [];

            const existing = current.find((d: any) => d.id === dashboard.id);
            if (!existing) throw new Error("Dashboard not found");

            const isOwner = existing.ownerId === userId;
            const sharedEntry = existing.sharedWith?.find((s: any) => s.userId === userId);
            const canEdit = isOwner || (sharedEntry && sharedEntry.accessLevel === 'edit');

            if (!canEdit) throw new Error("Permission denied");

            const updated = current.map((d: Dashboard) => d.id === dashboard.id ? { ...dashboard, ownerId: existing.ownerId } : d);
            localStorage.setItem('darwin_dashboards', JSON.stringify(updated));
            return dashboard;
        }),

        delete: (userId: string, id: string) => request(`/dashboards/${id}?userId=${userId}`, { method: 'DELETE' }, async () => {
            const stored = localStorage.getItem('darwin_dashboards');
            const current = stored ? JSON.parse(stored) : [];

            const existing = current.find((d: any) => d.id === id);
            if (existing && existing.ownerId !== userId) throw new Error("Only owner can delete");

            const updated = current.filter((d: Dashboard) => d.id !== id);
            localStorage.setItem('darwin_dashboards', JSON.stringify(updated));
            return { message: 'Deleted' };
        }),

        share: (userId: string, dashboardId: string, targetEmail: string, accessLevel: 'view' | 'edit') => request<Dashboard>(`/dashboards/${dashboardId}/share`, {
            method: 'POST',
            body: JSON.stringify({ userId, targetEmail, accessLevel })
        }, async () => {
            // Mock share
            const usersStored = localStorage.getItem('darwin_users');
            const users = usersStored ? JSON.parse(usersStored) : [];
            const targetUser = users.find((u: any) => u.email.toLowerCase() === targetEmail.toLowerCase());
            if (!targetUser) throw new Error("User not found");

            const stored = localStorage.getItem('darwin_dashboards');
            const current = stored ? JSON.parse(stored) : [];
            const dash = current.find((d: any) => d.id === dashboardId);
            if (!dash) throw new Error("Dashboard not found");
            const dashOwnerId = dash.ownerId || 'admin_01';
            if (dashOwnerId !== userId) throw new Error("Only owner can share");

            if (!dash.sharedWith) dash.sharedWith = [];
            const existingIndex = dash.sharedWith.findIndex((s: any) => s.userId === targetUser.id);
            if (existingIndex > -1) {
                dash.sharedWith[existingIndex].accessLevel = accessLevel;
            } else {
                dash.sharedWith.push({ userId: targetUser.id, accessLevel });
            }

            localStorage.setItem('darwin_dashboards', JSON.stringify(current));
            return dash;
        })
    },

    cache: {
        store: (payload: {
            sourceType: 'mongodb' | 'mysql' | 'postgres';
            uri: string;
            table?: string;
            collection?: string;
            database?: string;
            limit?: number;
            ttl?: number;
        }) => request<any>('/cache/datasource', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

        list: () => request<Array<{
            key: string;
            sourceType: string;
            sourceName: string;
            rowCount: number;
            columns: Array<{ name: string; type: string; description: string }>;
            ttl: number;
        }>>('/cache/list'),

        getData: (cacheKey: string) => request<{
            rows: any[];
            columns: Array<{ name: string; type: string; description: string }>;
            sourceType: string;
            sourceName: string;
        }>(`/cache/data?key=${btoa(cacheKey)}`),

        clear: (cacheKey: string) => request<{ message: string; key: string }>(
            `/cache/entry?key=${btoa(cacheKey)}`,
            { method: 'DELETE' }
        ),

        createDashboard: (payload: {
            cacheKey: string;
            name: string;
            description?: string;
            userId: string;
        }) => request<any>('/cache/dashboard', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
        storeRaw: (payload: {
            name: string;
            rows: any[];
            columns: any[];
            sourceType?: string;
            ttl?: number;
        }) => request<any>('/cache/raw', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
    }
};