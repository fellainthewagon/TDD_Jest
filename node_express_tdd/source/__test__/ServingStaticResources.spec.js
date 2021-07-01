const request = require("supertest");
const app = require("../src/app");
const fs = require("fs");
const path = require("path");
const config = require("config");

const { uploadDir, profileDir } = config;
const profilePath = path.join(".", uploadDir, profileDir);

describe("Profile Images", () => {
  const copyFile = () => {
    const filePath = path.join(".", "__test__", "resources", "test-png.png");
    const storedFileName = "test-name-file";
    const targetPath = path.join(profilePath, storedFileName);
    fs.copyFileSync(filePath, targetPath);
    return storedFileName;
  };
  it("returns 404 when file not found", async () => {
    const res = await request(app).get("/images/doesnt_exist_file");
    expect(res.status).toBe(404);
  });

  it("returns 200 when file exist", async () => {
    const storedFileName = copyFile();
    const res = await request(app).get("/images/" + storedFileName);
    expect(res.status).toBe(200);
  });

  it("returns cache for 1 year in res", async () => {
    const storedFileName = copyFile();
    const res = await request(app).get("/images/" + storedFileName);
    const yearInSeconds = 365 * 24 * 60 * 60;
    expect(res.header["cache-control"]).toContain(`max-age=${yearInSeconds}`);
  });
});
