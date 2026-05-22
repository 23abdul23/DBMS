import { getPrismaClient } from "../../config/prisma.js"

const prisma = getPrismaClient()

async function savePushToken({ userId, token, platform, deviceName }) {
  const existingToken = await prisma.pushToken.findUnique({
    where: {
      token,
    },
    select: {
      id: true,
      userId: true,
      isActive: true,
      platform: true,
      deviceName: true,
    },
  })

  console.log("[PushToken] Persisting token", {
    userId,
    tokenPreview: token ? `${token.slice(0, 24)}...` : null,
    platform,
    deviceName,
    existingUserId: existingToken?.userId || null,
    existingIsActive: existingToken?.isActive ?? null,
  })

  const savedToken = await prisma.pushToken.upsert({
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

  console.log("[PushToken] Persist complete", {
    id: savedToken.id,
    userId: savedToken.userId,
    isActive: savedToken.isActive,
    tokenPreview: savedToken.token
      ? `${savedToken.token.slice(0, 24)}...`
      : null,
  })

  return savedToken
}

async function deactivatePushToken(token) {
  if (!token) {
    return null
  }

  console.log("[PushToken] Deactivating token", {
    tokenPreview: `${token.slice(0, 24)}...`,
  })

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

async function deactivatePushTokensForUser(userId) {
  if (!userId) {
    return null
  }

  console.log("[PushToken] Deactivating all active tokens for user", {
    userId,
  })

  return prisma.pushToken.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })
}

export { deactivatePushToken, deactivatePushTokensForUser, savePushToken }
