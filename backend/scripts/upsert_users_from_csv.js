import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { getPrismaClient, disconnectSQL } from "../config/prisma.js"
import { generateId } from "../utils/hashGenerator.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(backendRoot, ".env") })

const prisma = getPrismaClient()

const DEFAULT_PASSWORD = "123456"

const randomPhone = () => {
  const lead = ["6", "7", "8", "9"][Math.floor(Math.random() * 4)]
  const rest = String(Math.floor(Math.random() * 1_000_000_000)).padStart(
    9,
    "0",
  )
  return `${lead}${rest}`
}

const pickGender = () => (Math.random() < 0.5 ? "male" : "female")

const parseCsv = (csvPath) => {
  const raw = fs.readFileSync(csvPath, "utf8")
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(1) // drop header
    .map((line) => {
      // split only on first comma (names may contain commas)
      const parts = line.split(/,(.+)/)
      const name = (parts[0] || "").trim()
      const email = (parts[1] || "").trim()
      return { name, email }
    })
    .filter((r) => r.email && r.name)
}

const hashPassword = async () => bcrypt.hash(DEFAULT_PASSWORD, 10)

const run = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. The script expects backend/.env to define it.",
    )
  }

  const csvPath = path.join(__dirname, "DATA.csv")
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`)
  }

  const rows = parseCsv(csvPath)
  console.log(`Found ${rows.length} rows in DATA.csv`)

  const pwHash = await hashPassword()

  let inserted = 0
  let updated = 0

  for (const { name, email } of rows) {
    try {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        if (existing.name !== name) {
          await prisma.user.update({ where: { email }, data: { name } })
          updated++
        }
      } else {
        await prisma.user.create({
          data: {
            id: generateId(),
            name,
            email,
            passwordHash: pwHash,
            role: "student",
            gender: pickGender(),
            phoneNumber: randomPhone(),
          },
        })
        inserted++
      }
    } catch (err) {
      console.error(`Error processing ${email}:`, err.message || err)
    }
  }

  console.log(
    `Done. inserted=${inserted}, updated=${updated}, total=${rows.length}`,
  )
}

run()
  .catch((err) => {
    console.error("Upsert script failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
