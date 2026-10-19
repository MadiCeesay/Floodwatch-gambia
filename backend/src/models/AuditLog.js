import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'FloodReport', required: true },
  action: { type: String, required: true },
  changes: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
schema.index({ report: 1, createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', schema);
