import express from "express"
import { authenticate, authorize } from "../../middleware/auth.js"
import { savePushTokenController } from "../controller/notification.controller.js"
import { testHelloNotification } from "../controller/test.controller.js"
import { getPrismaClient } from "../../config/prisma.js"

const router = express.Router()
const prisma = getPrismaClient()

router.post("/token", authenticate, savePushTokenController)

router.post(
  "/test-hello",
  authenticate,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { studentId } = req.body

      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: "studentId is required",
        })
      }

      const result = await testHelloNotification(studentId)

      if (!result.success) {
        return res.status(400).json(result)
      }

      res.json(result)
    } catch (error) {
      console.error("[API] Error in /test-hello:", error)
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send test notification",
      })
    }
  },
)

router.get("/", authenticate, async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100)
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
    const skip = (page - 1) * limit

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip,
    })

    const total = await prisma.notification.count({
      where: {
        userId: req.user.userId,
      },
    })

    res.json({
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    res.status(500).json({ message: "Error fetching notifications" })
  }
})

router.patch("/:id/read", authenticate, async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: {
        id: req.params.id,
      },
      data: {
        isRead: true,
      },
    })

    res.json({
      message: "Notification marked as read",
      data: notification,
    })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    res.status(500).json({ message: "Error marking notification as read" })
  }
})

router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.userId,
        isRead: false,
      },
    })

    res.json({
      unreadCount,
    })
  } catch (error) {
    console.error("Error fetching unread count:", error)
    res.status(500).json({ message: "Error fetching unread count" })
  }
})

export default router
