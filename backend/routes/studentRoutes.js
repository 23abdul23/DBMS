import express from "express"
import bcrypt from "bcryptjs"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate } from "../middleware/auth.js"
import { userSelect, serializeUser } from "../utils/userProfiles.js"
import { sendMail } from "../utils/mailer.js"
import {
  PASSWORD_OTP_EXPIRY_SECONDS,
  cleanupExpiredPasswordOtps,
  createPasswordOtpRecord,
  generatePasswordOtp,
  hashPasswordOtp,
} from "../utils/passwordOtp.js"

const prisma = getPrismaClient()
const router = express.Router()

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])(?=\S+$).{8,64}$/

const getStrongPasswordError = (password) => {
  if (!password) {
    return "New password is required"
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return "Password must be 8-64 characters and include uppercase, lowercase, number, and special character (no spaces)."
  }

  return null
}

const requireStudent = (req, res) => {
  if (req.user?.role !== "student") {
    res
      .status(403)
      .json({ message: "Only students can use OTP password verification" })
    return false
  }

  return true
}

const STUDENT_LOG_ACTIONS = [
  "entry",
  "exit",
  "without_outpass",
  "outpass_request",
  "outpass_long_visit",
  "outpass_used",
  "outpass_status_changed",
  "sac_room_opened",
  "sac_room_joined",
  "sac_room_left",
  "sac_equipment_taken",
  "sac_equipment_returned",
  "library_seat_taken",
  "library_seat_released",
]

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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

    return res
      .status(200)
      .json({ message: "User Found!", userData: serializeUser(user) })
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
        studentProfile:
          req.body.studentId ||
          req.body.hostel ||
          req.body.roomNumber ||
          req.body.year ||
          req.body.department
            ? {
                upsert: {
                  create: {
                    studentId: req.body.studentId,
                    hostel: req.body.hostel,
                    roomNumber: req.body.roomNumber || null,
                    year: req.body.year,
                    department: req.body.department,
                  },
                  update: {
                    studentId: req.body.studentId || undefined,
                    hostel: req.body.hostel || undefined,
                    roomNumber: req.body.roomNumber || undefined,
                    year: req.body.year || undefined,
                    department: req.body.department || undefined,
                  },
                },
              }
            : undefined,
      },
      select: userSelect,
    })

    return res
      .status(200)
      .json({ message: "User Data is Updated", userData: serializeUser(user) })
  } catch (error) {
    console.error("Profile update error:", error)

    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ message: "Email or student ID already exists" })
    }

    return res.status(500).json({ message: "Server error updating profile" })
  }
})

router.post("/password-update/request-otp", authenticate, async (req, res) => {
  try {
    if (!requireStudent(req, res)) {
      return
    }

    const { newPassword, confirmPassword } = req.body

    if (!newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "New password and confirmation are required" })
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
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!user.email) {
      return res
        .status(400)
        .json({ message: "Student email is missing from the profile" })
    }

    const isCurrentPassword = await bcrypt.compare(
      newPassword,
      user.passwordHash,
    )
    if (isCurrentPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      })
    }

    await cleanupExpiredPasswordOtps(prisma)
    await prisma.passwordUpdateOtp.deleteMany({
      where: {
        userId: user.id,
      },
    })

    const otp = generatePasswordOtp()
    const pendingPasswordHash = await bcrypt.hash(newPassword, 10)

    const otpRecord = await createPasswordOtpRecord(prisma, {
      userId: user.id,
      otp,
      pendingPasswordHash,
    })

    try {
      await sendMail({
        to: user.email,
        subject: "Aegis Password Update OTP",
        text: `Your Aegis password update OTP is ${otp}. It will expire in ${PASSWORD_OTP_EXPIRY_SECONDS} seconds.`,
      })
    } catch (mailError) {
      await prisma.passwordUpdateOtp.delete({
        where: {
          id: otpRecord.id,
        },
      })

      console.error("Password OTP email error:", mailError)
      return res.status(500).json({ message: "Failed to send OTP email" })
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${user.email}`,
      expiresInSeconds: PASSWORD_OTP_EXPIRY_SECONDS,
    })
  } catch (error) {
    console.error("Password OTP request error:", error)
    return res
      .status(500)
      .json({ message: "Server error requesting password OTP" })
  }
})

router.post("/password-update/verify-otp", authenticate, async (req, res) => {
  try {
    if (!requireStudent(req, res)) {
      return
    }

    const otp = String(req.body?.otp || "").trim()
    if (!otp) {
      return res.status(400).json({ message: "OTP is required" })
    }

    await cleanupExpiredPasswordOtps(prisma)

    const otpRecord = await prisma.passwordUpdateOtp.findFirst({
      where: {
        userId: req.user.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    if (!otpRecord) {
      return res.status(400).json({ message: "OTP expired or not found" })
    }

    if (hashPasswordOtp(otp) !== otpRecord.otpHash) {
      return res.status(400).json({ message: "Invalid OTP" })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: req.user.userId,
        },
        data: {
          passwordHash: otpRecord.pendingPasswordHash,
        },
      }),
      prisma.passwordUpdateOtp.delete({
        where: {
          id: otpRecord.id,
        },
      }),
    ])

    return res.status(200).json({
      success: true,
      message: "Password Updated Successfully",
    })
  } catch (error) {
    console.error("Password OTP verification error:", error)
    return res
      .status(500)
      .json({ message: "Server error verifying password OTP" })
  }
})

router.put("/passwordUpdate", authenticate, async (req, res) => {
  try {
    if (req.user?.role === "student") {
      return res
        .status(400)
        .json({ message: "Students must verify an OTP to update password" })
    }

    const currentPassword =
      req.body.currentPassword || req.body?.currentPassword?.currentPassword
    const newPassword =
      req.body.newPassword || req.body?.currentPassword?.newPassword
    const confirmPassword =
      req.body.confirmPassword || req.body?.currentPassword?.confirmPassword

    if (!newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "New password and confirmation are required" })
    }

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" })
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

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    )
    if (!passwordMatches) {
      return res.status(400).json({ message: "Current password is incorrect" })
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      })
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    })

    return res
      .status(200)
      .json({ success: true, message: "Password Updated Successfully" })
  } catch (error) {
    console.error("Password update error:", error)
    return res.status(500).json({ message: "Server error updating password" })
  }
})

router.get("/logs", authenticate, async (req, res) => {
  try {
    if (!requireStudent(req, res)) {
      return
    }

    const page = parsePositiveInteger(req.query.page, 1)
    const limit = Math.min(parsePositiveInteger(req.query.limit, 20), 100)
    const skip = (page - 1) * limit

    const where = {
      userId: req.user.userId,
      action: {
        in: STUDENT_LOG_ACTIONS,
      },
    }

    const [logs, total] = await prisma.$transaction([
      prisma.log.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      prisma.log.count({ where }),
    ])

    return res.status(200).json({
      logs,
      page,
      limit,
      total,
      hasMore: skip + logs.length < total,
    })
  } catch (error) {
    console.error("Student logs error:", error)
    return res
      .status(500)
      .json({ message: "Server error fetching student logs" })
  }
})

export default router
