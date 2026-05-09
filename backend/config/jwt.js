import jwt from "jsonwebtoken"
import crypto from "crypto"

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key"
const JWT_EXPIRE = process.env.JWT_EXPIRE || "7d"

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex")
}

const generateAccessToken = (user, sessionId) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      sessionId,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRE,
    },
  )
}

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex")
}

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET)
}

export {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyToken,
  JWT_SECRET,
}
