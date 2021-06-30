const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const bcrypt = require("bcrypt");
const Token = require("../src/auth/Token");

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

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

const postAuth = (credentials) => {
  return request(app).post("/api/1.0/auth").send(credentials);
};

const postLogout = (options = {}) => {
  const agent = request(app).post("/api/1.0/logout");
  if (options.token) {
    agent.set("Authorization", `Bearer ${options.token}`);
  }
  return agent.send();
};

/**
 * AUTHENTICATION
 *
 */

describe("Authenticatiion", () => {
  it("returns 200 when credentials are correct", async () => {
    await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.status).toBe(200);
  });

  it("returns only id, username, token & image when login success", async () => {
    const user = await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe(user.username);
    expect(Object.keys(res.body)).toEqual(["id", "username", "token", "image"]);
  });

  it("returns 401 when user does't exist", async () => {
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.status).toBe(401);
  });

  it("returns proper error body when auth fails", async () => {
    const nowInMs = new Date().getTime();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    const error = res.body;
    expect(error.path).toBe("/api/1.0/auth");
    expect(error.timestamp).toBeGreaterThan(nowInMs);
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns Incorrect credentionals when auth fails", async () => {
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.body.message).toBe("Incorrect credentionals");
  });

  it("returns 401 when password is wrong", async () => {
    await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "not3elenka",
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when logging in with inactive account", async () => {
    await addUser({ ...activeUser, inactive: true });
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.status).toBe(403);
  });

  it("returns proper error body when inactive user auth fails", async () => {
    await addUser({ ...activeUser, inactive: true });
    const nowInMs = new Date().getTime();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    const error = res.body;
    expect(error.path).toBe("/api/1.0/auth");
    expect(error.timestamp).toBeGreaterThan(nowInMs);
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns Account is inactive when auth fails", async () => {
    await addUser({ ...activeUser, inactive: true });
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.body.message).toBe("Account is inactive");
  });

  it("returns 401 when email is not valid or not sent", async () => {
    const res = await postAuth({ password: "3elenka" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when password is not valid or not sent", async () => {
    const res = await postAuth({ email: "user1@mail.com" });
    expect(res.status).toBe(401);
  });

  it("returns token in res.body when credentials are correct", async () => {
    await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.body.token).not.toBeUndefined();
  });
});

/**
 * LOG OUT
 *
 */

describe("Logout", () => {
  it("returns 200 when unauthorized request send for logout", async () => {
    const res = await postLogout();
    expect(res.status).toBe(200);
  });

  it("removes the token from DB", async () => {
    await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    const token = res.body.token;
    await postLogout({ token });
    const storedToken = await Token.findOne({ where: { token: token } });
    expect(storedToken).toBeNull();
  });
});

/**
 * TOKEN EXPIRATION
 *
 */

describe("Token Expiration", () => {
  const putUser = async (id = 5, body = null, options = {}) => {
    let agent = request(app);
    agent = request(app).put("/api/1.0/users/" + id);
    if (options.token) {
      agent.set("Authorization", `Bearer ${options.token}`);
    }
    return agent.send(body);
  };

  it("returns 403 when token is older than 1 week", async () => {
    const savedUser = await addUser();
    const token = "test-token";
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1);
    await Token.create({ token, userId: savedUser.id, lastUsedAt: oneWeekAgo });
    const validUpdate = { username: "user1-up" };
    const res = await putUser(savedUser.id, validUpdate, { token });
    expect(res.status).toBe(403);
  });

  it("refreshes lastUsedAt when unexpired token is used", async () => {
    const savedUser = await addUser();
    const token = "test-token";
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await Token.create({
      token,
      userId: savedUser.id,
      lastUsedAt: fourDaysAgo,
    });
    const validUpdate = { username: "user1-up" };
    const rightBeforeSendingRequest = new Date();
    await putUser(savedUser.id, validUpdate, { token });
    const tokenFromDB = await Token.findOne({ where: { token } });
    expect(tokenFromDB.lastUsedAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });

  it("refreshes lastUsedAt when unexpired token is used for unauthenticated endpoint", async () => {
    const savedUser = await addUser();
    const token = "test-token";
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await Token.create({
      token,
      userId: savedUser.id,
      lastUsedAt: fourDaysAgo,
    });
    const rightBeforeSendingRequest = new Date();
    await request(app)
      .get("/api/1.0/users/5")
      .set("Authorization", `Bearer ${token}`);
    const tokenFromDB = await Token.findOne({ where: { token } });
    expect(tokenFromDB.lastUsedAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });
});
