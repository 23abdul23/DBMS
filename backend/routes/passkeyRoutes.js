const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate } = require("../middleware/auth")
const { generatePasskeyHash, generateId } = require("../utils/hashGenerator")

const prisma = getPrismaClient()
const router = express.Router()

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
}

const buildPasskeyResponse = (passkey) => ({
  id: passkey.id,
  hash: passkey.hash,
  userId: passkey.userId,
  createdAt: passkey.createdAt,
  expiresAt: passkey.expiresAt,
  isActive: !passkey.isUsed && passkey.expiresAt > new Date(),
})

const getTodayRange = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return { today, tomorrow }
}

const createDailyPasskey = async (userId) => {
  const { today, tomorrow } = getTodayRange()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      studentId: true,
      guardId: true,
      email: true,
    },
  })

  if (!user) {
    return null
  }

  const existingPasskey = await prisma.passkey.findFirst({
    where: {
      userId: user.id,
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  })

  if (existingPasskey) {
    return existingPasskey
  }

  return prisma.passkey.create({
    data: {
      id: generateId(),
      userId: user.id,
      hash: generatePasskeyHash(user.id, user.studentId || user.guardId || user.email, today),
      date: today,
      expiresAt: tomorrow,
    },
  })
}

router.get("/today", authenticate, async (req, res) => {
  try {
    const { today } = getTodayRange()

    await prisma.passkey.deleteMany({
      where: {
        userId: req.user.userId,
        createdAt: {
          lt: today,
        },
      },
    })

    const passkey = await createDailyPasskey(req.user.userId)

    if (!passkey) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ passkey: buildPasskeyResponse(passkey) })
  } catch (error) {
    if (error.code === "P2002") {
      console.error("Duplicate passkey hash detected:", error.meta?.target)
      return res.status(400).json({ message: "Unable to generate a unique passkey" })
    }

    console.error("Passkey fetch error:", error)
    res.status(500).json({ message: "Server error fetching passkey" })
  }
})

router.get("/todayGuard", authenticate, async (req, res) => {
  try {
    const { today } = getTodayRange()

    await prisma.passkey.deleteMany({
      where: {
        userId: req.user.userId,
        createdAt: {
          lt: today,
        },
      },
    })

    const passkey = await createDailyPasskey(req.user.userId)

    if (!passkey) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ passkey: buildPasskeyResponse(passkey) })
  } catch (error) {
    if (error.code === "P2002") {
      console.error("Duplicate passkey hash detected:", error.meta?.target)
      return res.status(400).json({ message: "Unable to generate a unique passkey" })
    }

    console.error("Passkey fetch error:", error)
    res.status(500).json({ message: "Server error fetching passkey" })
  }
})

router.post("/validate", authenticate, async (req, res) => {
  try {
    const { hash, location } = req.body

    if (!hash) {
      return res.status(400).json({ message: "Passkey hash is required" })
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        hash,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: userSelect,
        },
      },
    })

    if (!passkey) {
      return res.status(400).json({ message: "Invalid or expired passkey" })
    }

    const updatedPasskey = await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        isUsed: true,
      },
    })

    await prisma.log.create({
      data: {
        id: generateId(),
        userId: passkey.userId,
        action: "scan_attempt",
        location: location || null,
        guardId: req.user.guardId || null,
        guardName: req.user.name || null,
        success: true,
        details: {
          message: `Passkey validated at ${location || "unknown location"}`,
          passkeyId: passkey.id,
        },
        scanType: "manual",
      },
    })

    res.json({
      message: "Passkey validated successfully",
      student: {
        name: passkey.user.name,
        studentId: passkey.user.studentId,
        hostel: passkey.user.hostel,
        roomNumber: passkey.user.roomNumber,
      },
      passkey: buildPasskeyResponse(updatedPasskey),
      timestamp: new Date(),
    })
  } catch (error) {
    console.error("Passkey validation error:", error)
    res.status(500).json({ message: "Server error validating passkey" })
  }
})

router.get("/history", authenticate, async (req, res) => {
  try {
    const passkeys = await prisma.passkey.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    })

    res.json({ passkeys: passkeys.map(buildPasskeyResponse) })
  } catch (error) {
    console.error("Passkey history error:", error)
    res.status(500).json({ message: "Server error fetching passkey history" })
  }
})

module.exports = router
