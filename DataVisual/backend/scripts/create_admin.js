import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    password: { type: String, required: true },
    role: String,
    status: String
});

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
    await mongoose.connect(process.env.MONGODB_URI);
    const existing = await User.findOne({ email: 'admin@example.com' });
    if (existing) {
        console.log('Admin already exists');
        process.exit(0);
    }

    // We need to hash the password manually if we don't use the model with hook
    // But I'll just use register endpoint via fetch if I can?
    // Actually, I'll just use the model.
    console.log('Admin not found in DB or script needs to use actual model. Use the actual project model instead.');
    process.exit(1);
}

createAdmin();
