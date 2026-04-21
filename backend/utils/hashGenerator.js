const crypto = require("crypto")
const { getPrismaClient } = require("../config/prisma")

const prisma = getPrismaClient()

const generateId = () => crypto.randomBytes(12).toString("hex")

const generatePasskeyHash = (userId, identifier, date) => {
  const dateString = date.toISOString().split("T")[0]
  const data = [userId, identifier || "", dateString].join(":")

  return crypto.createHash("sha256").update(data).digest("hex")
}

const generateDailyPasskeys = async () => {
  try {
    const today = new Date()
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)

    const tomorrow = new Date(todayStart)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const students = await prisma.user.findMany({
      where: {
        role: "student",
        isActive: true,
      },
      select: {
        id: true,
        studentId: true,
        email: true,
      },
    })

    const passkeyPromises = students.map(async (student) => {
      const existingPasskey = await prisma.passkey.findFirst({
        where: {
          userId: student.id,
          createdAt: {
            gte: todayStart,
            lt: tomorrow,
          },
        },
      })

      if (existingPasskey) {
        return existingPasskey
      }

      const hash = generatePasskeyHash(student.id, student.studentId || student.email, today)

      return prisma.passkey.create({
        data: {
          id: generateId(),
          userId: student.id,
          hash,
          date: today,
          expiresAt: tomorrow,
        },
      })
    })

    await Promise.all(passkeyPromises)
    console.log(`Generated passkeys for ${students.length} students`)
  } catch (error) {
    console.error("Error in generateDailyPasskeys:", error)
    throw error
  }
}

const validatePasskey = async (hash, userId) => {
  try {
    const passkey = await prisma.passkey.findFirst({
      where: {
        hash,
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    return !!passkey
  } catch (error) {
    console.error("Error validating passkey:", error)
    return false
  }
}

module.exports = {
  generateId,
  generatePasskeyHash,
  generateDailyPasskeys,
  validatePasskey,
}
