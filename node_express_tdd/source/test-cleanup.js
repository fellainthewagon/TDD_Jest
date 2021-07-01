const fs = require("fs");
const path = require("path");
const config = require("config");

const { uploadDir, profileDir } = config;
const profilePath = path.join(".", uploadDir, profileDir);

const files = fs.readdirSync(profilePath);
for (const file of files) {
  fs.unlinkSync(path.join(profilePath, file));
}
