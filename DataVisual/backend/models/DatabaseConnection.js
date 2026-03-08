import mongoose from 'mongoose';

const ForeignKeySchema = new mongoose.Schema({
    column: String,
    referenceTable: String,
    referenceColumn: String
}, { _id: false });

const ColumnSchema = new mongoose.Schema({
    name: String,
    type: String,
    isPrimaryKey: { type: Boolean, default: false }
}, { _id: false });

const TableSchema = new mongoose.Schema({
    name: String,
    columns: [ColumnSchema],
    foreignKeys: [ForeignKeySchema]
}, { _id: false });

const DatabaseConnectionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true }, // User friendly name
    type: { type: String, enum: ['mysql', 'postgres', 'mongodb'], required: true },
    uri: { type: String, required: true }, // Encrypted single connection string
    tables: [TableSchema] // Parsed schema structure
}, { timestamps: true });

export const DatabaseConnection = mongoose.model('DatabaseConnection', DatabaseConnectionSchema);
