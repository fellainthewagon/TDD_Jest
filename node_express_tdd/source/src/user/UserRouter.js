const express = require("express");
const router = express.Router();
const UserService = require("./UserService");
const { validationResult, check } = require("express-validator");
const ValidationException = require("../error/ValidationException");
const FileType = require("file-type");

const pagination = require("../middleware/pagination");
const validation = require("../middleware/validation");
const ForbiddenException = require("../error/ForbiddenException");
const FileService = require("../file/FileService");

/**
 * Create User (POST)
 *
 */

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

/**
 * Account Activation Request (POST)
 *
 */

router.post("/users/token/:token", async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);

    return res.send({ message: "Account is activated" });
  } catch (error) {
    next(error);
  }
});

/**
 * Get All Users (GET)
 *
 */

router.get("/users", pagination, async (req, res) => {
  const authenticatedUser = req.authenticatedUser;
  const { page, size } = req.pagination;

  const users = await UserService.getUsers(page, size, authenticatedUser);
  res.send(users);
});

/**
 * Get User (GET)
 *
 */

router.get("/users/:id", async (req, res, next) => {
  try {
    const user = await UserService.getUser(req.params.id);
    res.send(user);
  } catch (error) {
    next(error);
  }
});

/**
 * Update username (PUT)
 *
 */

const checkUsernameAnImage = [
  check("username")
    .notEmpty()
    .withMessage("Username cannot be null")
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage("Must have min 4 and max 32 characters"),
  check("image").custom(async (imageAsBase64String) => {
    if (!imageAsBase64String) return true;

    const buffer = Buffer.from(imageAsBase64String, "base64");
    if (buffer.length > 2 * 1024 * 1024) {
      throw new Error("Your profile image cannot be bigger than 2MB");
    }

    const type = await FileType.fromBuffer(buffer);
    if (!type || (type.mime !== "image/png" && type.mime !== "image/jpeg")) {
      throw new Error("Only JPEG or PNG files allowed");
    }

    return true;
  }),
];

router.put(
  "/users/:id",
  FileService.checkUsernameAnImage,
  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;

    if (!authenticatedUser || authenticatedUser.id != req.params.id) {
      return next(
        new ForbiddenException("You are not authorized to update user")
      );
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }

    const user = await UserService.updateUser(req.params.id, req.body);
    return res.send(user);
  }
);

/**
 * Delete user (DELETE)
 *
 */

router.delete("/users/:id", async (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;

  if (!authenticatedUser || authenticatedUser.id != req.params.id) {
    return next(
      new ForbiddenException("You are not authorized to delete user")
    );
  }

  await UserService.deleteUser(req.params.id);
  res.send();
});

/**
 * Password Reset Request (POST)
 *
 */

router.post(
  "/user/password",
  check("email").isEmail().withMessage("E-mail is not valid"),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    try {
      await UserService.passwordResetRequest(req.body.email);
      return res.send({ message: "Check your e-mail for resetting password" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update Password (PUT)
 *
 */

const passwordResetTokenValidator = async (req, res, next) => {
  const user = await UserService.findByPasswordResetToken(
    req.body.passwordResetToken
  );
  if (!user) {
    return next(
      new ForbiddenException(
        "You are not authorized to update your passord. Please follow the password steps again"
      )
    );
  }
  next();
};

const checkPassword = check("password")
  .notEmpty()
  .withMessage("Password cannot be null")
  .bail()
  .isLength({ min: 5 })
  .withMessage("Password must be at least 6 characters");

router.put(
  "/user/password",
  passwordResetTokenValidator,
  checkPassword,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    await UserService.updatePassword(req.body);
    res.send();
  }
);

module.exports = router;
