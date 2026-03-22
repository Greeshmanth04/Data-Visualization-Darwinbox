import mongoose from 'mongoose';
import { User } from '../models/index.js';

export const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected');
        await seedAdmin();
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

async function seedAdmin() {
    const admin = await User.findOne({ email: 'admin@gmail.com' });
    if (!admin) {
        const newAdmin = new User({
            id: 'admin_01',
            name: 'System Admin',
            email: 'admin@gmail.com',
            password: 'admin123',
            role: 'ADMIN',
            status: 'active',
        });
        await newAdmin.save();
        console.log('Default Admin Created: admin@gmail.com');
    }
}
