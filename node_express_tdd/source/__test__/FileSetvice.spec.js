const FileService = require("../src/file/FileService");
const fs = require("fs");
const path = require("path");
const config = require("config");

const { uploadDir, profileDir } = config;

describe("Create Folders", () => {
  it("creates upload folder", () => {
    FileService.createFolders();
    const folderName = uploadDir;
    expect(fs.existsSync(folderName)).toBe(true);
  });

  it("creates profile folder under upload folder", () => {
    FileService.createFolders();
    const profileFolder = path.join(".", uploadDir, profileDir);
    expect(fs.existsSync(profileFolder)).toBe(true);
  });
});