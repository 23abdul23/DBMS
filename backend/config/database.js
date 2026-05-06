const { connectSQL, disconnectSQL } = require("./prisma")

const VALID_DB_MODES = ["sql"]

const getDatabaseMode = () => {
  const rawMode = process.env.DB_MODE || "sql"
  const mode = rawMode.toLowerCase()

  if (!VALID_DB_MODES.includes(mode)) {
    throw new Error(`Invalid DB_MODE: ${rawMode}. Only "sql" is allowed.`)
  }

  return mode
}

const connectDatabase = async () => {
  const mode = getDatabaseMode()

  await connectSQL()
  return { mode }
}

const disconnectDatabase = async () => {
  await disconnectSQL()
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseMode,
}
