import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  location: { type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } },
  locationSource: { type: String, enum: ['gps', 'map'], required: true },
  message: { type: String, maxlength: 500 }, contact: { type: String, maxlength: 150 },
  helpType: { type: String, enum: ['general', 'trapped', 'evacuation', 'medical'], default: 'general' },
  status: { type: String, enum: ['new', 'acknowledged', 'resolved'], default: 'new' },
  history: [{ status: String, note: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ location: '2dsphere' });
schema.index({ status: 1, createdAt: -1 });
export const EmergencyRequest = mongoose.model('EmergencyRequest', schema);
