const transporter = require("../config/emailTransporter");
const nodemailer = require("nodemailer");

async function sendAccountActivation(email, token) {
  const info = await transporter.sendMail({
    from: "<fella@mail.com>",
    to: email,
    subject: "Account Activation",
    html: `
      <div>
        <b>Please click below link to activate your account</b>
      </div>
      <div>
        <a href="http://localhost:8080/#/login?token=${token}">Activate...</a>
      </div>
    `,
  });
  if (process.env.NODE_ENV === "development") {
    console.log(`url: ${nodemailer.getTestMessageUrl(info)}`);
  }
}

module.exports = { sendAccountActivation };
