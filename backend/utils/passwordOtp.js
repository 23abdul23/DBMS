import crypto from "crypto"
import { getPrismaClient } from "../config/prisma.js"
import { generateId } from "./hashGenerator.js"

const prisma = getPrismaClient()

export const PASSWORD_OTP_EXPIRY_MS = 90 * 1000
export const PASSWORD_OTP_EXPIRY_SECONDS = PASSWORD_OTP_EXPIRY_MS / 1000

export const generatePasswordOtp = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")

export const hashPasswordOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex")

export const buildPasswordOtpExpiry = () =>
  new Date(Date.now() + PASSWORD_OTP_EXPIRY_MS)

export const cleanupExpiredPasswordOtps = async (client = prisma) =>
  client.passwordUpdateOtp.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  })

export const createPasswordOtpRecord = async (
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
