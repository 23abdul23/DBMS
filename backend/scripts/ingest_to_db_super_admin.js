import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { getPrismaClient, disconnectSQL } from "../config/prisma.js"
import { generateId } from "../utils/hashGenerator.js"
import { super_admin_EMAIL, normalizeEmail } from "../utils/adminScopes.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(backendRoot, ".env") })

const prisma = getPrismaClient()

const DEFAULT_PASSWORD = "123456"

const super_admin = {
  email: super_admin_EMAIL,
  name: "Super Administrator",
  role: "super_admin",
  gender: "other",
  phoneNumber: "8000000000",
  emergencyContact: "Campus Control Room - 7909069340",
}

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

  const existingUser = await prisma.user.findUnique({
    where: {
      email: super_admin.email,
    },
    select: {
      email: true,
    },
  })

  console.log("super_admin user ingestion started")
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`)
  console.log(`Email: ${super_admin.email}`)
  console.log(`Status: ${existingUser ? "skip (already exists)" : "insert"}`)

  if (options.dryRun || existingUser) {
    console.log(`\nSummary: inserted=0, skipped=${existingUser ? 1 : 0}`)
    return
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const result = await prisma.user.create({
    data: {
      id: generateId(),
      name: super_admin.name,
      email: super_admin.email,
      passwordHash,
      role: super_admin.role,
      gender: super_admin.gender,
      phoneNumber: super_admin.phoneNumber,
      emergencyContact: super_admin.emergencyContact,
      isActive: true,
    },
  })

  console.log(`\nSummary: inserted=1, skipped=0, userId=${result.id}`)
}

run()
  .catch((error) => {
    console.error("\nsuper_admin user ingestion failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
