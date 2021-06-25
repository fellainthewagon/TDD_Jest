const app = require("./src/app");
const sequelize = require("./src/config/database");

sequelize.sync({ force: true });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server has been started on port: ${PORT}`));
