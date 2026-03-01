import mongoose from 'mongoose';

const ColumnDefinitionSchema = new mongoose.Schema({
    name: String,
    type: { type: String, enum: ['string', 'number', 'date', 'boolean'] },
    description: String
});

const AccessPolicySchema = new mongoose.Schema({
    role: String,
    canView: Boolean,
    canEdit: Boolean,
    restrictedColumns: [String]
});

const DatasetSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    description: String,
    columns: [ColumnDefinitionSchema],
    data: [mongoose.Schema.Types.Mixed], // Array of generic objects
    accessPolicies: [AccessPolicySchema],
    sourceType: { type: String, enum: ['csv', 'json', 'xlsx', 'mongodb', 'mysql', 'postgres', 'custom-sql'], default: 'csv' },
    connectionConfig: String, // Encrypted string
    sourceMetadata: mongoose.Schema.Types.Mixed, // Table name, collection name, or query
    isLive: { type: Boolean, default: false }
}, { id: false });

export const Dataset = mongoose.model('Dataset', DatasetSchema);
