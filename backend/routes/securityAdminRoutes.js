import express from "express"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate } from "../middleware/auth.js"
import { generateId } from "../utils/hashGenerator.js"

const prisma = getPrismaClient()
const router = express.Router()

/**
 * Middleware: Verify Security Admin role
 */
const securityAdminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ code: "NO_AUTH", message: "Authentication required" })
    }

    if (req.user.role !== "admin" && req.user.role !== "security") {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Security Admin access required",
      })
    }

    next()
  } catch (error) {
    console.error("Security admin auth error:", error)
    res
      .status(500)
      .json({ code: "AUTH_ERROR", message: "Authentication error" })
  }
}

// Apply auth middleware to all routes
router.use(authenticate)
router.use(securityAdminAuth)

/**
 * GET /locations
 * Fetch all locations with stats
 */
router.get("/locations", async (req, res) => {
  try {
    const { type, isActive } = req.query

    const where = {}
    if (type) where.type = type
    if (isActive !== undefined) where.isActive = isActive === "true"

    const locations = await prisma.location.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            qrGenerationHistory: true,
            qrDownloadHistory: true,
          },
        },
      },
    })

    const enrichedLocations = locations.map((loc) => ({
      ...loc,
      qrGenerationCount: loc._count?.qrGenerationHistory || 0,
      qrDownloadCount: loc._count?.qrDownloadHistory || 0,
    }))

    res.status(200).json({
      success: true,
      data: { locations: enrichedLocations },
    })
  } catch (error) {
    console.error("Get locations error:", error)
    res.status(500).json({ code: "FETCH_ERROR", message: error.message })
  }
})

/**
 * GET /locations/:id
 * Fetch single location with history
 */
router.get("/locations/:id", async (req, res) => {
  try {
    const { id } = req.params

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        qrGenerationHistory: {
          orderBy: { generatedAt: "desc" },
          take: 10,
          include: {
            generatedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        qrDownloadHistory: {
          orderBy: { downloadedAt: "desc" },
          take: 10,
          include: {
            downloadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!location) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Location not found",
      })
    }

    res.status(200).json({ success: true, data: { location } })
  } catch (error) {
    console.error("Get location error:", error)
    res.status(500).json({ code: "FETCH_ERROR", message: error.message })
  }
})

/**
 * POST /locations
 * Create a new location
 */
router.post("/locations", async (req, res) => {
  try {
    const { name, type, code, description, latitude, longitude } = req.body

    if (!name || !code) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "Name and code are required",
      })
    }

    // Check for duplicates
    const existingLocation = await prisma.location.findFirst({
      where: {
        OR: [{ name }, { code }],
      },
    })

    if (existingLocation) {
      return res.status(409).json({
        code: "DUPLICATE",
        message: "Location with this name or code already exists",
      })
    }

    const location = await prisma.location.create({
      data: {
        id: generateId(),
        name,
        type: type || "OTHER",
        code,
        hash: Buffer.from(`${name}${Date.now()}`).toString("hex").slice(0, 64),
        description,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    })

    res.status(201).json({ success: true, data: { location } })
  } catch (error) {
    console.error("Create location error:", error)
    res.status(500).json({ code: "CREATE_ERROR", message: error.message })
  }
})

/**
 * PUT /locations/:id
 * Update location
 */
router.put("/locations/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { name, type, code, description, latitude, longitude, isActive } =
      req.body

    const location = await prisma.location.findUnique({ where: { id } })
    if (!location) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Location not found",
      })
    }

    // Check for name/code conflicts
    if (name && name !== location.name) {
      const conflict = await prisma.location.findUnique({ where: { name } })
      if (conflict) {
        return res.status(409).json({
          code: "DUPLICATE",
          message: "Location name already exists",
        })
      }
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(code && { code }),
        ...(description !== undefined && { description }),
        ...(latitude !== undefined && {
          latitude: latitude ? parseFloat(latitude) : null,
        }),
        ...(longitude !== undefined && {
          longitude: longitude ? parseFloat(longitude) : null,
        }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    res.status(200).json({ success: true, data: { location: updatedLocation } })
  } catch (error) {
    console.error("Update location error:", error)
    res.status(500).json({ code: "UPDATE_ERROR", message: error.message })
  }
})

/**
 * DELETE /locations/:id
 * Delete location (archive instead)
 */
router.delete("/locations/:id", async (req, res) => {
  try {
    const { id } = req.params

    const location = await prisma.location.findUnique({ where: { id } })
    if (!location) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Location not found",
      })
    }

    // Soft delete by marking as inactive
    const deletedLocation = await prisma.location.update({
      where: { id },
      data: { isActive: false },
    })

    res.status(200).json({
      success: true,
      message: "Location archived successfully",
      data: { location: deletedLocation },
    })
  } catch (error) {
    console.error("Delete location error:", error)
    res.status(500).json({ code: "DELETE_ERROR", message: error.message })
  }
})

/**
 * POST /qr/location/:id/generate
 * Generate and record QR code for location
 */
