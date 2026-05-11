import { getPrismaClient } from "../../config/prisma.js"

const prisma = getPrismaClient()

async function savePushToken({ userId, token, platform, deviceName }) {
  return prisma.pushToken.upsert({
    where: {
      token,
    },
    update: {
      isActive: true,
    },
    create: {
      userId,
      token,
      platform,
      deviceName,
    },
  })
}

export { savePushToken }
