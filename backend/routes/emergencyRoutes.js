import express from "express"
import { Prisma } from "@prisma/client"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate } from "../middleware/auth.js"
import adminAuth from "../middleware/adminAuth.js"
import { generateId } from "../utils/hashGenerator.js"

const prisma = getPrismaClient()
const router = express.Router()

const emergencyContactConfig = [
  {
    name: "Medical Emergency",
    phone: process.env.EMERGENCY_MEDICAL_PHONE || "9329594882",
    type: "medical",
  },
  {
    name: "Security Emergency",
    phone: process.env.EMERGENCY_SECURITY_PHONE || "7217492629",
    type: "security",
  },
  {
    name: "Fire Emergency",
    phone: process.env.EMERGENCY_FIRE_PHONE || "8618275578",
    type: "fire",
  },
  {
    name: "College Helpline",
    phone: process.env.EMERGENCY_OTHER_PHONE || "7909069340",
    type: "other",
  },
]

const userSelect = {
  id: true,
  name: true,
  studentId: true,
  phoneNumber: true,
  emergencyContact: true,
  hostel: true,
  roomNumber: true,
  role: true,
}

const normalizeEmergencyStatus = (status) => {
  if (!status) {
    return null
  }

  const normalized = String(status).trim().toLowerCase()
  if (normalized === "false_alarm") {
    return "resolved"
  }

  if (["active", "responded", "resolved"].includes(normalized)) {
    return normalized
  }

  return null
}

const getLocationValues = (location, fallbackLatitude, fallbackLongitude) => {
  const latitude = location?.latitude ?? fallbackLatitude
  const longitude = location?.longitude ?? fallbackLongitude
  const address = location?.address ?? location?.name ?? null

  return {
    latitude,
    longitude,
    address,
  }
}

const parseMediaItems = (media) => {
  if (!Array.isArray(media)) {
    return []
  }

  return media
    .map((item) => {
      if (typeof item === "string") {
        return {
          url: item,
          mediaType: "photo",
        }
      }

      if (!item || !item.url) {
        return null
      }

      const mediaType = item.mediaType === "audio" ? "audio" : "photo"

      return {
        url: item.url,
        mediaType,
      }
    })
    .filter(Boolean)
}

// Create emergency alert
router.post("/alert", authenticate, async (req, res) => {
  try {
    const { type, description, location, media, emergencyContactCalled } =
      req.body
    const { latitude, longitude, address } = getLocationValues(
      location,
      req.body.latitude,
      req.body.longitude,
    )

    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === null ||
      longitude === null
    ) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" })
    }

    const mediaItems = parseMediaItems(media)

    const emergency = await prisma.$transaction(async (tx) => {
      const createdEmergency = await tx.emergency.create({
        data: {
          id: generateId(),
          userId: req.user.userId,
          type,
          description: description || null,
          latitude: new Prisma.Decimal(latitude),
          longitude: new Prisma.Decimal(longitude),
          address: address || null,
        },
        include: {
          user: {
            select: userSelect,
          },
        },
      })

      if (mediaItems.length > 0) {
        await tx.emergencyMedia.createMany({
          data: mediaItems.map((item) => ({
            id: generateId(),
            emergencyId: createdEmergency.id,
            url: item.url,
            mediaType: item.mediaType,
            uploadedAt: new Date(),
          })),
        })
      }

      await tx.log.create({
        data: {
          id: generateId(),
          userId: req.user.userId,
          action: "emergency_alert",
          location: address || `${latitude}, ${longitude}`,
          success: true,
          details: {
            type,
            description,
            emergencyContactCalled: !!emergencyContactCalled,
          },
          scanType: "manual",
        },
      })

      return createdEmergency
    })

    res.status(201).json({
      message: "Emergency alert sent successfully",
      emergency: {
        id: emergency.id,
        type: emergency.type,
        description: emergency.description,
        location: {
          latitude: emergency.latitude,
          longitude: emergency.longitude,
          address: emergency.address,
        },
        media,
        emergencyContactCalled: !!emergencyContactCalled,
        status: emergency.status,
        createdAt: emergency.createdAt,
        student: {
          name: emergency.user.name,
          studentId: emergency.user.studentId,
          phoneNumber: emergency.user.phoneNumber,
          emergencyContact: emergency.user.emergencyContact,
        },
      },
    })
  } catch (error) {
    console.error("Emergency alert error:", error)
    res.status(500).json({ message: "Server error creating emergency alert" })
  }
})

// Get user's emergency history
router.get("/my-alerts", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const take = Math.min(Number.parseInt(limit, 10) || 10, 50)
    const skip = (Number.parseInt(page, 10) - 1) * take

    const emergencies = await prisma.emergency.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: {
          select: userSelect,
        },
        media: true,
      },
    })

    const total = await prisma.emergency.count({
      where: { userId: req.user.userId },
    })

    res.json({
      emergencies,
      totalPages: Math.ceil(total / take),
      currentPage: Number.parseInt(page, 10),
    })
  } catch (error) {
    console.error("Emergency history error:", error)
    res.status(500).json({ message: "Server error fetching emergency history" })
  }
})

