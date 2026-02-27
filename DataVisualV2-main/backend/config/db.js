import mongoose from 'mongoose';
import { User, Dataset, Dashboard } from '../models/index.js';
import { SALES_DATA, USERS_DATA, INITIAL_DASHBOARDS } from '../utils/constants.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lumina_analytics';

export const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');
        await seedDatabase();
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

async function seedDatabase() {
    // Seed Admin — password will be auto-hashed by the User model pre-save hook
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
        console.log('Default Admin Created');
    }

    // Seed standard MOCK_USERS if missing
    const MOCK_USERS = [
        { id: '1', name: 'Alex Admin', role: 'ADMIN', avatar: 'https://picsum.photos/id/1005/100/100', email: 'alex@lumina.com', status: 'active', password: 'password123' },
        { id: '2', name: 'Sarah Analyst', role: 'ANALYST', avatar: 'https://picsum.photos/id/1011/100/100', email: 'sarah@lumina.com', status: 'active', password: 'password123' },
        { id: '3', name: 'Victor Viewer', role: 'VIEWER', avatar: 'https://picsum.photos/id/1012/100/100', email: 'victor@lumina.com', status: 'active', password: 'password123' },
    ];

    for (const u of MOCK_USERS) {
        const exists = await User.findOne({ email: u.email });
        if (!exists) {
            const newUser = new User(u);
            await newUser.save(); // pre-save hook will hash the password
            console.log(`Seeded user: ${u.email}`);
        }
    }

    // Seed Datasets if empty
    const dsCount = await Dataset.countDocuments();
    if (dsCount === 0) {
        await Dataset.create([SALES_DATA, USERS_DATA]);
        console.log('Datasets Seeded');
    }

    // Seed Dashboards if empty
    const dbCount = await Dashboard.countDocuments();
    if (dbCount === 0) {
        await Dashboard.create(INITIAL_DASHBOARDS);
        console.log('Dashboards Seeded');
    }
}
