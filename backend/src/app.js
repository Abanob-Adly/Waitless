import express from "express";  // alternative syntax: const express = require("express");
import { env } from './config/env.js';
import connectDB from "./config/db.js";
import authRoutes from './routes/authRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import membershipRoutes from './routes/membershipRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

connectDB();

const app = express();

// middlewares
app.use(express.json());

app.listen(env.port, () => {
    console.log(`Server Started on port: ${env.port}`);
});

// routes
app.get("/", (req, res) => res.send("Hello World!"));
app.use('/auth', authRoutes);
app.use('/organizations', orgRoutes);
app.use('/memberships', membershipRoutes);

// error handler must be at bottom
app.use(errorHandler);