// Get emergency history (alias for my-alerts)
router.get("/history", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const take = Math.min(Number.parseInt(limit, 10) || 10, 50)
    const skip = (Number.parseInt(page, 10) - 1) * take

    const emergencies = await prisma.emergency.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: {
          select: userSelect,
        },
        media: true,
      },
    })

    const total = await prisma.emergency.count({
      where: { userId: req.user.userId },
    })

    res.json({
      emergencies,
      totalPages: Math.ceil(total / take),
      currentPage: Number.parseInt(page, 10),
    })
  } catch (error) {
    console.error("Emergency history error:", error)
    res.status(500).json({ message: "Server error fetching emergency history" })
  }
})

// Admin: Get all active emergencies
router.get("/admin/active", [authenticate, adminAuth], async (req, res) => {
  try {
    const emergencies = await prisma.emergency.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: userSelect,
        },
        media: true,
      },
    })

    res.json({ emergencies })
  } catch (error) {
    console.error("Active emergencies fetch error:", error)
    res
      .status(500)
      .json({ message: "Server error fetching active emergencies" })
  }
})

// Admin: Get all emergencies with filters
router.get("/admin/all", [authenticate, adminAuth], async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query
    const take = Math.min(Number.parseInt(limit, 10) || 20, 100)
    const skip = (Number.parseInt(page, 10) - 1) * take
    const normalizedStatus = status ? normalizeEmergencyStatus(status) : null

    if (status && !normalizedStatus) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const emergencies = await prisma.emergency.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: {
          select: userSelect,
        },
        media: true,
      },
    })

    const total = await prisma.emergency.count({
      where: {
        ...(type ? { type } : {}),
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
    })

    res.json({
      emergencies,
      totalPages: Math.ceil(total / take),
      currentPage: Number.parseInt(page, 10),
    })
  } catch (error) {
    console.error("Admin emergencies fetch error:", error)
    res.status(500).json({ message: "Server error fetching emergencies" })
  }
})

// Admin: Update emergency status
router.put("/admin/:id/status", [authenticate, adminAuth], async (req, res) => {
  try {
    const { status, response } = req.body
    const normalizedStatus = normalizeEmergencyStatus(status)

    if (!normalizedStatus) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const emergency = await prisma.emergency.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: userSelect,
        },
        media: true,
      },
    })

    if (!emergency) {
      return res.status(404).json({ message: "Emergency not found" })
    }

    const updatedEmergency = await prisma.emergency.update({
      where: { id: req.params.id },
      data: {
        status: normalizedStatus,
        respondedById: req.user.userId,
        responseTime: new Date(),
        resolvedTime: normalizedStatus === "resolved" ? new Date() : null,
      },
      include: {
        user: {
          select: userSelect,
        },
        media: true,
      },
    })

    await prisma.log.create({
      data: {
        id: generateId(),
        userId: emergency.userId,
        action: "emergency_status_updated",
        success: true,
        details: {
          message: `Emergency marked as ${normalizedStatus} by admin${response ? `: ${response}` : ""}`,
          response: response || null,
        },
        scanType: "manual",
      },
    })

    res.json({
      message: `Emergency status updated to ${normalizedStatus}`,
      emergency: updatedEmergency,
    })
  } catch (error) {
    console.error("Emergency status update error:", error)
    res.status(500).json({ message: "Server error updating emergency status" })
  }
})

// Get emergency statistics
router.get("/admin/stats", [authenticate, adminAuth], async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, active, todayCount, byType] = await Promise.all([
      prisma.emergency.count(),
      prisma.emergency.count({ where: { status: "active" } }),
      prisma.emergency.count({ where: { createdAt: { gte: today } } }),
      prisma.emergency.groupBy({
        by: ["type"],
        _count: {
          _all: true,
        },
      }),
    ])

    res.json({
      total,
      active,
      today: todayCount,
      byType: byType.map((item) => ({
        _id: item.type,
        count: item._count._all,
      })),
    })
  } catch (error) {
    console.error("Emergency stats error:", error)
    res
      .status(500)
      .json({ message: "Server error fetching emergency statistics" })
  }
})

// Get emergency contacts
router.get("/contacts", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        emergencyContact: true,
      },
    })

    const defaultContacts = emergencyContactConfig

    const contacts = [
      ...defaultContacts,
      ...(user?.emergencyContact
        ? [
            {
              name: "Personal Emergency Contact",
              phone: user.emergencyContact,
              type: "personal",
            },
          ]
        : []),
    ]

    res.json({ contacts })
  } catch (error) {
    console.error("Emergency contacts error:", error)
    res
      .status(500)
      .json({ message: "Server error fetching emergency contacts" })
  }
})

export default router
