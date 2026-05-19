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
  to: "jeffreym@atdalliance.co.za", // later make dynamic
  subject: "New User Approval Required",
  html: `
    <h2>New User Registration</h2>
    <p><b>Name:</b> ${data.name}</p>
    <p><b>Email:</b> ${data.email}</p>

    <p>Approve this user:</p>

    <a href="http://localhost:3001/api/auth/approve/${data.id}?role=operator">
      ✅ Approve as Operator
    </a>

    <br/><br/>

    <a href="http://localhost:3001/api/auth/approve/${data.id}?role=manager">
      📊 Approve as Manager
    </a>

    <br/><br/>

    <a href="http://localhost:3001/api/auth/approve/${data.id}?role=admin">
      👑 Approve as Admin
    </a>

    <br/><br/>

    <a href="http://localhost:3001/api/auth/reject/${data.id}">
      ❌ Reject User
    </a>
  `,
};


  await transporter.sendMail(mailOptions);
}

module.exports = { sendApprovalEmail };