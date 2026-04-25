const nodemailer = require("nodemailer")

let transporter

const getMailTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_ID,
        pass: process.env.GMAIL_PASSWORD,
      },
    })
  }

  return transporter
}

const sendMail = async ({ from, ...mailOptions }) => {
  const mailTransporter = getMailTransporter()

  return mailTransporter.sendMail({
    from: from || process.env.GMAIL_ID,
    ...mailOptions,
  })
}

module.exports = {
  getMailTransporter,
  sendMail,
}
