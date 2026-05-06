import crypto from "crypto"

export const generateId = () => crypto.randomBytes(12).toString("hex")
