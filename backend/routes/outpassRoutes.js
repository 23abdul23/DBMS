const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate, authorize } = require("../middleware/auth")
const { checkOutpassExpiry } = require("../middleware/outpassExpiry")
const { generateId } = require("../utils/hashGenerator")
const {
  OUTPASS_REQUEST_TYPE,
  outpassInclude,
  getDayRange,
  resolveOutpassDateTimes,
  resolveOutpassRequestType,
  buildOutpassResponse,
  getLatestMovementMap,
  expireOldOutpasses,
  canCancelOutpass,
  validateOutpassWindow,
} = require("../utils/outpassLifecycle")

const prisma = getPrismaClient()
const router = express.Router()

router.post(
  "/generate",
  [authenticate, authorize("student")],
  async (req, res) => {
    try {
      await expireOldOutpasses(prisma)

      const reason = String(req.body.purpose || req.body.reason || "").trim()
      const destination = String(req.body.destination || "").trim()
      const requestRemarks = String(req.body.remarks || "").trim()
      const emergencyName = String(
        req.body.emergencyName || req.body.emergencyContactName || "",
      ).trim()
      const emergencyContact = String(
        req.body.emergencyContact || req.body.emergencyContactPhone || "",
      ).trim()
      const requestType = resolveOutpassRequestType(req.body)
      const { exitDate, returnDate } = resolveOutpassDateTimes(req.body)

      if (!reason || !destination || !exitDate || !returnDate) {
        return res.status(400).json({
          message:
            "Please provide purpose, destination, departure, and return time",
        })
      }

      if (!emergencyName || !emergencyContact) {
        return res
          .status(400)
          .json({ message: "Emergency contact name and phone are required" })
      }

      const validationError = validateOutpassWindow({
        exitDate,
        returnDate,
        requestType,
      })

      if (validationError) {
        return res.status(400).json({ message: validationError })
      }

      const conflictingOutpass = await prisma.outpass.findFirst({
        where: {
          userId: req.user.userId,
          status: {
            in: ["pending", "approved"],
          },
          actualReturnDate: null,
          expectedReturnDate: {
            gte: new Date(),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (conflictingOutpass) {
        return res.status(400).json({
          message: "You already have an active or pending outpass request",
        })
      }

      const logAction =
        requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
          ? "outpass_long_visit"
          : "outpass_request"
      const initialRemarks =
        requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
          ? requestRemarks ||
            "Long visit request submitted. Physical warden approval required."
          : requestRemarks || "Outpass request submitted"

      const outpass = await prisma.$transaction(async (tx) => {
        const createdOutpass = await tx.outpass.create({
          data: {
            id: generateId(),
            userId: req.user.userId,
            reason,
            destination,
            outDate: exitDate,
            expectedReturnDate: returnDate,
            emergencyContactName: emergencyName,
            emergencyContactPhone: emergencyContact,
            requestType,
            status: "pending",
          },
          include: outpassInclude,
        })

        await tx.outpassAuditTrail.create({
          data: {
            id: generateId(),
            outpassId: createdOutpass.id,
            status: "pending",
            changedBy: req.user.userId,
            changedAt: new Date(),
            remarks: initialRemarks,
          },
        })

        await tx.log.create({
          data: {
            id: generateId(),
            userId: req.user.userId,
            action: logAction,
            success: true,
            details: {
              message:
                requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
                  ? `Long visit request created for ${destination}`
                  : `Outpass requested for ${destination}`,
              outpassId: createdOutpass.id,
              requestType,
              requestedExit: exitDate.toISOString(),
              requestedReturn: returnDate.toISOString(),
            },
            scanType: "manual",
          },
        })

        return tx.outpass.findUnique({
          where: { id: createdOutpass.id },
          include: outpassInclude,
        })
      })

      res.status(201).json({
        message:
          requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
            ? "Long visit request submitted. Please visit the warden physically for approval."
            : "Outpass request submitted successfully",
        outpass: buildOutpassResponse(outpass),
      })
    } catch (error) {
      console.error("Outpass request error:", error)
      res.status(500).json({ message: "Server error creating outpass request" })
    }
  },
)

router.get(
  "/history",
  [authenticate, authorize("student"), checkOutpassExpiry],
  async (req, res) => {
    try {
      const { status, limit, requestType } = req.query
      const parsedLimit = Math.min(Number.parseInt(limit, 10) || 25, 100)

      const where = {
        userId: req.user.userId,
        ...(status && typeof status === "string" && status.trim().length > 0
          ? {
              status: status.trim().toLowerCase(),
            }
          : {}),
        ...(requestType &&
        typeof requestType === "string" &&
        requestType.trim().length > 0
          ? {
              requestType: requestType.trim().toLowerCase(),
            }
          : {}),
      }

      const outpasses = await prisma.outpass.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: parsedLimit,
        include: outpassInclude,
      })

      const movementMap = await getLatestMovementMap(
        prisma,
        outpasses.map((item) => item.userId),
      )

      res.json({
        outpasses: outpasses.map((item) =>
          buildOutpassResponse(item, {
            latestMovement: movementMap.get(item.userId),
          }),
        ),
      })
    } catch (error) {
      console.error("Outpass history fetch error:", error)
      res.status(500).json({ message: "Server error fetching outpass history" })
    }
  },
)

router.get(
  "/today",
  [authenticate, authorize("student"), checkOutpassExpiry],
  async (req, res) => {
    try {
      const { start, end } = getDayRange()

      const outpass = await prisma.outpass.findFirst({
        where: {
          userId: req.user.userId,
          OR: [
            {
              outDate: {
                gte: start,
                lt: end,
              },
            },
            {
              requestType: OUTPASS_REQUEST_TYPE.LONG_VISIT,
              status: {
                in: ["pending", "approved", "expired"],
              },
              actualReturnDate: null,
              expectedReturnDate: {
                gte: start,
              },
            },
          ],
        },
        orderBy: {
          createdAt: "desc",
        },
        include: outpassInclude,
      })

      if (!outpass) {
        return res.json({
          message: "No outpass found for today",
          outpass: null,
        })
      }

      const movementMap = await getLatestMovementMap(prisma, [req.user.userId])
      const serializedOutpass = buildOutpassResponse(outpass, {
        latestMovement: movementMap.get(req.user.userId),
      })

      res.json({
        outpass: serializedOutpass,
        isActive:
          serializedOutpass.status === "approved" &&
          !serializedOutpass.actualReturnDate,
        isOngoing: [
          "ongoing",
          "yellow_alert",
          "danger",
          "long_visit_away",
        ].includes(serializedOutpass.monitoringState),
        timeRemaining: serializedOutpass.timeRemainingMs,
        canCancel: serializedOutpass.canCancel,
        canUseOutpass: serializedOutpass.canUseOutpass,
        campusRiskLevel: serializedOutpass.campusRiskLevel,
      })
    } catch (error) {
      console.error("Today's outpass fetch error:", error)
      res.status(500).json({ message: "Server error fetching today's outpass" })
    }
  },
)

router.put(
  "/:id",
  [authenticate, authorize("student"), checkOutpassExpiry],
  async (req, res) => {
    try {
      const nextStatus = String(req.body.status || "")
        .trim()
        .toLowerCase()

      if (nextStatus !== "cancelled") {
        return res
          .status(400)
          .json({ message: "Only outpass cancellation is supported here" })
      }

      const outpass = await prisma.outpass.findFirst({
        where: {
          id: req.params.id,
          userId: req.user.userId,
        },
        include: outpassInclude,
      })

      if (!outpass) {
        return res.status(404).json({ message: "Outpass not found" })
      }

      const movementMap = await getLatestMovementMap(prisma, [req.user.userId])
      const latestMovement = movementMap.get(req.user.userId)

      if (!canCancelOutpass(outpass, latestMovement)) {
        return res.status(400).json({
          message: "This outpass can no longer be cancelled",
        })
      }

      const cancellationRemarks =
        String(req.body.remarks || "").trim() || "Cancelled by student"

      const updatedOutpass = await prisma.$transaction(async (tx) => {
        await tx.outpass.update({
          where: {
            id: outpass.id,
          },
          data: {
            status: "cancelled",
          },
        })

        await tx.outpassAuditTrail.create({
          data: {
            id: generateId(),
            outpassId: outpass.id,
            status: "cancelled",
            changedBy: req.user.userId,
            changedAt: new Date(),
            remarks: cancellationRemarks,
          },
        })

        await tx.log.create({
          data: {
            id: generateId(),
            userId: req.user.userId,
            action: "outpass_status_changed",
            success: true,
            details: {
              outpassId: outpass.id,
              requestType: outpass.requestType,
              previousStatus: outpass.status,
              nextStatus: "cancelled",
              source: "student",
            },
            scanType: "manual",
          },
        })

        return tx.outpass.findUnique({
          where: {
            id: outpass.id,
          },
          include: outpassInclude,
        })
      })

      res.json({
        message: "Outpass cancelled successfully",
        outpass: buildOutpassResponse(updatedOutpass, {
          latestMovement,
        }),
      })
    } catch (error) {
      console.error("Outpass cancellation error:", error)
      res.status(500).json({ message: "Server error cancelling outpass" })
    }
  },
)

module.exports = router
