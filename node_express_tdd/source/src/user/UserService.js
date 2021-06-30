const User = require("./User");
const bcrypt = require("bcrypt");
const EmailService = require("../email/EmailService");
const sequelize = require("../config/database");
const EmailException = require("../email/EmailException");
const InvalidTokenException = require("../user/InvalidTokenException");
const NotFoundException = require("../error/NotFoundException");
const Sequelize = require("sequelize");
const { randomString } = require("../shared/generator");
const TokenService = require("../auth/TokenService");
const FileService = require("../file/FileService");

async function save(body) {
  const { username, email, password } = body;
  const hashed = await bcrypt.hash(body.password, 10);
  const user = {
    username,
    email,
    password: hashed,
    activationToken: randomString(16),
  };
  const transaction = await sequelize.transaction();
  await User.create(user, { transaction });

  try {
    await EmailService.sendAccountActivation(email, user.activationToken);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw new EmailException();
  }
}

async function findByEmail(email) {
  return await User.findOne({ where: { email: email } });
}

async function activate(token) {
  const user = await User.findOne({ where: { activationToken: token } });
  if (!user) {
    throw new InvalidTokenException();
  }
  user.inactive = false;
  user.activationToken = null;
  await user.save();
}

async function getUsers(page, size, authenticatedUser) {
  const id = authenticatedUser ? authenticatedUser.id : 0;

  const usersWithCount = await User.findAndCountAll({
    where: {
      inactive: false,
      id: {
        [Sequelize.Op.not]: id,
      },
    },
    attributes: ["id", "username", "email", "image"],
    limit: size,
    offset: page * size,
  });

  return {
    content: usersWithCount.rows,
    page: page,
    size: size,
    totalPages: Math.ceil(usersWithCount.count / size),
  };
}

async function getUser(id) {
  const user = await User.findOne({
    where: {
      id: id,
      inactive: false,
    },
    attributes: ["id", "username", "email", "image"],
  });
  if (!user) {
    throw new NotFoundException("User not found");
  }
  return user;
}

async function updateUser(id, updatedBody) {
  const user = await User.findOne({ where: { id: id } });
  user.username = updatedBody.username;
  if (updatedBody.image) {
    user.image = await FileService.saveProfileImage(updatedBody.image);
  }
  await user.save();
  return {
    id,
    username: user.username,
    email: user.email,
    image: user.image,
  };
}

async function deleteUser(id) {
  await User.destroy({ where: { id: id } });
}

async function passwordResetRequest(email) {
  const user = await findByEmail(email);
  if (!user) {
    throw new NotFoundException("E-mail is not found");
  }

  user.passwordResetToken = randomString(16);
  await user.save();

  try {
    await EmailService.sendPasswordReset(email, user.passwordResetToken);
  } catch (error) {
    throw new EmailException();
  }
}

const findByPasswordResetToken = (token) => {
  return User.findOne({
    where: { passwordResetToken: token },
  });
};

async function updatePassword(updateRequest) {
  const user = await findByPasswordResetToken(updateRequest.passwordResetToken);
  user.password = await bcrypt.hash(updateRequest.password, 10);
  user.passwordResetToken = null;
  user.activationToken = null;
  user.inactive = false;
  await user.save();
  await TokenService.clearTokens(user.id);
}

module.exports = {
  save,
  findByEmail,
  activate,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  passwordResetRequest,
  updatePassword,
  findByPasswordResetToken,
};
