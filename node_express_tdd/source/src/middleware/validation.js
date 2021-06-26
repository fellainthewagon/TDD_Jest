const { check } = require("express-validator");
const UserService = require("../user/UserService");

const validation = [
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

module.exports = validation;
