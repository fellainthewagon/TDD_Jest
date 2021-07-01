const app = require("./src/app");
const sequelize = require("./src/config/database");
const TokenService = require("./src/auth/TokenService");

sequelize.sync();

TokenService.scheduleCleanup();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server has been started on port: ${PORT}`));
