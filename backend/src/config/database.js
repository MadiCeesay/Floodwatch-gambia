import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);
let connecting;
export async function connectDatabase(uri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connecting) connecting = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try { await connecting; } finally { connecting = undefined; }
  return mongoose.connection;
}
export async function closeDatabase() { await mongoose.disconnect(); }
