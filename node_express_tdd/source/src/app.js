const express = require("express");
const userRouter = require("./user/UserRouter");
const errorHandler = require("./error/ErrorHandler");

const app = express();

app.use(express.json());

app.use("/api/1.0/users", userRouter);

app.use(errorHandler);

module.exports = app;
