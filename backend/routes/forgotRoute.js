const nodemailer = require("nodemailer")
const dotenv = require("dotenv")
const express = require("express")
const bcrypt = require("bcrypt")
const { getPrismaClient } = require("../config/prisma")

const prisma = getPrismaClient()
const router = express.Router()

dotenv.config()

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_ID,
    pass: process.env.GMAIL_PASSWORD,
  },
})

router.post("/", async (req, res) => {
  try {
    const { email } = req.body
    const newPassword = Math.random().toString(36).slice(-8)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    })

    const mailOptions = {
      from: process.env.GMAIL_ID,
      to: email,
      subject: "Password Reset Request",
      text: `This is your new password: ${newPassword}`,
    }

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error)
      } else {
        console.log("Email sent: " + info.response)
      }
    })

    return res.status(200).json({ message: "Password reset email sent" })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "Internal Server Error" })
  }
})

module.exports = router
