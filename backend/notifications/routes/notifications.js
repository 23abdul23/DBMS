import express from "express"

import { getPrismaClient } from "../../config/prisma.js"
import { authenticate, authorize } from "../../middleware/auth.js"
import {
  deactivatePushTokenController,
  savePushTokenController,
} from "../controller/notification.controller.js"
import { testHelloNotification } from "../controller/test.controller.js"

const router = express.Router()
const prisma = getPrismaClient()

router.post("/token", authenticate, savePushTokenController)
router.post("/token/deactivate", authenticate, deactivatePushTokenController)

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

      return res.json(result)
    } catch (error) {
      console.error("[API] Error in /test-hello:", error)
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to send test notification",
      })
    }
  },
)

router.get(
  "/admin/overview",
  authenticate,
  authorize("super_admin"),
  async (_req, res) => {
    try {
      const [tokenCounts, recentDeliveries, recentFailures] = await Promise.all(
        [
          prisma.pushToken.groupBy({
            by: ["status"],
            _count: {
              _all: true,
            },
          }),
          prisma.notificationDelivery.groupBy({
            by: ["status"],
            where: {
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
            _count: {
              _all: true,
            },
          }),
          prisma.notificationDelivery.findMany({
            where: {
              status: {
                in: ["FAILED", "INVALID_TOKEN"],
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            include: {
              pushToken: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
              notification: {
                select: {
                  id: true,
                  title: true,
                  message: true,
                  createdAt: true,
                },
              },
            },
            take: 15,
          }),
        ],
      )

      return res.json({
        success: true,
        tokenCounts,
        recentDeliveries,
        recentFailures,
      })
    } catch (error) {
      console.error("[Notifications] Failed to load admin overview:", error)
      return res.status(500).json({
        success: false,
        message: "Failed to load notification overview",
      })
    }
  },
)

router.get(
  "/admin/tokens",
  authenticate,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100)
      const where = {
        ...(req.query.status
          ? {
              status: String(req.query.status).trim().toUpperCase(),
            }
          : {}),
        ...(req.query.platform
          ? {
              platform: String(req.query.platform).trim().toLowerCase(),
            }
          : {}),
        ...(req.query.userId
          ? {
              userId: String(req.query.userId).trim(),
            }
          : {}),
      }

      const tokens = await prisma.pushToken.findMany({
        where,
        orderBy: [
          {
            lastSeenAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        take: limit,
      })

      return res.json({
        success: true,
        data: tokens,
      })
    } catch (error) {
      console.error("[Notifications] Failed to load token status:", error)
      return res.status(500).json({
        success: false,
        message: "Failed to load token status",
      })
    }
  },
)

router.get(
  "/admin/deliveries",
  authenticate,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100)
      const where = {
        ...(req.query.status
          ? {
              status: String(req.query.status).trim().toUpperCase(),
            }
          : {}),
        ...(req.query.userId
          ? {
              pushToken: {
                is: {
                  userId: String(req.query.userId).trim(),
                },
              },
            }
          : {}),
      }

      const deliveries = await prisma.notificationDelivery.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          notification: true,
          pushToken: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
        take: limit,
      })

      return res.json({
        success: true,
        data: deliveries,
      })
    } catch (error) {
      console.error("[Notifications] Failed to load delivery logs:", error)
      return res.status(500).json({
        success: false,
        message: "Failed to load delivery logs",
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
    const result = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.userId,
      },
      data: {
        isRead: true,
      },
    })

    if (result.count === 0) {
      return res.status(404).json({
        message: "Notification not found",
      })
    }

    return res.json({
      message: "Notification marked as read",
    })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    return res
      .status(500)
      .json({ message: "Error marking notification as read" })
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
