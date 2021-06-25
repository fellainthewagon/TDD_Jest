const express = require("express");
const router = express.Router();
const UserService = require("./UserService");
const { check, validationResult } = require("express-validator");
const ValidationException = require("../error/ValidationException");

const validations = [
  check("username")
    .notEmpty()
    .withMessage("Username cannot be null")
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage("Must have min 4 and max 32 characters"),
  check("email")
    .notEmpty()
    .withMessage("E-mail cannot be null")
    .bail()
    .isEmail()
    .withMessage("E-mail is not valid")
    .bail()
    .custom(async (email) => {
      const user = await UserService.findByEmail(email);
      if (user) {
        throw new Error("E-mail in use");
      }
    }),
  check("password")
    .notEmpty()
    .withMessage("Password cannot be null")
    .bail()
    .isLength({ min: 5 })
    .withMessage("Password must be at least 6 characters"),
];

router.post("/", validations, async (req, res, next) => {
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

router.post("/token/:token", async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);

    return res.send({ message: "Account is activated" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
