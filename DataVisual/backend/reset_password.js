import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const User = mongoose.model('User', new mongoose.Schema({
    email: String,
    password: { type: String, required: true }
}));

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash('analyst123', salt);
        await User.updateOne({ email: 'analyst@example.com' }, { password });
        await User.updateOne({ email: 'admin@example.com' }, { password });
        console.log('Passwords reset successfully.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

resetPassword();
