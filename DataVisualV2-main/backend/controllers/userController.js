import { User } from '../models/index.js';

export const getUsers = async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { role, status } = req.body;
        const user = await User.findOneAndUpdate(
            { id: req.params.id },
            { role, status },
            { returnDocument: 'after', projection: '-password' }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const result = await User.findOneAndDelete({ id: req.params.id });
        if (!result) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};
