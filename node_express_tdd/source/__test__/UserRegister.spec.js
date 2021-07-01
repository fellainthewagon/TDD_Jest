const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const SMTPServer = require("smtp-server").SMTPServer;
const config = require("config");

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on("data", (data) => {
        mailBody += data.toString();
      });

      stream.on("end", () => {
        if (simulateSmtpFailure) {
          const err = new Error("Invalid mailbox");
          err.responseCode = 553;
          return callback(err);
        }

        lastMail = mailBody;
        callback();
      });
    },
  });

  await server.listen(config.mail.port, "localhost");

  if (process.env.NODE_ENV === "test") {
    await sequelize.sync();
  }
  jest.setTimeout(20000);
});

beforeEach(async () => {
  simulateSmtpFailure = false;
  await User.destroy({ truncate: { cascade: true } });
});

/**
 * Funcs
 */

const validUser = {
  username: "user1",
  email: "user1@mail.com",
  password: "Fella",
};

afterAll(async () => {
  await server.close();
  jest.setTimeout(5000);
});

const postUser = (user = validUser) => {
  return request(app).post("/api/1.0/users").send(user);
};

/**
 * USER REGISTRATION
 *
 */

describe("User Registration", () => {
  it("returns 200 OK when signup request is valid", async () => {
    const res = await postUser();
    expect(res.status).toBe(200);
  });

  it("returns succes meessage when signup request is valid", async () => {
    const res = await postUser();
    expect(res.body.message).toBe("User created");
  });

  it("saves the users to DB", async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it("saves the username and email to DB", async () => {
    await postUser();
    const userList = await User.findAll();
    const saved = userList[0];
    expect(saved.username).toBe("user1");
    expect(saved.email).toBe("user1@mail.com");
  });

  it("hash password", async () => {
    await postUser();
    const userList = await User.findAll();
    const saved = userList[0];
    expect(saved.password).not.toBe("Fella");
  });

  it("return status 400 when username is null", async () => {
    const res = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "Fella",
    });
    expect(res.status).toBe(400);
  });

  it("return validationErrors when validation err occured", async () => {
    const res = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "Fella",
    });

    const body = res.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it("return errors for both username email null", async () => {
    const res = await postUser({
      username: null,
      email: null,
      password: "Fella",
    });

    const body = res.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it.each`
    field         | value             | expectedMessage
    ${"username"} | ${null}           | ${"Username cannot be null"}
    ${"username"} | ${"usr"}          | ${"Must have min 4 and max 32 characters"}
    ${"username"} | ${"a".repeat(33)} | ${"Must have min 4 and max 32 characters"}
    ${"email"}    | ${null}           | ${"E-mail cannot be null"}
    ${"email"}    | ${"mail.com"}     | ${"E-mail is not valid"}
    ${"email"}    | ${"user1@com"}    | ${"E-mail is not valid"}
    ${"password"} | ${null}           | ${"Password cannot be null"}
    ${"password"} | ${"pass"}         | ${"Password must be at least 6 characters"}
  `(
    "returns $expectedMessage when $field is $value",
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: "user1",
        email: "user1@mail.ru",
        password: "Fella",
      };

      user[field] = value;
      const res = await postUser(user);

      const body = res.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it("returns E-mail in use when same email is already in use", async () => {
    await User.create({ ...validUser });
    const res = await postUser();

    expect(res.body.validationErrors.email).toBe("E-mail in use");
  });

  it("returns errors for both username is null and email is in use", async () => {
    await User.create({ ...validUser });
    const res = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "validPass",
    });
    const body = res.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it("creates user in inactive mode", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it("creates user in inactive mode even the req body contains inactive as false", async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it("creates activationToken for user", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it("sends Account activation email with activationToken", async () => {
    await postUser();

    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain("user1@mail.com");
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it("returns 502 Bad Gateway when sending email fails", async () => {
    simulateSmtpFailure = true;

    const res = await postUser();
    expect(res.status).toBe(502);
  });

  it("returns Email failure message when sending email fails", async () => {
    simulateSmtpFailure = true;

    const res = await postUser();
    expect(res.body.message).toBe("E-mail Failure");
  });

  it("does not save user to DB if when activation email fails", async () => {
    simulateSmtpFailure = true;

    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it("returns Validation Failure message in error response body when validation fails", async () => {
    const res = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "validPass",
    });
    expect(res.body.message).toBe("Validation Failure");
  });
});

/**
 * ACCOUNT ACTIVATION
 *
 */

describe("Account activation", () => {
  it("activates the account when correct token is sent", async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();
    users = await User.findAll();
    expect(users[0].inactive).toBe(false);
  });

  it("returns Account is activated when account successfuly activated", async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    const res = await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();

    expect(res.body.message).toBe("Account is activated");
  });

  it("removes token from userTable after successful activation", async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();
    users = await User.findAll();
    expect(users[0].activationToken).toBeFalsy();
  });

  it("does not activate the account when token is wrong", async () => {
    await postUser();
    const token = "this-token-does-not-exist";

    await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();
    const users = await User.findAll();
    expect(users[0].inactive).toBe(true);
  });

  it("returns bad request when token is wrong", async () => {
    await postUser();
    const token = "this-token-does-not-exist";

    const res = await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();
    expect(res.status).toBe(400);
  });

  it("returns This account is either active or the token is invalid when wrong token", async () => {
    await postUser();
    const token = "this-token-does-not-exist";

    const res = await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();

    expect(res.body.message).toBe(
      "This account is either active or the token is invalid"
    );
  });
});

describe("Error Model", () => {
  it("returns path, timestamp, message and validErrs in response when validation failure", async () => {
    const res = await postUser({ ...validUser, username: null });
    const body = res.body;
    expect(Object.keys(body)).toEqual([
      "path",
      "timestamp",
      "message",
      "validationErrors",
    ]);
  });

  it("returns path, timestamp and message in res when req fails other than validErrs", async () => {
    const token = "this-token-does-not-exist";
    const res = await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();

    const body = res.body;
    expect(Object.keys(body)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns path in error body", async () => {
    const token = "this-token-does-not-exist";
    const res = await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();

    const body = res.body;
    expect(body.path).toEqual("/api/1.0/users/token/" + token);
  });

  it("returns timestamp in milliseconds whithin 5 seconds value in error body", async () => {
    const nowInMs = new Date().getTime();
    const fiveSecondsLater = nowInMs + 5 * 1000;

    const token = "this-token-does-not-exist";
    const res = await request(app)
      .post("/api/1.0/users/token/" + token)
      .send();

    const body = res.body;

    expect(body.timestamp).toBeGreaterThan(nowInMs);
    expect(body.timestamp).toBeLessThan(fiveSecondsLater);
  });
});
