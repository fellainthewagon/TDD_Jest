const express = require("express");
const userRouter = require("./user/UserRouter");
const authRouter = require("./auth/AuthenticationRouter");
const errorHandler = require("./error/ErrorHandler");
const tokenAuthenticaton = require("./middleware/tokenAuthentication");
const FileService = require("./file/FileService");

const path = require("path");
const config = require("config");
const { uploadDir, profileDir } = config;
const profilePath = path.join(".", uploadDir, profileDir);

const app = express();

FileService.createFolders();

app.use(express.json({ limit: "3mb" }));

app.use(
  "/images",
  express.static(profilePath, { maxAge: 365 * 24 * 60 * 60 * 1000 })
);

app.use(tokenAuthenticaton);

app.use("/api/1.0", userRouter);
app.use("/api/1.0", authRouter);

app.use(errorHandler);

module.exports = app;
