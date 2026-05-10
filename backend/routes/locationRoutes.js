import express from "express"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate } from "../middleware/auth.js"

const prisma = getPrismaClient()
const router = express.Router()

// GET /locations/active
// Returns active fixed locations with coordinates
router.get("/active", authenticate, async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        code: true,
        latitude: true,
        longitude: true,
        description: true,
      },
    })

    return res.json({ locations })
  } catch (error) {
    console.error("Error fetching locations:", error)
    return res.status(500).json({ message: "Server error fetching locations" })
  }
})

export default router
