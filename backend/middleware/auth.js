const { verifyToken } = require("../config/jwt")
const { getPrismaClient } = require("../config/prisma")

const prisma = getPrismaClient()

const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." })
    }

    const decoded = verifyToken(token)

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
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
      },
    })

    if (!user || (typeof user.isActive === "boolean" && !user.isActive)) {
      return res.status(401).json({ message: "Invalid token or user not found." })
    }

    req.user = {
      ...user,
      _id: user.id,
      userId: user.id,
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
      return res.status(401).json({ message: "Access denied. Please authenticate." })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
      })
    }

    next()
  }
}

module.exports = {
  authenticate,
  authorize,
}
