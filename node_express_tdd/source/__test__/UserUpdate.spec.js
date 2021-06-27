const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const bcrypt = require("bcrypt");

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

const putUser = (id = 5, body = null, options = {}) => {
  const res = request(app).put("/api/1.0/users/" + id);

  /* create Authorization Header */
  if (options.auth) {
    const { email, password } = options.auth;
    res.auth(email, password);

    // const merged = `${email}:${password}`;
    // const base64 = Buffer.from(merged).toString("base64");
    // res.set("Authorization", `Basic ${base64}`);
  }

  return res.send(body);
};

const activeUser = {
  username: "user1",
  email: "user1@mail.com",
  password: "3elenka",
  inactive: false,
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;

  return User.create(user);
};

/**
 * USER UPDATE
 *
 */

describe("User Update", () => {
  it("returns 403 when req sent without authorization", async () => {
    const res = await putUser();
    expect(res.status).toBe(403);
  });

  it("returns message, path, timestamp when req sent without authorization", async () => {
    const now = new Date().getTime();
    const res = await putUser();
    expect(res.body.path).toBe("/api/1.0/users/5");
    expect(res.body.timestamp).toBeGreaterThan(now);
    expect(res.body.message).toBe("You are not authorized to update user");
  });

  it("returns 403 when req sent whith incorrect email authorization", async () => {
    await addUser();
    const res = await putUser(5, null, {
      auth: { email: "incorrect@mail.ru", password: "3elenka" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when req sent whith incorrect password authorization", async () => {
    await addUser();
    const res = await putUser(5, null, {
      auth: { email: "user1@mail.ru", password: "incorrect" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when req sent whith correct credentials for different user", async () => {
    await addUser();
    const userToBeUpdated = await addUser({
      ...activeUser,
      username: "user2",
      email: "user2@mail.com",
    });

    const res = await putUser(userToBeUpdated.id, null, {
      auth: { email: "user1@mail.ru", password: "3elenka" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when req sent by inactive user whith correct credentials for its own user", async () => {
    const inactiveUser = await addUser({ ...activeUser, inactive: true });

    const res = await putUser(inactiveUser.id, null, {
      auth: { email: "user1@mail.ru", password: "3elenka" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 when valid update req sent from autorized user", async () => {
    const savedUser = await addUser();
    const update = { username: "user1-up" };
    const res = await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    expect(res.status).toBe(200);
  });

  it("updates username in DB when update req is valid", async () => {
    const savedUser = await addUser();
    const update = { username: "user1-up" };
    await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    const updatedUserDB = await User.findOne({ where: { id: savedUser.id } });
    expect(updatedUserDB.username).toBe(update.username);
  });
});