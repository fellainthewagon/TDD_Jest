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

describe("Authenticatiion", () => {
  it("returns 200 when credentials are correct", async () => {
    await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.status).toBe(200);
  });

  it("returns only id and username when login success", async () => {
    const user = await addUser();
    const res = await postAuth({
      email: "user1@mail.com",
      password: "3elenka",
    });
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe(user.username);
    expect(Object.keys(res.body)).toEqual(["id", "username"]);
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
});
