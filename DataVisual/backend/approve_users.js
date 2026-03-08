import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({
    id: String,
    status: String
});

const User = mongoose.model('User', UserSchema);

async function approveAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/darwin_visualize');
        const results = await User.updateMany({ status: 'pending' }, { status: 'active' });
        console.log(`Approved ${results.modifiedCount} users.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

approveAll();
