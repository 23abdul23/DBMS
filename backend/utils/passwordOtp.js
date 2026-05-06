const crypto = require("crypto")
const { getPrismaClient } = require("../config/prisma")
const { generateId } = require("./hashGenerator")

const prisma = getPrismaClient()

const PASSWORD_OTP_EXPIRY_MS = 90 * 1000
const PASSWORD_OTP_EXPIRY_SECONDS = PASSWORD_OTP_EXPIRY_MS / 1000

const generatePasswordOtp = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")

const hashPasswordOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex")

const buildPasswordOtpExpiry = () =>
  new Date(Date.now() + PASSWORD_OTP_EXPIRY_MS)

const cleanupExpiredPasswordOtps = async (client = prisma) =>
  client.passwordUpdateOtp.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  })

const createPasswordOtpRecord = async (
  client,
  { userId, otp, pendingPasswordHash },
) =>
  client.passwordUpdateOtp.create({
    data: {
      id: generateId(),
      userId,
      otpHash: hashPasswordOtp(otp),
      pendingPasswordHash,
      expiresAt: buildPasswordOtpExpiry(),
    },
  })

module.exports = {
  PASSWORD_OTP_EXPIRY_MS,
  PASSWORD_OTP_EXPIRY_SECONDS,
  buildPasswordOtpExpiry,
  cleanupExpiredPasswordOtps,
  createPasswordOtpRecord,
  generatePasswordOtp,
  hashPasswordOtp,
}
