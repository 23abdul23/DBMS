import { getPrismaClient } from "../config/prisma.js"
import { expireOldOutpasses } from "../utils/outpassLifecycle.js"

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

export { checkOutpassExpiry }
