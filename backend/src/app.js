import express from "express";  // alternative syntax: const express = require("express");
// import notes_routes from "./routes/notes_routes.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// configure environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

connectDB();

// middlewares
// app.use(express.json());
// app.use("/api/notes", notes_routes);
app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(port, () => {
    console.log(`Server Started on port: ${port}`);
});