router.post("/qr/location/:id/generate", async (req, res) => {
  try {
    const { id: locationId } = req.params
    const { format = "PNG" } = req.body

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    })

    if (!location) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Location not found",
      })
    }

    // Build QR payload with location data
    const qrPayload = JSON.stringify({
      qrId: generateId(),
      locationId: location.id,
      locationName: location.name,
      locationType: location.type,
      latitude: location.latitude,
      longitude: location.longitude,
      qrType: "location",
      issuedAt: new Date().toISOString(),
      hash: location.hash,
    })

    // Record generation in history
    const generationRecord = await prisma.qRGenerationHistory.create({
      data: {
        id: generateId(),
        locationId,
        generatedById: req.user.id,
        qrPayload,
        qrFormat: format,
      },
    })

    // Update location generation count
    await prisma.location.update({
      where: { id: locationId },
      data: {
        qrGenerationCount: { increment: 1 },
        lastQrGeneratedAt: new Date(),
      },
    })

    res.status(200).json({
      success: true,
      data: {
        qr: {
          id: generationRecord.id,
          payload: JSON.parse(qrPayload),
          format,
          generatedAt: generationRecord.generatedAt,
        },
      },
    })
  } catch (error) {
    console.error("Generate QR error:", error)
    res.status(500).json({ code: "QR_ERROR", message: error.message })
  }
})

/**
 * GET /qr/location/:id
 * Get latest QR for location
 */
router.get("/qr/location/:id", async (req, res) => {
  try {
    const { id: locationId } = req.params

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        qrGenerationHistory: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    })

    if (!location) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Location not found",
      })
    }

    const latestQr = location.qrGenerationHistory[0]

    res.status(200).json({
      success: true,
      data: {
        qr: latestQr
          ? {
              payload: JSON.parse(latestQr.qrPayload),
              format: latestQr.qrFormat,
              generatedAt: latestQr.generatedAt,
            }
          : null,
      },
    })
  } catch (error) {
    console.error("Get QR error:", error)
    res.status(500).json({ code: "FETCH_ERROR", message: error.message })
  }
})

/**
 * POST /qr/location/:id/download
 * Track QR download
 */
router.post("/qr/location/:id/download", async (req, res) => {
  try {
    const { id: locationId } = req.params
    const { fileName, fileSize } = req.body

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    })

    if (!location) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Location not found",
      })
    }

    // Record download in history
    const downloadRecord = await prisma.qRDownloadHistory.create({
      data: {
        id: generateId(),
        locationId,
        downloadedById: req.user.id,
        fileName:
          fileName || `aegis-location-qr-${location.name}-${Date.now()}.png`,
        fileSize: fileSize || 0,
      },
    })

    // Update location download count
    await prisma.location.update({
      where: { id: locationId },
      data: {
        qrDownloadCount: { increment: 1 },
      },
    })

    res.status(200).json({
      success: true,
      message: "QR download recorded",
      data: { download: downloadRecord },
    })
  } catch (error) {
    console.error("Record download error:", error)
    res.status(500).json({ code: "RECORD_ERROR", message: error.message })
  }
})

/**
 * GET /qr/download-history
 * Get QR download history
 */
router.get("/qr/download-history", async (req, res) => {
  try {
    const { locationId, limit = 50, offset = 0 } = req.query

    const where = {}
    if (locationId) where.locationId = locationId

    const downloads = await prisma.qRDownloadHistory.findMany({
      where,
      orderBy: { downloadedAt: "desc" },
      skip: parseInt(offset),
      take: parseInt(limit),
      include: {
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        downloadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const total = await prisma.qRDownloadHistory.count({ where })

    res.status(200).json({
      success: true,
      data: {
        downloads,
        pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
      },
    })
  } catch (error) {
    console.error("Get download history error:", error)
    res.status(500).json({ code: "FETCH_ERROR", message: error.message })
  }
})

/**
 * GET /qr/generation-history
 * Get QR generation history
 */
router.get("/qr/generation-history", async (req, res) => {
  try {
    const { locationId, limit = 50, offset = 0 } = req.query

    const where = {}
    if (locationId) where.locationId = locationId

    const generations = await prisma.qRGenerationHistory.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      skip: parseInt(offset),
      take: parseInt(limit),
      include: {
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const total = await prisma.qRGenerationHistory.count({ where })

    res.status(200).json({
      success: true,
      data: {
        generations,
        pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
      },
    })
  } catch (error) {
    console.error("Get generation history error:", error)
    res.status(500).json({ code: "FETCH_ERROR", message: error.message })
  }
})

/**
 * GET /statistics/qr
 * Get QR usage statistics
 */
router.get("/statistics/qr", async (req, res) => {
  try {
    const totalLocations = await prisma.location.count()
    const activeLocations = await prisma.location.count({
      where: { isActive: true },
    })
    const totalGenerations = await prisma.qRGenerationHistory.count()
    const totalDownloads = await prisma.qRDownloadHistory.count()

    const topDownloadedLocations = await prisma.location.findMany({
      orderBy: { qrDownloadCount: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        type: true,
        qrDownloadCount: true,
        qrGenerationCount: true,
      },
    })

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalLocations,
          activeLocations,
          totalGenerations,
          totalDownloads,
        },
        topDownloadedLocations,
      },
    })
  } catch (error) {
    console.error("Get statistics error:", error)
    res.status(500).json({ code: "STATS_ERROR", message: error.message })
  }
})

export default router
