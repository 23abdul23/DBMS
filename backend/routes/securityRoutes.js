const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate } = require("../middleware/auth")
const { generateId } = require("../utils/hashGenerator")
const { outpassInclude } = require("../utils/outpassLifecycle")

const prisma = getPrismaClient()
const router = express.Router()

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  studentId: true,
  hostel: true,
  roomNumber: true,
  phoneNumber: true,
  emergencyContact: true,
}

const scannedUserSelect = {
  id: true,
  name: true,
  studentId: true,
  role: true,
  hostel: true,
  roomNumber: true,
}

const buildPasskeyResponse = (passkey) => ({
  id: passkey.id,
  hash: passkey.hash,
  userId: passkey.userId,
  createdAt: passkey.createdAt,
  expiresAt: passkey.expiresAt,
  isActive: !passkey.isUsed && passkey.expiresAt > new Date(),
})

const buildOutpassSummary = (outpass) =>
  outpass
    ? {
        id: outpass.id,
        status: outpass.status,
        outDate: outpass.outDate,
        expectedReturnDate: outpass.expectedReturnDate,
        actualReturnDate: outpass.actualReturnDate,
      }
    : null

const getResolvedAction = async (userId, action) => {
  const allowedActions = new Set(["entry", "exit"])

  if (action && allowedActions.has(action)) {
    return action
  }

  const previousLog = await prisma.log.findFirst({
    where: {
      userId,
      action: {
        in: ["entry", "exit"],
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return previousLog?.action === "entry" ? "exit" : "entry"
}

const findScannedUser = async ({ userId, studentId, hash }) => {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: scannedUserSelect,
    })

    if (user) {
      return user
    }
  }

  if (studentId) {
    const user = await prisma.user.findFirst({
      where: { studentId: String(studentId) },
      select: scannedUserSelect,
    })

    if (user) {
      return user
    }
  }

  if (hash) {
    const passkey = await prisma.passkey.findFirst({
      where: {
        hash: String(hash),
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: scannedUserSelect,
        },
      },
    })

    return passkey?.user || null
  }

  return null
}

const resolveLinkedOutpass = async ({ scannedUser, action, timestamp, changedBy }) => {
  if (scannedUser.role !== "student" || !["entry", "exit"].includes(action)) {
    return null
  }

  const candidateOutpass = await prisma.outpass.findFirst({
    where: {
      userId: scannedUser.id,
      status: {
        in: ["approved", "expired"],
      },
      actualReturnDate: null,
      outDate: {
        lte: timestamp,
      },
    },
    orderBy: [{ outDate: "desc" }, { createdAt: "desc" }],
    include: outpassInclude,
  })

  if (!candidateOutpass) {
    return null
  }

  if (action === "entry") {
    return prisma.$transaction(async (tx) => {
      await tx.outpass.update({
        where: {
          id: candidateOutpass.id,
        },
        data: {
          actualReturnDate: timestamp,
        },
      })

      await tx.outpassAuditTrail.create({
        data: {
          id: generateId(),
          outpassId: candidateOutpass.id,
          status: candidateOutpass.status,
          changedBy,
          changedAt: timestamp,
          remarks:
            candidateOutpass.status === "expired"
              ? "Student returned to campus after the outpass window had expired"
              : "Student returned to campus",
        },
      })

      return tx.outpass.findUnique({
        where: {
          id: candidateOutpass.id,
        },
        include: outpassInclude,
      })
    })
  }

  await prisma.outpassAuditTrail.create({
    data: {
      id: generateId(),
      outpassId: candidateOutpass.id,
      status: candidateOutpass.status,
      changedBy,
      changedAt: timestamp,
      remarks: "Student exited campus using an approved outpass",
    },
  })

  return candidateOutpass
}

