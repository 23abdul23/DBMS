import { getPrismaClient } from "../../config/prisma.js"

const prisma = getPrismaClient()

async function savePushToken({ userId, token, platform, deviceName }) {
  return prisma.pushToken.upsert({
    where: {
      token,
    },
    update: {
      userId,
      platform,
      deviceName,
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

async function deactivatePushToken(token) {
  if (!token) {
    return null
  }

  return prisma.pushToken.updateMany({
    where: {
      token,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })
}

export { deactivatePushToken, savePushToken }
