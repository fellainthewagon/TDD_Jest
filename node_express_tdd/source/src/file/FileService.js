const fs = require("fs");
const path = require("path");
const config = require("config");
const { randomString } = require("../shared/generator");
const FileType = require("file-type");
const { validationResult, check } = require("express-validator");

const { uploadDir, profileDir } = config;
const profileFolder = path.join(".", uploadDir, profileDir);

const createFolders = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  if (!fs.existsSync(profileFolder)) {
    fs.mkdirSync(profileFolder);
  }
};

const saveProfileImage = async (base64File) => {
  const filename = randomString(32);
  const filePath = path.join(profileFolder, filename);
  await fs.promises.writeFile(filePath, base64File, "base64");
  return filename;
};

const deleteProfileImage = async (filename) => {
  const filePath = path.join(profileFolder, filename);
  await fs.promises.unlink(filePath);
};

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

module.exports = {
  createFolders,
  saveProfileImage,
  deleteProfileImage,
  checkUsernameAnImage,
};
