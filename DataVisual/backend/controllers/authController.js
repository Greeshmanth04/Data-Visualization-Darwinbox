import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const generateToken = (user) => {
    return jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        if (user.status === 'pending') return res.status(403).json({ message: 'Account pending approval' });
        if (user.status === 'rejected') return res.status(403).json({ message: 'Account disabled' });

        const token = generateToken(user);
        const { password: _, ...safeUser } = user.toObject();
        res.json({ token, user: safeUser });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'User already exists' });

        await User.create({
            id: `u_${Date.now()}`,
            name,
            email,
            password, // Will be hashed by pre-save hook
            role: 'ANALYST',
            status: 'pending',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`
        });
        res.status(201).json({ message: 'Registration successful' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export const me = async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.userId }, '-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};
