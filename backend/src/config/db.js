import dns from "node:dns";
import mongoose from "mongoose";
import { env } from './env.js';

// A stale/disconnected network adapter can leave Node's default DNS resolver
// unable to answer SRV/A queries even though the OS route to the internet is
// fine (e.g. Windows still points c-ares at a dead adapter's DNS server).
// Force a public resolver so the mongodb+srv:// lookup doesn't ECONNREFUSED.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
    try {
await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

export default connectDB;