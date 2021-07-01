const app = require("./src/app");
const sequelize = require("./src/config/database");
const TokenService = require("./src/auth/TokenService");
const logger = require("./src/shared/logger");

sequelize.sync();

TokenService.scheduleCleanup();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  logger.info(`app is running. Version: ${process.env.npm_package_version}`)
);
