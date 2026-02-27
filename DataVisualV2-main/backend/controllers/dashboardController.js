import { Dashboard, User } from '../models/index.js';
import { getCache, setCache, deleteCache, clearPattern } from '../utils/cacheService.js';

export const getDashboards = async (req, res) => {
    const { userId } = req.query;
    const cacheKey = `dashboards:list:${userId || 'all'}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const query = userId ? { $or: [{ ownerId: userId }, { 'sharedWith.userId': userId }] } : {};
    const dashboards = await Dashboard.find(query);
    await setCache(cacheKey, dashboards, 300);
    res.json(dashboards);
};

export const createDashboard = async (req, res) => {
    const { userId, ...dashboardData } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID required' });
    const newDash = await Dashboard.create({ ...dashboardData, ownerId: userId });
    await clearPattern('dashboards:list:*');
    res.json(newDash);
};

export const updateDashboard = async (req, res) => {
    const { userId, ...updates } = req.body;
    const dashboard = await Dashboard.findOne({ id: req.params.id });
    if (!dashboard) return res.status(404).json({ message: 'Not found' });

    const canEdit = dashboard.ownerId === userId || dashboard.sharedWith.find(s => s.userId === userId && s.accessLevel === 'edit');
    if (!canEdit) return res.status(403).json({ message: 'Permission denied' });

    const updated = await Dashboard.findOneAndUpdate({ id: req.params.id }, updates, { returnDocument: 'after' });
    await clearPattern('dashboards:list:*');
    await deleteCache(`dashboard:${req.params.id}`);
    res.json(updated);
};

export const deleteDashboard = async (req, res) => {
    const { userId } = req.query;
    const dashboard = await Dashboard.findOne({ id: req.params.id });
    if (!dashboard) return res.status(404).json({ message: 'Not found' });
    if (dashboard.ownerId !== userId) return res.status(403).json({ message: 'Only owner can delete' });

    await Dashboard.findOneAndDelete({ id: req.params.id });
    await clearPattern('dashboards:list:*');
    await deleteCache(`dashboard:${req.params.id}`);
    res.json({ message: 'Deleted' });
};

export const shareDashboard = async (req, res) => {
    const { userId, targetEmail, accessLevel } = req.body;
    const trimmedEmail = targetEmail?.trim().toLowerCase();
    try {
        const dashboard = await Dashboard.findOne({ id: req.params.id });
        if (!dashboard) return res.status(404).json({ message: 'Dashboard not found' });
        if (dashboard.ownerId !== userId) return res.status(403).json({ message: 'Only owner can share' });

        const targetUser = await User.findOne({ email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') } });
        if (!targetUser) return res.status(404).json({ message: 'User to share with not found' });

        const targetUserId = targetUser.id || targetUser._id.toString();
        const existingSharedIndex = dashboard.sharedWith.findIndex(s => s.userId === targetUserId);
        if (existingSharedIndex > -1) {
            dashboard.sharedWith[existingSharedIndex].accessLevel = accessLevel;
        } else {
            dashboard.sharedWith.push({ userId: targetUserId, accessLevel });
        }
        await dashboard.save();
        await clearPattern('dashboards:list:*');
        await deleteCache(`dashboard:${req.params.id}`);
        res.json(dashboard);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const getDashboardById = async (req, res) => {
    const cacheKey = `dashboard:${req.params.id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const dashboard = await Dashboard.findOne({ id: req.params.id });
    if (dashboard) await setCache(cacheKey, dashboard, 300);
    res.json(dashboard);
};
