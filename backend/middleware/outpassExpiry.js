const { getPrismaClient } = require("../config/prisma")
const { expireOldOutpasses } = require("../utils/outpassLifecycle")

const prisma = getPrismaClient()

// Middleware to automatically check and expire old outpasses
const checkOutpassExpiry = async (req, res, next) => {
  try {
    const expiredCount = await expireOldOutpasses(prisma)

    if (expiredCount > 0) {
      console.log(`Auto-expired ${expiredCount} outpasses`)
    }

    next()
  } catch (error) {
    console.error("Error in outpass expiry middleware:", error)
    next()
  }
}

module.exports = { checkOutpassExpiry }
