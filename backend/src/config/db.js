import mongoose from "mongoose";
import { env } from './env.js';

const connectDB = async () => {
    try {
        await mongoose.connect(env.db.uri);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

export default connectDB;