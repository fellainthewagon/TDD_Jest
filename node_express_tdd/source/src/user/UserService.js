const User = require("./User");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const EmailService = require("../email/EmailService");
const sequelize = require("../config/database");
const EmailException = require("../email/EmailException");
const InvalidTokenException = require("../user/InvalidTokenException");
const UserNotFoundException = require("./UserNotFoundException");

function generateToken(length) {
  return crypto.randomBytes(length).toString("hex").substring(0, length);
}

async function save(body) {
  const { username, email, password } = body;
  const hashed = await bcrypt.hash(body.password, 10);
  const user = {
    username,
    email,
    password: hashed,
    activationToken: generateToken(16),
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

async function getUsers(page, size) {
  const usersWithCount = await User.findAndCountAll({
    where: { inactive: false },
    attributes: ["id", "username", "email"],
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
    attributes: ["id", "username", "email"],
  });
  if (!user) {
    throw new UserNotFoundException();
  }
  return user;
}

module.exports = { save, findByEmail, activate, getUsers, getUser };
