import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config();

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
        await mongoose.connect(process.env.MONGODB_URI);
        const email = 'admin@example.com';
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
                id: 'u_admin',
                name: 'Admin User',
                email,
                password: hashedPassword,
                role: 'ADMIN',
                status: 'active',
                avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=3b82f6&color=fff'
            });
            console.log('Admin created: admin@example.com / admin123');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

createAdmin();
