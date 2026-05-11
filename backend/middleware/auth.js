import { verifyToken } from "../config/jwt.js"
import { getPrismaClient } from "../config/prisma.js"
import { userSelect, serializeUser } from "../utils/userProfiles.js"

const prisma = getPrismaClient()

const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({
        code: "NO_TOKEN",
        message: "Access denied. No token provided.",
      })
    }

    const decoded = verifyToken(token)

    const session = await prisma.userSession.findUnique({
      where: {
        id: decoded.sessionId,
      },
    })

    if (!session) {
      return res.status(401).json({
        code: "SESSION_REVOKED",
        message:
          "Your session is no longer valid. You have logged in from another device.",
      })
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.userSession
        .delete({
          where: {
            id: session.id,
          },
        })
        .catch(() => {})

      return res.status(401).json({
        code: "TOKEN_EXPIRED",
        message: "Session has expired. Please log in again.",
      })
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: userSelect,
    })

    if (!user) {
      return res.status(401).json({
        code: "USER_NOT_FOUND",
        message: "User not found.",
      })
    }

    if (typeof user.isActive === "boolean" && !user.isActive) {
      return res.status(401).json({
        code: "USER_DISABLED",
        message: "This account has been disabled.",
      })
    }

    req.userId = decoded.userId
    req.sessionId = decoded.sessionId

    req.user = {
      ...serializeUser(user),
      role: decoded.role || user.role,
    }
    next()
  } catch (error) {
    console.error("Authentication error:", error)
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid token.",
      })
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "TOKEN_EXPIRED",
        message: "Token has expired.",
      })
    }
    res
      .status(401)
      .json({ code: "AUTH_ERROR", message: "Authentication failed." })
  }
}

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Access denied. Please authenticate." })
    }

    // SUPER_ADMIN bypasses all role checks
    if (req.user.role === "SUPER_ADMIN") {
      return next()
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
