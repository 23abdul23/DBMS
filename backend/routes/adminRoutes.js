import express from "express"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate } from "../middleware/auth.js"
import adminAuth from "../middleware/adminAuth.js"
import { generateId } from "../utils/hashGenerator.js"

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
  createdAt: true,
  updatedAt: true,
}

const logUserSelect = {
  id: true,
  name: true,
  studentId: true,
}

const parsePage = (value, fallback) =>
  Math.max(Number.parseInt(value, 10) || fallback, 1)

// Get dashboard statistics
router.get("/dashboard/stats", [authenticate, adminAuth], async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [totalStudents, pendingOutpasses, activeEmergencies, todayLogs] =
      await Promise.all([
        prisma.user.count({ where: { role: "student" } }),
        prisma.outpass.count({ where: { status: "pending" } }),
        prisma.emergency.count({ where: { status: "active" } }),
        prisma.log.count({
          where: { createdAt: { gte: today, lt: tomorrow } },
        }),
      ])

    res.json({
      totalStudents,
      pendingOutpasses,
      activeEmergencies,
      todayLogs,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    res
      .status(500)
      .json({ message: "Server error fetching dashboard statistics" })
  }
})

// Get all users by role (SUPER_ADMIN only)
router.get("/users-by-role", [authenticate, adminAuth], async (req, res) => {
  try {
    const { role } = req.query

    if (!role) {
      return res.status(400).json({
        message: "role query parameter is required",
      })
    }

    // Validate role
    const validRoles = ["student", "warden", "security", "admin", "SUPER_ADMIN"]
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Valid roles: ${validRoles.join(", ")}`,
      })
    }

    // Don't return SUPER_ADMIN in listings
    if (role === "SUPER_ADMIN") {
      return res.json({ users: [] })
    }

    const users = await prisma.user.findMany({
      where: {
        role: role,
        // Exclude SUPER_ADMIN from all listings
        email: {
          not: "adminAegis@iiita.ac.in",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    res.json({ users })
  } catch (error) {
    console.error("Get users by role error:", error)
    res.status(500).json({ message: "Server error fetching users by role" })
  }
})

// Get all students with filters
router.get("/students", [authenticate, adminAuth], async (req, res) => {
  try {
    const { hostel, search } = req.query
    const page = parsePage(req.query.page, 1)
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100)
    const skip = (page - 1) * limit

    const students = await prisma.user.findMany({
      where: {
        role: "student",
        ...(hostel ? { hostel } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { studentId: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: limit,
      skip,
      select: userSelect,
    })

    const total = await prisma.user.count({
      where: {
        role: "student",
        ...(hostel ? { hostel } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { studentId: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    })

    res.json({
      students,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    })
  } catch (error) {
    console.error("Students fetch error:", error)
    res.status(500).json({ message: "Server error fetching students" })
  }
})

// Get student details with recent activity
router.get("/students/:id", [authenticate, adminAuth], async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect,
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found" })
    }

    const [recentLogs, recentOutpasses, recentEmergencies] = await Promise.all([
      prisma.log.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.outpass.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.emergency.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    res.json({
      student,
      recentActivity: {
        logs: recentLogs,
        outpasses: recentOutpasses,
        emergencies: recentEmergencies,
      },
    })
  } catch (error) {
    console.error("Student details error:", error)
    res.status(500).json({ message: "Server error fetching student details" })
  }
})

// Get system logs with filters
router.get("/logs", [authenticate, adminAuth], async (req, res) => {
  try {
    const { action, userId, startDate, endDate } = req.query
    const page = parsePage(req.query.page, 1)
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100)
    const skip = (page - 1) * limit

    const logs = await prisma.log.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(userId ? { userId } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        user: {
          select: logUserSelect,
        },
      },
    })

    const total = await prisma.log.count({
      where: {
        ...(action ? { action } : {}),
        ...(userId ? { userId } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
    })

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    })
  } catch (error) {
    console.error("Logs fetch error:", error)
    res.status(500).json({ message: "Server error fetching logs" })
  }
})

// Get hostel-wise statistics
router.get("/hostels/stats", [authenticate, adminAuth], async (req, res) => {
  try {
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const students = await prisma.user.findMany({
      where: { role: "student" },
      select: {
        hostel: true,
        updatedAt: true,
      },
    })

    const pendingOutpasses = await prisma.outpass.findMany({
      where: { status: "pending" },
      select: {
        user: {
          select: {
            hostel: true,
          },
        },
      },
    })

    const hostelMap = new Map()

    for (const student of students) {
      const hostelName = student.hostel || "Unknown"

      if (!hostelMap.has(hostelName)) {
        hostelMap.set(hostelName, {
          _id: hostelName,
          totalStudents: 0,
          activeStudents: 0,
          pendingOutpasses: 0,
        })
      }

      const hostelStats = hostelMap.get(hostelName)
      hostelStats.totalStudents += 1

      if (student.updatedAt >= recentCutoff) {
        hostelStats.activeStudents += 1
      }
    }

    for (const outpass of pendingOutpasses) {
      const hostelName = outpass.user?.hostel || "Unknown"

      if (!hostelMap.has(hostelName)) {
        hostelMap.set(hostelName, {
          _id: hostelName,
          totalStudents: 0,
          activeStudents: 0,
          pendingOutpasses: 0,
        })
      }

      hostelMap.get(hostelName).pendingOutpasses += 1
    }

    const hostelStats = Array.from(hostelMap.values()).sort((left, right) =>
      left._id.localeCompare(right._id),
    )

    res.json({ hostelStats })
  } catch (error) {
    console.error("Hostel stats error:", error)
    res.status(500).json({ message: "Server error fetching hostel statistics" })
  }
})

// Update student status (active/inactive)
router.put(
  "/students/:id/status",
  [authenticate, adminAuth],
  async (req, res) => {
    try {
      const { isActive } = req.body
      const nextIsActive =
        typeof isActive === "string"
          ? isActive.toLowerCase() === "true"
          : !!isActive

      const student = await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: nextIsActive },
        select: userSelect,
      })

      await prisma.log.create({
        data: {
          id: generateId(),
          userId: req.params.id,
          action: "user_status_updated",
          success: true,
          details: {
            message: `Student status updated to ${nextIsActive ? "active" : "inactive"} by admin`,
          },
          scanType: "manual",
        },
      })

      res.json({
        message: "Student status updated successfully",
        student,
      })
    } catch (error) {
      console.error("Student status update error:", error)

      if (error.code === "P2025") {
        return res.status(404).json({ message: "Student not found" })
      }

      res.status(500).json({ message: "Server error updating student status" })
    }
  },
)

export default router
