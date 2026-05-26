import mongoose from 'mongoose';

export async function connect(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });
  console.log('mongo: connected');
}

export async function disconnect() {
  await mongoose.disconnect();
}
