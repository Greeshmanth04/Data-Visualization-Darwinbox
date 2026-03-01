import mongoose from 'mongoose';
import { User } from '../models/index.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/darwin_visualize';

export const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
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
            avatar: 'https://ui-avatars.com/api/?name=System+Admin&background=3b82f6&color=fff'
        });
        await newAdmin.save();
        console.log('Default Admin Created: admin@gmail.com');
    }
}
