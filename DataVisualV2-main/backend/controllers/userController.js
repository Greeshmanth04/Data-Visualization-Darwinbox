import { User } from '../models/index.js';

export const getUsers = async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
};

export const updateUser = async (req, res) => {
    const { role, status } = req.body;
    const user = await User.findOneAndUpdate({ id: req.params.id }, { role, status }, { returnDocument: 'after' });
    res.json(user);
};

export const deleteUser = async (req, res) => {
    await User.findOneAndDelete({ id: req.params.id });
    res.json({ message: 'Deleted' });
};
