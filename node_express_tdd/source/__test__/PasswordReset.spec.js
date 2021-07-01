const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const bcrypt = require("bcrypt");
const SMTPServer = require("smtp-server").SMTPServer;
const config = require("config");
const Token = require("../src/auth/Token");

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

const postPasswordReset = (email = "user1@mail.com", options = {}) => {
  const agent = request(app).post("/api/1.0/user/password");

  return agent.send({ email });
};

const putPasswordUpadate = (body = {}, options = {}) => {
  return request(app).put("/api/1.0/user/password").send(body);
};

/**
 * PASSWORD RESET REQUEST
 *
 */

describe("Password Reset Request", () => {
  it("returns 404 when password reset req is sent for unknown email", async () => {
    const res = await postPasswordReset();
    expect(res.status).toBe(404);
  });

  it("returns path, timestamp & error body.message for unknown email for password req", async () => {
    const now = new Date().getTime();
    const res = await postPasswordReset();
    expect(res.body.path).toBe("/api/1.0/user/password");
    expect(res.body.timestamp).toBeGreaterThan(now);
    expect(res.body.message).toBe("E-mail is not found");
  });

  it("returns 400 with valid error message for invalid email for password req", async () => {
    const res = await postPasswordReset("fake.email");
    expect(res.body.validationErrors.email).toBe("E-mail is not valid");
    expect(res.status).toBe(400);
  });

  it("returns 200 OK when a password reset req is sent for known email", async () => {
    const user = await addUser();
    const res = await postPasswordReset(user.email);
    expect(res.status).toBe(200);
  });

  it("returns success message in res.body", async () => {
    const user = await addUser();
    const res = await postPasswordReset(user.email);
    expect(res.body.message).toBe("Check your e-mail for resetting password");
  });

  it("creates passwordResetToken when a password reset request is sent for known e-mail", async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userFromDB = await User.findOne({ where: { email: user.email } });
    expect(userFromDB.passwordResetToken).toBeTruthy();
  });

  it("sends a password reset email with passwordResetToken", async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userFromDB = await User.findOne({ where: { email: user.email } });
    const passwordResetToken = userFromDB.passwordResetToken;
    expect(lastMail).toContain(user.email);
    expect(lastMail).toContain(passwordResetToken);
  });

  it("returns 502 Bad Gateway when sending email fails", async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const res = await postPasswordReset(user.email);
    expect(res.status).toBe(502);
  });

  it("returns failure message after email fail", async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const res = await postPasswordReset(user.email);
    expect(res.body.message).toBe("E-mail Failure");
  });
});

/**
 * PASSWORD UPDATE
 *
 */

describe("Password Update", () => {
  it("returns 403 when password update req doesn't have valid passwordResetToken", async () => {
    const res = await putPasswordUpadate({
      password: "3elenka",
      passwordResetToken: "wrong token",
    });
    expect(res.status).toBe(403);
  });

  it("returns error body message after trying to update with invalid token", async () => {
    const now = new Date().getTime();
    const res = await putPasswordUpadate({
      password: "3elenka",
      passwordResetToken: "wrong token",
    });
    expect(res.body.path).toBe("/api/1.0/user/password");
    expect(res.body.timestamp).toBeGreaterThan(now);
    expect(res.body.message).toBe(
      "You are not authorized to update your passord. Please follow the password steps again"
    );
  });

  it("returns 403 when password update req with invalid password pattern & reset token is invalid", async () => {
    const res = await putPasswordUpadate({
      password: "WrongPassword",
      passwordResetToken: "wrong token",
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when trying to update with invalid password and reset token ids valid", async () => {
    const user = await addUser();
    user.passwordResetToken = "valid-token";
    await user.save();
    const res = await putPasswordUpadate({
      password: "fail",
      passwordResetToken: "valid-token",
    });
    expect(res.status).toBe(400);
  });

  it.each`
    value     | message
    ${null}   | ${"Password cannot be null"}
    ${"fail"} | ${"Password must be at least 6 characters"}
  `(
    "returns $message when password field is $value",
    async ({ message, value }) => {
      const user = await addUser();
      user.passwordResetToken = "valid-token";
      await user.save();
      const res = await putPasswordUpadate({
        password: value,
        passwordResetToken: "valid-token",
      });
      expect(res.body.validationErrors.password).toBe(message);
    }
  );

  it("returns 200 when valid password is sent with valid reset token", async () => {
    const user = await addUser();
    user.passwordResetToken = "valid-token";
    await user.save();
    const res = await putPasswordUpadate({
      password: "NewPassword",
      passwordResetToken: "valid-token",
    });
    expect(res.status).toBe(200);
  });

  it("updates password in DB when valid password is sent with valid reset token", async () => {
    const user = await addUser();
    user.passwordResetToken = "valid-token";
    await user.save();
    await putPasswordUpadate({
      password: "NewPassword",
      passwordResetToken: "valid-token",
    });
    const userFromDB = await User.findOne({
      where: { email: user.email },
    });
    expect(userFromDB.password).not.toEqual(user.password);
  });

  it("clears the reset token from DB when req is valid", async () => {
    const user = await addUser();
    user.passwordResetToken = "valid-token";
    await user.save();
    await putPasswordUpadate({
      password: "NewPassword",
      passwordResetToken: "valid-token",
    });
    const userFromDB = await User.findOne({
      where: { email: user.email },
    });
    expect(userFromDB.passwordResetToken).toBeFalsy();
  });

  it("activates & clears activation token if account is inactive after valid password reset", async () => {
    const user = await addUser();
    user.passwordResetToken = "valid-token";
    user.activationToken = "activation-token";
    user.inactive = true;
    await user.save();
    await putPasswordUpadate({
      password: "NewPassword",
      passwordResetToken: "valid-token",
    });
    const userFromDB = await User.findOne({
      where: { email: user.email },
    });
    expect(userFromDB.activationToken).toBeFalsy();
    expect(userFromDB.inactive).toBe(false);
  });

  it("clears all token of user after valid password reset", async () => {
    const user = await addUser();
    user.passwordResetToken = "valid-token";
    await user.save();
    await Token.create({
      token: "token-1",
      userId: user.id,
      lastUsedAt: Date.now(),
    });
    await putPasswordUpadate({
      password: "NewPassword",
      passwordResetToken: "valid-token",
    });
    const tokens = await Token.findAll({ where: { userId: user.id } });
    expect(tokens.length).toBe(0);
  });
});
