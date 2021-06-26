const express = require("express");
const router = express.Router();
const UserService = require("./UserService");
const { validationResult } = require("express-validator");
const ValidationException = require("../error/ValidationException");

const pagination = require("../middleware/pagination");
const validation = require("../middleware/validation");

router.post("/users", validation, async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new ValidationException(errors.array()));
  }

  try {
    await UserService.save(req.body);
    return res.send({ message: "User created" });
  } catch (error) {
    next(error);
  }
});

router.post("/users/token/:token", async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);

    return res.send({ message: "Account is activated" });
  } catch (error) {
    next(error);
  }
});

router.get("/users", pagination, async (req, res) => {
  const { page, size } = req.pagination;

  const users = await UserService.getUsers(page, size);
  res.send(users);
});

router.get("/users/:id", async (req, res, next) => {
  try {
    const user = await UserService.getUser(req.params.id);
    res.send(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
