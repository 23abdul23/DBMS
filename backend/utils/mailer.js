import nodemailer from "nodemailer"

let transporter

export const getMailTransporter = () => {
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

export const sendMail = async ({ from, ...mailOptions }) => {
  const mailTransporter = getMailTransporter()

  return mailTransporter.sendMail({
    from: from || process.env.GMAIL_ID,
    ...mailOptions,
  })
}