const createMovementLog = async ({ scannedUser, action, location, guardId, guardName, scannedByUserId }) => {
  const resolvedAction = await getResolvedAction(scannedUser.id, action)
  const timestamp = new Date()

  const log = await prisma.log.create({
    data: {
      id: generateId(),
      userId: scannedUser.id,
      action: resolvedAction,
      location: location || null,
      guardId: guardId || null,
      guardName: guardName || null,
      success: true,
      details: {
        message: "Security log created successfully",
        scannedUserId: scannedUser.id,
        scannedStudentId: scannedUser.studentId || null,
        scannedUserName: scannedUser.name,
        scannedByUserId,
      },
      scanType: "qr",
    },
  })

  const linkedOutpass = await resolveLinkedOutpass({
    scannedUser,
    action: resolvedAction,
    timestamp,
    changedBy: scannedByUserId,
  })

  return {
    log,
    outpass: linkedOutpass,
  }
}

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

    await prisma.passkey.update({
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
        success: true,
        details: {
          message: `Passkey validated at ${location || "unknown location"}`,
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
      passkey: buildPasskeyResponse(passkey),
      timestamp: new Date(),
    })
  } catch (error) {
    console.error("Passkey validation error:", error)
    res.status(500).json({ message: "Server error validating passkey" })
  }
})

router.post("/log", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "security") {
      return res.status(403).json({
        message: "Only security staff can scan student QR codes.",
      })
    }

    const { action, location, guardId, guardName, userId, studentId, hash } = req.body
    const scannedUser = await findScannedUser({ userId, studentId, hash })

    if (!scannedUser) {
      return res.status(400).json({
        message: "Invalid QR data. Unable to identify scanned student.",
      })
    }

    const { log, outpass } = await createMovementLog({
      scannedUser,
      action,
      location,
      guardId: req.user.guardId || guardId || null,
      guardName: req.user.name || guardName || null,
      scannedByUserId: req.user.userId,
    })

    res.status(200).json({
      message: "Security log created successfully",
      log,
      user: scannedUser,
      outpass: buildOutpassSummary(outpass),
    })
  } catch (error) {
    console.error("Security log error:", error)
    res.status(500).json({ message: "Server error creating security log" })
  }
})

router.post("/student-log", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can log movement from a guard location QR.",
      })
    }

    const { action, location, guardId, guardName } = req.body
    const normalizedLocation = typeof location === "string" ? location.trim() : ""
    const normalizedGuardId = typeof guardId === "string" ? guardId.trim() : ""
    const normalizedGuardName = typeof guardName === "string" ? guardName.trim() : ""

    if (!normalizedLocation && !normalizedGuardId && !normalizedGuardName) {
      return res.status(400).json({
        message: "Invalid guard QR data. Missing location or guard details.",
      })
    }

    let matchedGuard = null

    if (normalizedGuardId) {
      matchedGuard = await prisma.user.findFirst({
        where: {
          guardId: normalizedGuardId,
          role: "security",
        },
        select: {
          id: true,
          name: true,
          guardId: true,
        },
      })

      if (!matchedGuard) {
        return res.status(400).json({
          message: "Invalid guard QR data. Guard not found.",
        })
      }
    }

    const scannedUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: scannedUserSelect,
    })

    if (!scannedUser) {
      return res.status(404).json({ message: "Student not found." })
    }

    const { log, outpass } = await createMovementLog({
      scannedUser,
      action,
      location: normalizedLocation || null,
      guardId: matchedGuard?.guardId || normalizedGuardId || null,
      guardName: matchedGuard?.name || normalizedGuardName || null,
      scannedByUserId: req.user.userId,
    })

    res.status(200).json({
      message: "Student movement logged successfully",
      log,
      user: scannedUser,
      outpass: buildOutpassSummary(outpass),
    })
  } catch (error) {
    console.error("Student movement log error:", error)
    res.status(500).json({ message: "Server error creating student movement log" })
  }
})

router.get("/logs", authenticate, async (req, res) => {
  try {
    const { location } = req.query

    const logs = await prisma.log.findMany({
      where: {
        ...(location && location.trim().length > 0
          ? {
              location: {
                contains: location.trim(),
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            studentId: true,
            role: true,
            hostel: true,
            roomNumber: true,
          },
        },
      },
    })

    res.status(200).json({ logs })
  } catch (error) {
    console.error("Fetch security logs error:", error)
    res.status(500).json({ message: "Server error fetching security logs" })
  }
})

module.exports = router
