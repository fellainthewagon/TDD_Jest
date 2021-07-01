const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const config = require("config");

const { uploadDir, profileDir } = config;
const profilePath = path.join(".", uploadDir, profileDir);

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

const putUser = async (id = 5, body = null, options = {}) => {
  let agent = request(app);
  let token;

  if (options.auth) {
    const res = await agent.post("/api/1.0/auth").send(options.auth);
    token = res.body.token;
  }

  agent = request(app).put("/api/1.0/users/" + id);
  if (token) {
    agent.set("Authorization", `Bearer ${token}`);
  }
  if (options.token) {
    agent.set("Authorization", `Bearer ${options.token}`);
  }

  return agent.send(body);
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;

  return User.create(user);
};

const readFileAsBase64 = (file = "test-png.png") => {
  const filePath = path.join(".", "__test__", "resources", file);
  return fs.readFileSync(filePath, { encoding: "base64" });
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

  it("returns 403 when token is not valid", async () => {
    const res = await putUser(5, null, { token: "not real token" });
    expect(res.status).toBe(403);
  });

  it("saves user image when update contains image as base64", async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const update = { username: "user1-up", image: fileInBase64 };
    await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    const updatedUserDB = await User.findOne({ where: { id: savedUser.id } });
    expect(updatedUserDB.image).toBeTruthy();
  });

  it("returns success body with id, username, email & image", async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const update = { username: "user1-up", image: fileInBase64 };
    const res = await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    expect(Object.keys(res.body)).toEqual(["id", "username", "email", "image"]);
  });

  it("saves user image to upload folder & stores filename in user when has image", async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const update = { username: "user1-up", image: fileInBase64 };
    await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    const updatedUserDB = await User.findOne({ where: { id: savedUser.id } });
    const profileImagePath = path.join(profilePath, updatedUserDB.image);
    expect(fs.existsSync(profileImagePath)).toBe(true);
  });

  it("removes old image after user upload new one", async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const update = { username: "user1-up", image: fileInBase64 };
    const res = await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });

    const firstImage = res.body.image;

    await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });

    const profileImagePath = path.join(profilePath, firstImage);
    expect(fs.existsSync(profileImagePath)).toBe(false);
  });

  it.each`
    value             | message
    ${null}           | ${"Username cannot be null"}
    ${"usr"}          | ${"Must have min 4 and max 32 characters"}
    ${"a".repeat(33)} | ${"Must have min 4 and max 32 characters"}
  `(
    "returns bad request with $message when username is updated with $value",
    async ({ value, message }) => {
      const savedUser = await addUser();
      const invalidUpdate = { username: value };
      const res = await putUser(savedUser.id, invalidUpdate, {
        auth: { email: savedUser.email, password: "3elenka" },
      });
      expect(res.status).toBe(400);
      expect(res.body.validationErrors.username).toBe(message);
    }
  );

  it("returns 200 when image size is exactly 2mb", async () => {
    const testPng = readFileAsBase64();
    const pngByte = Buffer.from(testPng, "base64").length;
    const twoMB = 1024 * 1024 * 2;
    const filling = "z".repeat(twoMB - pngByte);
    const fillBase64 = Buffer.from(filling).toString("base64");
    const savedUser = await addUser();
    const validUpdate = { username: "user1-up", image: testPng + fillBase64 };
    const res = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    expect(res.status).toBe(200);
  });

  it("returns 400 when image size exceeds 2mb", async () => {
    const fileExceeding2MB = "z".repeat(1024 * 1024 * 2) + "z";
    const base64 = Buffer.from(fileExceeding2MB).toString("base64");
    const savedUser = await addUser();
    const invalidUpdate = { username: "user1-up", image: base64 };
    const res = await putUser(savedUser.id, invalidUpdate, {
      auth: { email: savedUser.email, password: "3elenka" },
    });
    expect(res.status).toBe(400);
  });

  it("keeps old image after user only updates username", async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const update = { username: "user1-up", image: fileInBase64 };
    const res = await putUser(savedUser.id, update, {
      auth: { email: savedUser.email, password: "3elenka" },
    });

    const firstImage = res.body.image;

    await putUser(
      savedUser.id,
      { username: "user1-up-up" },
      {
        auth: { email: savedUser.email, password: "3elenka" },
      }
    );

    const profileImagePath = path.join(profilePath, firstImage);
    expect(fs.existsSync(profileImagePath)).toBe(true);
    const userFeromDB = await User.findOne({ where: { id: savedUser.id } });
    expect(userFeromDB.image).toBe(firstImage);
  });

  it("returns error message when image size exceeds 2mb", async () => {
    const fileExceeding2MB = "z".repeat(1024 * 1024 * 2) + "z";
    const base64 = Buffer.from(fileExceeding2MB).toString("base64");
    const savedUser = await addUser();
    const invalidUpdate = { username: "user1-up", image: base64 };
    const res = await putUser(savedUser.id, invalidUpdate, {
      auth: { email: savedUser.email, password: "3elenka" },
    });

    expect(res.body.validationErrors.image).toBe(
      "Your profile image cannot be bigger than 2MB"
    );
  });

  it.each`
    file              | status
    ${"test-gif.gif"} | ${400}
    ${"test-pdf.pdf"} | ${400}
    ${"test-txt.txt"} | ${400}
    ${"test-png.png"} | ${200}
    ${"test-jpg.jpg"} | ${200}
  `(
    "returns $status when uploading $file as image",
    async ({ file, status }) => {
      const fileInBase64 = readFileAsBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: "user1-up", image: fileInBase64 };
      const res = await putUser(savedUser.id, updateBody, {
        auth: { email: savedUser.email, password: "3elenka" },
      });
      expect(res.status).toBe(status);
    }
  );

  it.each`
    file              | message
    ${"test-gif.gif"} | ${"Only JPEG or PNG files allowed"}
    ${"test-pdf.pdf"} | ${"Only JPEG or PNG files allowed"}
    ${"test-txt.txt"} | ${"Only JPEG or PNG files allowed"}
  `(
    "returns $message when uploading $file as image",
    async ({ file, message }) => {
      const fileInBase64 = readFileAsBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: "user1-up", image: fileInBase64 };
      const res = await putUser(savedUser.id, updateBody, {
        auth: { email: savedUser.email, password: "3elenka" },
      });
      expect(res.body.validationErrors.image).toBe(message);
    }
  );
});
