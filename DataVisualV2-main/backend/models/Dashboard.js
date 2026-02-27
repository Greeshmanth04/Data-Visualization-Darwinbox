import mongoose from 'mongoose';

const DashboardWidgetSchema = new mongoose.Schema({
    id: String,
    title: String,
    type: String,
    datasetId: String,
    config: {
        xAxis: String,
        dataKey: String,
        series: [String],
        color: String
    },
    w: Number,
    h: Number
});

const DashboardSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    description: String,
    widgets: [DashboardWidgetSchema],
    ownerId: { type: String, required: true },
    sharedWith: [{
        userId: String,
        accessLevel: { type: String, enum: ['view', 'edit'], default: 'view' }
    }]
}, { id: false });

export const Dashboard = mongoose.model('Dashboard', DashboardSchema);
