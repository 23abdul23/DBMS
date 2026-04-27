const crypto = require("crypto")

const generateId = () => crypto.randomBytes(12).toString("hex")

module.exports = {
  generateId,
}
