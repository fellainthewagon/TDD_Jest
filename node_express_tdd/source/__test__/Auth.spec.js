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

const addUser = async () => {
  const user = {
    username: "user1",
    email: "user1@mail.com",
    password: "3elenka",
    inactive: false,
  };
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;

  return User.create(user);
};

const postAuth = async (credentials) => {
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
});
