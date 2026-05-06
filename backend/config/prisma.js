let prisma
let PrismaClient

const loadPrismaClient = () => {
  if (!PrismaClient) {
    try {
      ;({ PrismaClient } = require("@prisma/client"))
    } catch (error) {
      throw new Error(
        "Prisma client is not generated. Run npm run prisma:generate before using DB_MODE=sql or hybrid.",
        { cause: error },
      )
    }
  }

  return PrismaClient
}

const getPrismaClient = () => {
  if (!prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when DB_MODE is sql or hybrid")
    }
    const PrismaClientClass = loadPrismaClient()
    // Prisma 7+ requires the PrismaPg adapter for PostgreSQL
    const { PrismaPg } = require("@prisma/adapter-pg")
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClientClass({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"],
    })
  }
  return prisma
}

const connectSQL = async () => {
  const client = getPrismaClient()
  await client.$connect()
  console.log("SQL Connected: PostgreSQL via Prisma 7+")
  return client
}

const disconnectSQL = async () => {
  if (!prisma) {
    return
  }

  await prisma.$disconnect()
  prisma = null
}

module.exports = {
  getPrismaClient,
  connectSQL,
  disconnectSQL,
}
