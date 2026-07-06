import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function disconnect() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearAll() {
  const collections = mongoose.connection.collections;
  for (const col of Object.values(collections)) {
    await col.deleteMany({});
  }
}
