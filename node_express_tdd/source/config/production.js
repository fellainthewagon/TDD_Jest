module.exports = {
  database: {
    database: "hoaxify",
    username: "my-db-user",
    password: "fella",
    dialect: "sqlite",
    storage: "./prod-db.sqlite",
    logging: false,
  },
  mail: {
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: "roderick37@ethereal.email",
      pass: "SAXdXrqsETM9HQWYPN",
    },
  },
  uploadDir: "uploads-production",
  profileDir: "profile",
};
