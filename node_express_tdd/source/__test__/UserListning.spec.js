const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

function getUsers() {
  return request(app).get("/api/1.0/users");
}

async function addUsers(activeUserCount, inactiveUserCount = 0) {
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount,
    });
  }
}

/**
 * LISTNING USERS
 *
 */

describe("Listning Users", () => {
  it("returns 200 OK when there are no user in DB", async () => {
    const res = await getUsers();
    expect(res.status).toBe(200);
  });

  it("returns page object as response body", async () => {
    const res = await getUsers();
    expect(res.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it("returns 10 users in page when thare are 11 users in DB", async () => {
    await addUsers(11);
    const res = await getUsers();
    expect(res.body.content.length).toBe(10);
  });

  it("returns 6 users in page when there are active 6 & 5 inactive users in DB", async () => {
    await addUsers(6, 5);
    const res = await getUsers();
    expect(res.body.content.length).toBe(6);
  });

  it("returns onli id, username, email in content for each user", async () => {
    await addUsers(11);
    const res = await getUsers();
    const user = res.body.content[0];
    expect(Object.keys(user)).toEqual(["id", "username", "email"]);
  });

  it("returns 2 as totalPage when 15 active & 7 inactive users in DB", async () => {
    await addUsers(15, 7);
    const res = await getUsers();
    expect(res.body.totalPages).toBe(2);
  });

  it("returns second page users & page indicator when page is set as 1 in req parameter", async () => {
    await addUsers(11);
    const res = await getUsers().query({ page: 1 });
    expect(res.body.content[0].username).toBe("user11");
    expect(res.body.page).toBe(1);
  });

  it("returns first page when page is set below 0 as req parameter", async () => {
    await addUsers(11);
    const res = await getUsers().query({ page: -5 });
    expect(res.body.content[0].username).toBe("user1");
    expect(res.body.page).toBe(0);
  });

  it("returns 5 users & size indicator when size is set as 5 in req param", async () => {
    await addUsers(11);
    const res = await getUsers().query({ size: 5 });
    expect(res.body.content.length).toBe(5);
    expect(res.body.size).toBe(5);
  });

  it("returns 10 users & size indicator when size is set as 1000", async () => {
    await addUsers(11);
    const res = await getUsers().query({ size: 1000 });
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it("returns 10 users & size indicator when size is set as 0", async () => {
    await addUsers(11);
    const res = await getUsers().query({ size: 0 });
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it("returns page as 0 & size as 10 when non numeric query param", async () => {
    await addUsers(11);
    const res = await getUsers().query({ size: "fella", page: "wagon" });
    expect(res.body.size).toBe(10);
    expect(res.body.page).toBe(0);
  });
});

/**
 * GET USER
 *
 */

describe("Get User", () => {
  const getUser = (id = 5) => {
    return request(app).get("/api/1.0/users/" + id);
  };

  it("returns User not found & status 404 when user not found", async () => {
    const res = await getUser();
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  it("returns proper error body when user not found", async () => {
    const nowInMs = new Date().getTime();
    const res = await getUser();
    const error = res.body;
    expect(error.path).toBe("/api/1.0/users/5");
    expect(error.timestamp).toBeGreaterThan(nowInMs);
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns 200 when active user exist", async () => {
    const user = await User.create({
      username: "user1",
      email: "user1@mail.com",
      inactive: false,
    });

    const res = await getUser(user.id);
    expect(res.status).toBe(200);
  });

  it("returns id, username, email in res.body when active user exist", async () => {
    const user = await User.create({
      username: "user1",
      email: "user1@mail.com",
      inactive: false,
    });

    const res = await getUser(user.id);
    expect(Object.keys(res.body)).toEqual(["id", "username", "email"]);
  });

  it("returns 404 when user is inactive", async () => {
    const user = await User.create({
      username: "user1",
      email: "user1@mail.com",
      inactive: true,
    });

    const res = await getUser(user.id);
    expect(res.status).toBe(404);
  });
});
