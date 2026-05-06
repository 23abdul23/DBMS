import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { getPrismaClient, disconnectSQL } from "../config/prisma.js"
import { generateId } from "../utils/hashGenerator.js"
import {
  SAC_ADMIN_EMAIL,
  LIBRARY_ADMIN_EMAIL,
  normalizeEmail,
} from "../utils/adminScopes.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(backendRoot, ".env") })

const prisma = getPrismaClient()

const DEFAULT_PASSWORD = "123456"

const ACTIVITY_ADMINS = [
  {
    email: SAC_ADMIN_EMAIL,
    name: "SAC Administrator",
    role: "admin",
    gender: "other",
    phoneNumber: "8000000001",
    emergencyContact: "Campus Control Room - 7909069340",
  },
  {
    email: LIBRARY_ADMIN_EMAIL,
    name: "Library Administrator",
    role: "admin",
    gender: "other",
    phoneNumber: "8000000002",
    emergencyContact: "Campus Control Room - 7909069340",
  },
]

const parseCliArgs = (argv) => ({
  dryRun: argv.includes("--dry-run"),
})

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. The script expects backend/.env to define it.",
    )
  }

  const existingUsers = await prisma.user.findMany({
    where: {
      email: {
        in: ACTIVITY_ADMINS.map((admin) => admin.email),
      },
    },
    select: {
      email: true,
    },
  })

  const existingEmails = new Set(
    existingUsers.map((user) => normalizeEmail(user.email)),
  )
  const adminsToInsert = ACTIVITY_ADMINS.filter(
    (admin) => !existingEmails.has(normalizeEmail(admin.email)),
  )

  console.log("Activity admin ingestion started")
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`)
  console.log(`Accounts configured: ${ACTIVITY_ADMINS.length}`)
  console.log(`Accounts pending insert: ${adminsToInsert.length}`)

  for (const admin of ACTIVITY_ADMINS) {
    console.log(
      `- ${admin.email} | ${admin.name} | ${existingEmails.has(normalizeEmail(admin.email)) ? "skip" : "insert"}`,
    )
  }

  if (options.dryRun || adminsToInsert.length === 0) {
    console.log(
      `\nSummary: inserted=0, skipped=${ACTIVITY_ADMINS.length - adminsToInsert.length}, total=${ACTIVITY_ADMINS.length}`,
    )
    return
  }

  const rows = await Promise.all(
    adminsToInsert.map(async (admin) => ({
      id: generateId(),
      name: admin.name,
      email: admin.email,
      passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 10),
      role: admin.role,
      gender: admin.gender,
      phoneNumber: admin.phoneNumber,
      emergencyContact: admin.emergencyContact,
    })),
  )

  const result = await prisma.user.createMany({
    data: rows,
    skipDuplicates: true,
  })

  const duplicateConflicts = rows.length - result.count

  console.log(
    `\nSummary: inserted=${result.count}, skipped=${ACTIVITY_ADMINS.length - adminsToInsert.length + duplicateConflicts}, total=${ACTIVITY_ADMINS.length}`,
  )
}

run()
  .catch((error) => {
    console.error("\nActivity admin ingestion failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
