const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const bcrypt = require("bcrypt");
const Token = require("../src/auth/Token");

beforeAll(async () => {
  if (process.env.NODE_ENV === "test") {
    await sequelize.sync();
  }
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

/**
 * Funcs
 */

const activeUser = {
  username: "user1",
  email: "user1@mail.com",
  password: "3elenka",
  inactive: false,
};

const deleteUser = async (id = 5, options = {}) => {
  let agent = request(app).delete("/api/1.0/users/" + id);
  if (options.token) {
    agent.set("Authorization", `Bearer ${options.token}`);
  }
  return agent.send();
};

async function auth(options = {}) {
  let token;
  if (options.auth) {
    const res = await request(app).post("/api/1.0/auth").send(options.auth);
    token = res.body.token;
  }
  return token;
}

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;

  return User.create(user);
};

/**
 * USER DELETE
 *
 */

describe("User Delete", () => {
  it("returns 403 when req sent unauthorized", async () => {
    const res = await deleteUser();
    expect(res.status).toBe(403);
  });

  it("returns message, path, timestamp when req sent without authorization", async () => {
    const now = new Date().getTime();
    const res = await deleteUser(5);
    expect(res.body.path).toBe("/api/1.0/users/5");
    expect(res.body.timestamp).toBeGreaterThan(now);
    expect(res.body.message).toBe("You are not authorized to delete user");
  });

  it("returns 403 when delete req sent whith correct credentials for different user", async () => {
    await addUser();
    const userToBeDeleted = await addUser({
      ...activeUser,
      username: "user2",
      email: "user2@mail.com",
    });
    const token = await auth({
      auth: { email: "user1@mail.com", password: "3elenka" },
    });
    const res = await deleteUser(userToBeDeleted.id, { token });
    expect(res.status).toBe(403);
  });

  it("returns 403 when token is not valid", async () => {
    const res = await deleteUser(5, { token: "not real token" });
    expect(res.status).toBe(403);
  });

  it("returns 200 when delete req sent from autorized user", async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: savedUser.email, password: "3elenka" },
    });
    const res = await deleteUser(savedUser.id, { token });
    expect(res.status).toBe(200);
  });

  it("deletes user from DB when req sent from authorized user", async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: savedUser.email, password: "3elenka" },
    });
    await deleteUser(savedUser.id, { token });
    const userFromDB = await User.findOne({ where: { id: savedUser.id } });
    expect(userFromDB).toBeNull();
  });

  it("deletes token from DB when delete user req sent from authorized user", async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: savedUser.email, password: "3elenka" },
    });
    await deleteUser(savedUser.id, { token });
    const tokenFromDB = await Token.findOne({ where: { token } });
    expect(tokenFromDB).toBeNull();
  });

  it("deletes all tokens from DB when delete user req sent from authorized user", async () => {
    const savedUser = await addUser();
    const token1 = await auth({
      auth: { email: savedUser.email, password: "3elenka" },
    });
    const token2 = await auth({
      auth: { email: savedUser.email, password: "3elenka" },
    });
    await deleteUser(savedUser.id, { token: token1 });
    const tokenFromDB = await Token.findOne({ where: { token: token2 } });
    expect(tokenFromDB).toBeNull();
  });
});
