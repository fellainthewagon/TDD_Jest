const transporter = require("../config/emailTransporter");

async function sendAccountActivation(email, token) {
  await transporter.sendMail({
    from: "<fella@mail.com>",
    to: email,
    subject: "Account Activation",
    html: `Token is ${token}`,
  });
}

module.exports = { sendAccountActivation };
