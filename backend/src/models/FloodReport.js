import mongoose from 'mongoose';

const media = new mongoose.Schema({ url: String, publicId: String, uploadedAt: Date, durationSeconds: Number }, { _id: false });
export const waterLevels = ['shallow', 'ankle', 'knee', 'waist_or_higher', 'unknown'];
export const roadConditions = ['passable', 'difficult', 'blocked', 'not_applicable', 'unknown'];
export const yesNoUnknown = ['yes', 'no', 'unknown'];
const schema = new mongoose.Schema({
  reporterName: String, reporterContact: String, anonymous: { type: Boolean, default: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true, validate: v => v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90 },
  },
  locationSource: { type: String, enum: ['gps', 'map'], required: true },
  community: String, district: String, region: String,
  photo: media, voiceRecording: media, description: { type: String, maxlength: 500 },
  waterLevel: { type: String, enum: waterLevels }, roadCondition: { type: String, enum: roadConditions },
  homesAffected: { type: String, enum: yesNoUnknown }, affectedHomesCount: { type: Number, min: 0 },
  peopleNeedHelp: { type: String, enum: yesNoUnknown },
  reportMethod: { type: String, enum: ['photo', 'voice', 'structured', 'mixed'], required: true },
  severityScore: { type: Number, default: null },
  severityLevel: { type: String, enum: ['unassessed', 'low', 'moderate', 'high', 'severe'], default: 'unassessed' },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  responseStatus: { type: String, enum: ['unassigned', 'assigned', 'responding', 'resolved'], default: 'unassigned' },
  submittedAt: { type: Date, default: Date.now },
  verifiedAt: Date, verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date, rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, rejectionReason: String,
  resolvedAt: Date, resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminNotes: String, responseNotes: String,
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ location: '2dsphere' });
schema.index({ verificationStatus: 1, submittedAt: -1 });
schema.index({ severityLevel: 1, responseStatus: 1 });
schema.index({ community: 1, region: 1 });
export const FloodReport = mongoose.model('FloodReport', schema);
