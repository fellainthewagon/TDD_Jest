const request = require("supertest");
const app = require("../src/app");

const postPasswordReset = (email = "user1@mail.com", options = {}) => {
  const agent = request(app).post("/api/1.0/password-reset");

  return agent.send({ email });
};

describe("Password Reset Request", () => {
  it("returns 404 when password reset req is sent for unknown email", async () => {
    const res = await postPasswordReset();
    expect(res.status).toBe(404);
  });

  it("returns path, timestamp & error body.message for unknown email for password req", async () => {
    const now = new Date().getTime();
    const res = await postPasswordReset();
    expect(res.body.path).toBe("/api/1.0/password-reset");
    expect(res.body.timestamp).toBeGreaterThan(now);
    expect(res.body.message).toBe("E-mail is not found");
  });

  it("returns 400 with valid error message for invalid email for password req", async () => {
    const res = await postPasswordReset("fake.email");
    expect(res.body.validationErrors.email).toBe("E-mail is not valid");
    expect(res.status).toBe(400);
  });
});
