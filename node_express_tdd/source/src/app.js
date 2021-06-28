const express = require("express");
const userRouter = require("./user/UserRouter");
const authRouter = require("./auth/AuthenticationRouter");
const errorHandler = require("./error/ErrorHandler");
const tokenAuthenticaton = require("./middleware/tokenAuthentication");

const app = express();

app.use(express.json());
app.use(tokenAuthenticaton);

app.use("/api/1.0", userRouter);
app.use("/api/1.0", authRouter);

app.use(errorHandler);

module.exports = app;
