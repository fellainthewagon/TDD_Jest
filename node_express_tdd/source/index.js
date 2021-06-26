const app = require("./src/app");
const sequelize = require("./src/config/database");
const User = require("./src/user/User");

async function addUsers(activeUserCount, inactiveUserCount = 0) {
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount,
    });
  }
}

sequelize.sync({ force: true }).then(async () => {
  await addUsers(25);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server has been started on port: ${PORT}`));
