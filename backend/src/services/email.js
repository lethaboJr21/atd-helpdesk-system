const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendApprovalEmail(data) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "manager@company.com", // 🔥 replace dynamically later
    subject: "Production Alert - Approval Needed",
    html: `
      <h3>Production Log Alert</h3>
      <p><b>Hour:</b> ${data.hour}</p>
      <p><b>Problem:</b> ${data.problem}</p>
      <p><b>NG:</b> ${data.ng_pcs}</p>
      <p><b>Scrap:</b> ${data.scrap_desc}</p>
      <p>Please review this request.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendApprovalEmail };