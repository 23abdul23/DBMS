import bcrypt from "bcryptjs"
import crypto from "crypto"
import dotenv from "dotenv"
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

const HOSTEL_WARDENS = [
  {
    hostel: "BH 1",
    email: "warden.bh-1@iiita.ac.in",
    legacyEmails: ["bh1Warden@iiita.ac.in"],
    gender: "male",
  },
  {
    hostel: "BH 2",
    email: "warden.bh-2@iiita.ac.in",
    legacyEmails: ["bh2Warden@iiita.ac.in"],
    gender: "male",
  },
  {
    hostel: "BH 3",
    email: "warden.bh-3@iiita.ac.in",
    legacyEmails: ["bh3Warden@iiita.ac.in"],
    gender: "male",
  },
  {
    hostel: "BH 4",
    email: "warden.bh-4@iiita.ac.in",
    legacyEmails: ["bh4Warden@iiita.ac.in"],
    gender: "male",
  },
  {
    hostel: "BH 5",
    email: "warden.bh-5-1@iiita.ac.in",
    legacyEmails: ["bh5Warden@iiita.ac.in"],
    gender: "male",
  },
  {
    hostel: "BH 5",
    email: "warden.bh-5-2@iiita.ac.in",
    legacyEmails: [],
    gender: "male",
  },
  {
    hostel: "GH 1",
    email: "warden.gh-1@iiita.ac.in",
    legacyEmails: ["gh1Warden@iiita.ac.in"],
    gender: "female",
  },
  {
    hostel: "GH 2",
    email: "warden.gh-2@iiita.ac.in",
    legacyEmails: ["gh2Warden@iiita.ac.in"],
    gender: "female",
  },
  {
    hostel: "GH 3",
    email: "warden.gh-3@iiita.ac.in",
    legacyEmails: ["gh3Warden@iiita.ac.in"],
    gender: "female",
  },
]

const MALE_FIRST_NAMES = [
  "Ajay",
  "Amit",
  "Anil",
  "Deepak",
  "Dinesh",
  "Mahesh",
  "Rajesh",
  "Sanjay",
  "Suresh",
  "Vijay",
]
const FEMALE_FIRST_NAMES = [
  "Anita",
  "Archana",
  "Kundu",
  "Meena",
  "Neelam",
  "Pooja",
  "Sarita",
  "Seema",
  "Shalini",
  "Sunita",
]
const LAST_NAMES = [
  "Agarwal",
  "Das",
  "Gupta",
  "Jain",
  "Mishra",
  "Pandey",
  "Rao",
  "Sharma",
  "Singh",
  "Verma",
]

const parseCliArgs = (argv) => ({
  dryRun: argv.includes("--dry-run"),
})

const seededNumber = (seed, label, modulo) => {
  const digest = crypto
    .createHash("sha256")
    .update(`${seed}:${label}`)
    .digest("hex")
  return Number.parseInt(digest.slice(0, 12), 16) % modulo
}

const pickFromList = (seed, label, values) =>
  values[seededNumber(seed, label, values.length)]

const generatePhone = (seed, label) => {
  const firstDigit = ["6", "7", "8", "9"][
    seededNumber(seed, `${label}:lead`, 4)
  ]
  const body = String(
    seededNumber(seed, `${label}:body`, 1_000_000_000),
  ).padStart(9, "0")
  return `${firstDigit}${body}`
}

const generateEmergencyContact = (seed) => {
  const useMother = seededNumber(seed, "emergency-relation", 4) === 0
  const firstName = useMother
    ? pickFromList(seed, "emergency-first-name", FEMALE_FIRST_NAMES)
    : pickFromList(seed, "emergency-first-name", MALE_FIRST_NAMES)
  const lastName = pickFromList(seed, "emergency-last-name", LAST_NAMES)
  const relation = useMother ? "Mother" : "Father"

  return `${firstName} ${lastName} (${relation}) - ${generatePhone(seed, "emergency-phone")}`
}

const createWardenPayload = ({ hostel, email, gender }) => {
  const seed = `warden:${hostel}`
  const firstName =
    gender === "female"
      ? pickFromList(seed, "first-name", FEMALE_FIRST_NAMES)
      : pickFromList(seed, "first-name", MALE_FIRST_NAMES)
  const lastName = pickFromList(seed, "last-name", LAST_NAMES)

  return {
    hostel,
    email,
    name: `${firstName} ${lastName}`,
    gender,
    role: "warden",
    phoneNumber: generatePhone(seed, "primary-phone"),
    emergencyContact: generateEmergencyContact(seed),
  }
}

const buildWardens = () => HOSTEL_WARDENS.map(createWardenPayload)

const hashPassword = async () => bcrypt.hash(DEFAULT_PASSWORD, 10)

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. The script expects backend/.env to define it.",
    )
  }

  console.log("Warden ingestion started")
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`)
  const wardens = buildWardens()
  let inserted = 0
  let updated = 0
  let profileCreated = 0
  let profileSkipped = 0

  console.log(`Wardens generated: ${wardens.length}`)

  for (const warden of wardens) {
    const lookupEmails = [warden.email, ...(warden.legacyEmails || [])].filter(
      Boolean,
    )
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: lookupEmails.map((email) => ({ email })),
      },
      select: {
        id: true,
        email: true,
      },
    })

    if (options.dryRun) {
      const action = existingUser
        ? `update ${existingUser.email} -> ${warden.email}`
        : `insert ${warden.email}`
      console.log(
        `- ${warden.hostel} | ${warden.gender} | ${warden.email} | ${action}`,
      )
      continue
    }

    let userId = existingUser?.id

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: warden.name,
          email: warden.email,
          role: warden.role,
          gender: warden.gender,
          hostel: warden.hostel,
          phoneNumber: warden.phoneNumber,
          emergencyContact: warden.emergencyContact,
        },
      })
      updated += 1
    } else {
      const createdUser = await prisma.user.create({
        data: {
          id: generateId(),
          name: warden.name,
          email: warden.email,
          passwordHash: await hashPassword(),
          role: warden.role,
          gender: warden.gender,
          hostel: warden.hostel,
          phoneNumber: warden.phoneNumber,
          emergencyContact: warden.emergencyContact,
        },
        select: { id: true },
      })
      userId = createdUser.id
      inserted += 1
    }

    const existingProfile = await prisma.wardenProfile.findUnique({
      where: { hostel: warden.hostel },
      select: { userId: true },
    })

    if (!existingProfile) {
      await prisma.wardenProfile.create({
        data: {
          userId,
          hostel: warden.hostel,
        },
      })
      profileCreated += 1
    } else if (existingProfile.userId !== userId) {
      profileSkipped += 1
    }

    const action = existingUser ? "update" : "insert"
    console.log(
      `- ${warden.hostel} | ${warden.gender} | ${warden.email} | ${action}`,
    )
  }

  if (options.dryRun) {
    console.log(
      `\nSummary: inserted=0, updated=0, profilesCreated=0, profilesSkipped=0, total=${wardens.length}`,
    )
    return
  }

  console.log(
    `\nSummary: inserted=${inserted}, updated=${updated}, profilesCreated=${profileCreated}, profilesSkipped=${profileSkipped}, total=${wardens.length}`,
  )
}

run()
  .catch((error) => {
    console.error("\nWarden ingestion failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
