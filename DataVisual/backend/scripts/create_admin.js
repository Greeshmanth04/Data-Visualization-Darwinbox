import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/darwin_visualize';

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'ANALYST', 'VIEWER'], default: 'ANALYST' },
    avatar: String,
    status: { type: String, enum: ['active', 'pending', 'rejected'], default: 'pending' }
});

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
    try {
        await mongoose.connect(MONGO_URI);
        const email = 'admin@gmail.com';
        const existing = await User.findOne({ email });

        if (existing) {
            console.log('Admin already exists. Updating status to active...');
            existing.status = 'active';
            await existing.save();
            console.log('Admin updated.');
        } else {
            console.log('Creating new admin...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            await User.create({
                id: 'admin_01',
                name: 'System Admin',
                email,
                password: hashedPassword,
                role: 'ADMIN',
                status: 'active',
                avatar: 'https://ui-avatars.com/api/?name=System+Admin&background=3b82f6&color=fff'
            });
            console.log('Admin created: admin@gmail.com / admin123');
        }
        process.exit(0);
    } catch (e) {
        console.error('Failed to create admin:', e.message);
        process.exit(1);
    }
}

createAdmin();
