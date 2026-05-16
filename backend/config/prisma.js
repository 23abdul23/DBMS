import dotenv from "dotenv"

dotenv.config()

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const { Pool } = pg

let prisma

const getPrismaClient = () => {
  if (!prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when DB_MODE is sql or hybrid")
    }

    // Prisma 7+ requires the PrismaPg adapter for PostgreSQL
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)

    prisma = new PrismaClient({
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

export { getPrismaClient, connectSQL, disconnectSQL }
