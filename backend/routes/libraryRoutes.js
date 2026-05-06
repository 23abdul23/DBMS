import express from "express"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate, authorize } from "../middleware/auth.js"
import {
  getLibraryLimit,
  isLibOpenAt,
  LIB_CLOSE_LABEL,
} from "../utils/campusActivityRules.js"
import {
  getActiveSeatSession,
  getSeatSessionByNumber,
  getLibraryOverview,
  claimLibrarySeat,
  releaseLibrarySeat,
} from "../utils/libraryActivity.js"
import { isLibraryAdministrator } from "../utils/adminScopes.js"

const prisma = getPrismaClient()
const router = express.Router()

const getLibraryClosedMessage = () =>
  `Library is closed for new entry. It remains open till ${LIB_CLOSE_LABEL}.`

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

router.get("/status", authenticate, async (req, res) => {
  try {
    if (!isLibOpenAt()) {
      return res.status(403).json({
        message: getLibraryClosedMessage(),
        code: "LIBRARY_CLOSED",
        status: false,
        closesAt: LIB_CLOSE_LABEL,
      })
    }

    return res.status(200).json({
      message: `Library is open till ${LIB_CLOSE_LABEL}.`,
      code: "LIBRARY_OPEN",
      status: true,
      closesAt: LIB_CLOSE_LABEL,
    })
  } catch (error) {
    console.error("Library status error:", error)
    return res.status(500).json({
      code: "LIBRARY_STATUS_ERROR",
      message: "Server error fetching library status",
      status: false,
    })
  }
})

router.get("/overview", authenticate, async (req, res) => {
  try {
    const overview = await getLibraryOverview(prisma, req.user)
    res.json({ overview })
  } catch (error) {
    console.error("Library overview error:", error)
    res.status(500).json({ message: "Server error fetching library overview" })
  }
})

router.post(
  "/claim-seat",
  [authenticate, authorize("student")],
  async (req, res) => {
    try {
      const seatNumber = parseSeatNumber(req.body?.seatNumber)
      const limit = getLibraryLimit()

      if (
        !Number.isInteger(seatNumber) ||
        seatNumber < 1 ||
        seatNumber > limit
      ) {
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

      if (!isLibOpenAt()) {
        return res.status(403).json({
          code: "LIBRARY_CLOSED",
          message: getLibraryClosedMessage(),
          closesAt: LIB_CLOSE_LABEL,
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
  },
)

router.post(
  "/release-seat",
  [authenticate, authorize("student")],
  async (req, res) => {
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
          throw createHttpError(
            404,
            "No active library token to release.",
            "NO_ACTIVE_SEAT",
          )
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
  },
)

router.post("/admin/release-seat", authenticate, async (req, res) => {
  try {
    if (!isLibraryAdministrator(req.user)) {
      return res
        .status(403)
        .json({ message: "Only library admin can release seats." })
    }

    const sessionId = String(req.body?.sessionId || "").trim()
    const userId = String(req.body?.userId || "").trim()
    const seatNumber =
      req.body?.seatNumber !== undefined
        ? parseSeatNumber(req.body?.seatNumber)
        : NaN

    let activeSeat = null

    if (sessionId) {
      activeSeat = await prisma.librarySeatSession.findFirst({
        where: {
          id: sessionId,
          leftAt: null,
        },
        include: {
          user: true,
        },
      })
    } else if (userId) {
      activeSeat = await getActiveSeatSession(prisma, userId)
    } else if (Number.isInteger(seatNumber)) {
      activeSeat = await getSeatSessionByNumber(prisma, seatNumber)
    } else {
      return res.status(400).json({
        message: "Provide sessionId, userId, or seatNumber to release a seat.",
      })
    }

    if (!activeSeat) {
      return res
        .status(404)
        .json({ message: "No active library seat found for this request." })
    }

    const timestamp = new Date()
    await prisma.$transaction(async (tx) => {
      const currentSeat = await tx.librarySeatSession.findFirst({
        where: {
          id: activeSeat.id,
          leftAt: null,
        },
      })

      if (!currentSeat) {
        throw createHttpError(
          404,
          "No active library seat found for this request.",
          "NO_ACTIVE_SEAT",
        )
      }

      await releaseLibrarySeat(tx, {
        session: currentSeat,
        timestamp,
        description: `Library admin released Token Number ${activeSeat.seatNumber} for ${activeSeat.user?.name || "student"}.`,
        details: {
          source: "library_admin_release",
          releasedByUserId: req.user.userId,
          releasedForUserId: activeSeat.userId,
          releasedForStudentId: activeSeat.user?.studentId || null,
        },
      })
    })

    const overview = await getLibraryOverview(prisma, req.user)
    res.json({
      message: `Token Number ${activeSeat.seatNumber} released for ${activeSeat.user?.name || "student"}.`,
      overview,
    })
  } catch (error) {
    console.error("Library admin release seat error:", error)
    res.status(error.statusCode || 500).json({
      code: error.code || "LIBRARY_ADMIN_RELEASE_ERROR",
      message: error.message || "Server error releasing library seat",
    })
  }
})

export default router
