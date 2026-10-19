// Explicit allowlist: new database fields remain private by default.
const fields = ['location', 'locationSource', 'community', 'district', 'region', 'description',
  'waterLevel', 'roadCondition', 'homesAffected', 'affectedHomesCount', 'peopleNeedHelp',
  'reportMethod', 'severityScore', 'severityLevel', 'verificationStatus', 'responseStatus',
  'submittedAt', 'verifiedAt', 'resolvedAt', 'createdAt', 'updatedAt'];
export function publicReportDTO(doc) {
  const r = doc.toObject ? doc.toObject() : doc;
  const result = { id: String(r._id) };
  for (const field of fields) if (r[field] !== undefined) result[field] = r[field];
  // Raw voice messages can disclose names/contact details: available to admins only.
  if (r.photo) result.photo = { url: r.photo.url, uploadedAt: r.photo.uploadedAt };
  return result;
}
