const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate, authorize } = require("../middleware/auth")
const { getLibraryLimit } = require("../utils/campusActivityRules")
const {
  getActiveSeatSession,
  getSeatSessionByNumber,
  getLibraryOverview,
  claimLibrarySeat,
  releaseLibrarySeat,
} = require("../utils/libraryActivity")

const prisma = getPrismaClient()
const router = express.Router()

const createHttpError = (statusCode, message, code) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

const parseSeatNumber = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : NaN
}

router.get("/overview", authenticate, async (req, res) => {
  try {
    const overview = await getLibraryOverview(prisma, req.user)
    res.json({ overview })
  } catch (error) {
    console.error("Library overview error:", error)
    res.status(500).json({ message: "Server error fetching library overview" })
  }
})

router.post("/claim-seat", [authenticate, authorize("student")], async (req, res) => {
  try {
    const seatNumber = parseSeatNumber(req.body?.seatNumber)
    const limit = getLibraryLimit()

    if (!Number.isInteger(seatNumber) || seatNumber < 1 || seatNumber > limit) {
      return res.status(400).json({
        code: "INVALID_SEAT",
        message: `Seat number must be between 1 and ${limit}.`,
      })
    }

    const activeSeat = await getActiveSeatSession(prisma, req.user.userId)
    if (activeSeat) {
      if (activeSeat.seatNumber === seatNumber) {
        const overview = await getLibraryOverview(prisma, req.user)
        return res.json({
          code: "ALREADY_SEATED",
          message: `You already have Token Number ${seatNumber}.`,
          overview,
        })
      }

      return res.status(409).json({
        code: "ALREADY_SEATED",
        message: `You already have Token Number ${activeSeat.seatNumber}. Release it before choosing another seat.`,
      })
    }

    const seatSession = await getSeatSessionByNumber(prisma, seatNumber)
    if (seatSession) {
      return res.status(409).json({
        code: "SEAT_TAKEN",
        message: "Seat already taken, choose another seat.",
      })
    }

    const currentOverview = await getLibraryOverview(prisma, req.user)
    if (currentOverview.summary.isFull) {
      return res.status(409).json({
        code: "LIBRARY_FULL",
        message: "Library full.",
      })
    }

    const timestamp = new Date()
    await prisma.$transaction(async (tx) => {
      await claimLibrarySeat(tx, {
        userId: req.user.userId,
        seatNumber,
        timestamp,
        details: {
          source: "library_claim",
          claimedByUserId: req.user.userId,
        },
      })
    })

    const overview = await getLibraryOverview(prisma, req.user)
    res.json({
      message: `Token Number ${seatNumber} assigned successfully.`,
      overview,
    })
  } catch (error) {
    console.error("Library claim seat error:", error)

    if (error?.code === "P2002") {
      return res.status(409).json({
        code: "SEAT_TAKEN",
        message: "Seat already taken, choose another seat.",
      })
    }

    res.status(error.statusCode || 500).json({
      code: error.code || "LIBRARY_CLAIM_ERROR",
      message: error.message || "Server error claiming library seat",
    })
  }
})

router.post("/release-seat", [authenticate, authorize("student")], async (req, res) => {
  try {
    const activeSeat = await getActiveSeatSession(prisma, req.user.userId)

    if (!activeSeat) {
      const overview = await getLibraryOverview(prisma, req.user)
      return res.json({
        code: "NO_ACTIVE_SEAT",
        message: "No active library token to release.",
        overview,
      })
    }

    const timestamp = new Date()
    await prisma.$transaction(async (tx) => {
      const currentSeat = await getActiveSeatSession(tx, req.user.userId)
      if (!currentSeat) {
        throw createHttpError(404, "No active library token to release.", "NO_ACTIVE_SEAT")
      }

      await releaseLibrarySeat(tx, {
        session: currentSeat,
        timestamp,
        details: {
          source: "library_release",
          releasedByUserId: req.user.userId,
        },
      })
    })

    const overview = await getLibraryOverview(prisma, req.user)
    res.json({
      message: `Token Number ${activeSeat.seatNumber} released successfully.`,
      overview,
    })
  } catch (error) {
    console.error("Library release seat error:", error)
    res.status(error.statusCode || 500).json({
      code: error.code || "LIBRARY_RELEASE_ERROR",
      message: error.message || "Server error releasing library seat",
    })
  }
})

module.exports = router
