import { verifyToken } from "../config/jwt.js"
import { getPrismaClient } from "../config/prisma.js"
import { userSelect, serializeUser } from "../utils/userProfiles.js"

const prisma = getPrismaClient()

const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." })
    }

    const decoded = verifyToken(token)

    const session = await prisma.userSession.findUnique({
      where: {
        id: decoded.sessionId,
      },
    })

    if (!session) {
      return res.status(401).json({
        message: "Logged in on another device",
      })
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      return res.status(401).json({
        message: "Session expired",
      })
    }

    req.userId = decoded.userId

    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: userSelect,
    })

    if (!user || (typeof user.isActive === "boolean" && !user.isActive)) {
      return res
        .status(401)
        .json({ message: "Invalid token or user not found." })
    }

    req.user = {
      ...serializeUser(user),
      role: decoded.role || user.role,
    }
    next()
  } catch (error) {
    console.error("Authentication error:", error)
    res.status(401).json({ message: "Invalid token." })
  }
}

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Access denied. Please authenticate." })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
      })
    }

    next()
  }
}

export { authenticate, authorize }
