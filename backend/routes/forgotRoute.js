import dotenv from "dotenv"
import express from "express"
import bcrypt from "bcryptjs"
import { getPrismaClient } from "../config/prisma.js"
import { sendMail } from "../utils/mailer.js"

const prisma = getPrismaClient()
const router = express.Router()

dotenv.config()

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

    await sendMail({
      to: email,
      subject: "Password Reset Request",
      text: `This is your new password: ${newPassword}`,
    })

    return res.status(200).json({ message: "Password reset email sent" })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "Internal Server Error" })
  }
})

export default router
