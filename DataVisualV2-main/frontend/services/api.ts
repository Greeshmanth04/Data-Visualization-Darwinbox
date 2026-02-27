import { User, Dataset, Dashboard, UserRole } from '../types';
import { SALES_DATA, USERS_DATA, INITIAL_DASHBOARDS } from '../constants';

const API_URL = 'http://localhost:5000/api';

// --- Token Management ---
const TOKEN_KEY = 'lumina_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Helper to fetch from backend with fallback to mock data implementation.
 * Automatically attaches JWT Authorization header if a token exists.
 */
async function request<T>(path: string, options?: RequestInit, mockFn?: () => Promise<T>): Promise<T> {
    try {
        const token = getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.headers as Record<string, string> || {})
        };

        // Attach JWT token if available (skip for FormData requests where Content-Type is auto-set)
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // If the caller explicitly set headers to {} (e.g., for FormData), don't override Content-Type
        const callerHeaders = options?.headers as Record<string, string> | undefined;
        if (callerHeaders && Object.keys(callerHeaders).length === 0) {
            delete headers['Content-Type'];
        }

        const res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers
        });

        // Handle 401 — auto-logout
        if (res.status === 401) {
            removeToken();
            localStorage.removeItem('lumina_session');
            window.location.reload();
            throw new Error('Session expired. Please login again.');
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'API Error');
        }
        return await res.json();
    } catch (error: any) {
        // If it's our own thrown error (like 401), re-throw it
        if (error.message === 'Session expired. Please login again.') {
            throw error;
        }
        console.warn(`Backend unreachable (${path}). Using fallback mock data.`);
        if (mockFn) {
            // Simulate network delay for realism in mock mode
            await new Promise(r => setTimeout(r, 400));
            return mockFn();
        }
        throw error;
    }
}

// --- MOCK IMPLEMENTATIONS (Fallback) ---

const getStoredUsers = () => JSON.parse(localStorage.getItem('lumina_users') || '[]');
const setStoredUsers = (users: any[]) => localStorage.setItem('lumina_users', JSON.stringify(users));

export const api = {
    // --- Auth ---
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

            // Store the JWT token
            if (response.token) {
                setToken(response.token);
            }
            // Store user in session
            localStorage.setItem('lumina_session', JSON.stringify(response.user));
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
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`
            };
            setStoredUsers([...users, newUser]);
            return { message: 'Success' };
        }),

        me: () => request<User>('/auth/me', {}, async () => {
            // Mock mode: restore from localStorage
            const session = localStorage.getItem('lumina_session');
            if (session) return JSON.parse(session);
            throw new Error('No session');
        })
    },

    // --- Users ---
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

    // --- Datasets ---
    datasets: {
        getAll: () => request('/datasets', {}, async () => {
            // Return memory constants if not modified in session
            const stored = localStorage.getItem('lumina_datasets');
            return stored ? JSON.parse(stored) : [SALES_DATA, USERS_DATA];
        }),

        update: (dataset: Dataset) => request(`/datasets/${dataset.id}`, {
            method: 'PUT',
            body: JSON.stringify(dataset)
        }, async () => {
            const stored = localStorage.getItem('lumina_datasets');
            const current = stored ? JSON.parse(stored) : [SALES_DATA, USERS_DATA];
            const updated = current.map((d: Dataset) => d.id === dataset.id ? dataset : d);
            localStorage.setItem('lumina_datasets', JSON.stringify(updated));
            return dataset;
        }),

        delete: (id: string) => request(`/datasets/${id}`, { method: 'DELETE' }, async () => {
            const stored = localStorage.getItem('lumina_datasets');
            const current = stored ? JSON.parse(stored) : [SALES_DATA, USERS_DATA];
            const updated = current.filter((d: Dataset) => d.id !== id);
            localStorage.setItem('lumina_datasets', JSON.stringify(updated));
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

        connectMongoDB: (uri: string) => request<{ collections: string[] }>('/datasource/mongodb/connect', { method: 'POST', body: JSON.stringify({ uri }) }),
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
        })
    },

    // --- Dashboards ---
    dashboards: {
        getAll: (userId: string) => request(`/dashboards?userId=${userId}`, {}, async () => {
            const stored = localStorage.getItem('lumina_dashboards');
            const allDashboards: any[] = stored ? JSON.parse(stored) : INITIAL_DASHBOARDS;
            return allDashboards.filter((d: any) => {
                const ownerId = d.ownerId || 'admin_01'; // Fallback for legacy
                return ownerId === userId || (d.sharedWith && d.sharedWith.some((s: any) => s.userId === userId));
            });
        }),

        create: (userId: string, dashboard: Partial<Dashboard>) => request('/dashboards', {
            method: 'POST',
            body: JSON.stringify({ ...dashboard, userId })
        }, async () => {
            const stored = localStorage.getItem('lumina_dashboards');
            const current = stored ? JSON.parse(stored) : INITIAL_DASHBOARDS;
            const newDash = { ...dashboard, id: dashboard.id || `db_${Date.now()}`, ownerId: userId } as Dashboard;
            const updated = [...current, newDash];
            localStorage.setItem('lumina_dashboards', JSON.stringify(updated));
            return newDash;
        }),

        update: (userId: string, dashboard: Dashboard) => request(`/dashboards/${dashboard.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...dashboard, userId })
        }, async () => {
            const stored = localStorage.getItem('lumina_dashboards');
            const current = stored ? JSON.parse(stored) : INITIAL_DASHBOARDS;

            const existing = current.find((d: any) => d.id === dashboard.id);
            if (!existing) throw new Error("Dashboard not found");

            const isOwner = existing.ownerId === userId;
            const sharedEntry = existing.sharedWith?.find((s: any) => s.userId === userId);
            const canEdit = isOwner || (sharedEntry && sharedEntry.accessLevel === 'edit');

            if (!canEdit) throw new Error("Permission denied");

            const updated = current.map((d: Dashboard) => d.id === dashboard.id ? { ...dashboard, ownerId: existing.ownerId } : d);
            localStorage.setItem('lumina_dashboards', JSON.stringify(updated));
            return dashboard;
        }),

        delete: (userId: string, id: string) => request(`/dashboards/${id}?userId=${userId}`, { method: 'DELETE' }, async () => {
            const stored = localStorage.getItem('lumina_dashboards');
            const current = stored ? JSON.parse(stored) : INITIAL_DASHBOARDS;

            const existing = current.find((d: any) => d.id === id);
            if (existing && existing.ownerId !== userId) throw new Error("Only owner can delete");

            const updated = current.filter((d: Dashboard) => d.id !== id);
            localStorage.setItem('lumina_dashboards', JSON.stringify(updated));
            return { message: 'Deleted' };
        }),

        share: (userId: string, dashboardId: string, targetEmail: string, accessLevel: 'view' | 'edit') => request<Dashboard>(`/dashboards/${dashboardId}/share`, {
            method: 'POST',
            body: JSON.stringify({ userId, targetEmail, accessLevel })
        }, async () => {
            // Mock share
            const usersStored = localStorage.getItem('lumina_users');
            const users = usersStored ? JSON.parse(usersStored) : [];
            const targetUser = users.find((u: any) => u.email.toLowerCase() === targetEmail.toLowerCase());
            if (!targetUser) throw new Error("User not found");

            const stored = localStorage.getItem('lumina_dashboards');
            const current = stored ? JSON.parse(stored) : INITIAL_DASHBOARDS;
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

            localStorage.setItem('lumina_dashboards', JSON.stringify(current));
            return dash;
        })
    }
};