const express = require("express")
const bcrypt = require("bcryptjs")
const { getPrismaClient } = require("../config/prisma")
const { authenticate } = require("../middleware/auth")

const prisma = getPrismaClient()
const router = express.Router()

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])(?=\S+$).{8,64}$/

const getStrongPasswordError = (password) => {
  if (!password) {
    return "New password is required"
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return "Password must be 8-64 characters and include uppercase, lowercase, number, and special character (no spaces)."
  }

  return null
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  gender: true,
  department: true,
  year: true,
  hostel: true,
  roomNumber: true,
  phoneNumber: true,
  emergencyContact: true,
  profilePhoto: true,
  studentId: true,
  guardId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
}

const serializeUser = (user) => {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    _id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gender: user.gender,
    department: user.department,
    year: user.year,
    hostel: user.hostel,
    roomNumber: user.roomNumber,
    phoneNumber: user.phoneNumber,
    emergencyContact: user.emergencyContact,
    profilePhoto: user.profilePhoto,
    studentId: user.studentId,
    guardId: user.guardId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userSelect,
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    return res.status(200).json({ message: "User Found!", userData: serializeUser(user) })
  } catch (error) {
    console.log("Error: ", error)
    res.status(500).json({ message: "Server error fetching user" })
  }
})

router.put("/profile", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        name: req.body.name || undefined,
        phoneNumber: req.body.phoneNumber || undefined,
        roomNumber: req.body.roomNumber || undefined,
        email: req.body.email || undefined,
        studentId: req.body.studentId || undefined,
        hostel: req.body.hostel || undefined,
        year: req.body.year || undefined,
        department: req.body.department || undefined,
      },
      select: userSelect,
    })

    return res.status(200).json({ message: "User Data is Updated", userData: serializeUser(user) })
  } catch (error) {
    console.error("Profile update error:", error)

    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email or student ID already exists" })
    }

    return res.status(500).json({ message: "Server error updating profile" })
  }
})

router.put("/passwordUpdate", authenticate, async (req, res) => {
  try {
    const currentPassword = req.body.currentPassword || req.body?.currentPassword?.currentPassword
    const newPassword = req.body.newPassword || req.body?.currentPassword?.newPassword
    const confirmPassword = req.body.confirmPassword || req.body?.currentPassword?.confirmPassword

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: "New password and confirmation are required" })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" })
    }

    const strongPasswordError = getStrongPasswordError(newPassword)
    if (strongPasswordError) {
      return res.status(400).json({
        code: "WEAK_PASSWORD",
        message: strongPasswordError,
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (currentPassword) {
      const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!passwordMatches) {
        return res.status(400).json({ message: "Current password is incorrect" })
      }

      if (newPassword === currentPassword) {
        return res.status(400).json({ message: "New password must be different from current password" })
      }
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    })

    return res.status(200).json({ success: true, message: "Password Updated Successfully" })
  } catch (error) {
    console.error("Password update error:", error)
    return res.status(500).json({ message: "Server error updating password" })
  }
})

module.exports = router
