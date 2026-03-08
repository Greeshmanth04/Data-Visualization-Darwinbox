import mongoose from 'mongoose';

const CrossDatabaseRelationshipSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    sourceConnectionId: { type: String, required: true },
    sourceTable: { type: String, required: true },
    sourceColumn: { type: String, required: true },
    targetConnectionId: { type: String, required: true },
    targetTable: { type: String, required: true },
    targetColumn: { type: String, required: true },
    joinType: { type: String, enum: ['1:1', '1:N', 'N:1'], default: '1:N' },
    createdBy: { type: String }
}, { timestamps: true });

export const CrossDatabaseRelationship = mongoose.model('CrossDatabaseRelationship', CrossDatabaseRelationshipSchema);
