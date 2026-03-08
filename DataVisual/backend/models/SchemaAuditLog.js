import mongoose from 'mongoose';

const SchemaAuditLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    action: {
        type: String,
        enum: ['SELECT_DB', 'REFRESH_SCHEMA', 'CREATE_RELATIONSHIP', 'MODIFY_RELATIONSHIP', 'DELETE_RELATIONSHIP', 'EXECUTE_JOIN'],
        required: true
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
});

// Auto-expire logs after 90 days
SchemaAuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const SchemaAuditLog = mongoose.model('SchemaAuditLog', SchemaAuditLogSchema);
