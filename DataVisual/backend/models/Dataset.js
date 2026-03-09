import mongoose from 'mongoose';

const ColumnDefinitionSchema = new mongoose.Schema({
    name: String,
    type: { type: String }, // looser type validation array since datasetController handles varied types
    description: String,
    displayName: String
});

// Row-level access policy: limits which rows a role can see
const RowPolicySchema = new mongoose.Schema({
    role: { type: String, enum: ['ADMIN', 'ANALYST', 'VIEWER'], required: true },
    column: { type: String, required: true },
    operator: { type: String, enum: ['eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte'], default: 'eq' },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    combine: { type: String, enum: ['AND', 'OR'], default: 'AND' }
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
    rowPolicies: [RowPolicySchema], // Row-level access control policies
    sourceType: { type: String, enum: ['csv', 'json', 'xlsx', 'mongodb', 'mysql', 'postgres'], default: 'csv' },
    connectionConfig: String, // Encrypted string
    sourceMetadata: mongoose.Schema.Types.Mixed, // Table name, collection name, or query
    isLive: { type: Boolean, default: false }
}, { id: false, timestamps: true });

export const Dataset = mongoose.model('Dataset', DatasetSchema);
