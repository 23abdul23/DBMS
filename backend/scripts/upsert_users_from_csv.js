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
const DEFAULT_CSV_FILE = "DATA.csv"

const GENDERS = ["male", "female"]
const DEPARTMENTS = ["IT", "IT_BI", "Electronics"]
const ACADEMIC_YEARS = [
  "FIRST_YEAR",
  "SECOND_YEAR",
  "THIRD_YEAR",
  "FOURTH_YEAR",
]

const MALE_HOSTELS = ["BH 1", "BH 2", "BH 3", "BH 4", "BH 5"]
const FEMALE_HOSTELS = ["GH 1", "GH 2", "GH 3"]
const ROOM_MIN = 500
const ROOM_MAX = 900

const parseCliArgs = (argv) => {
  const options = {
    dryRun: false,
    csvFile: DEFAULT_CSV_FILE,
  }

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg.startsWith("--csv=")) {
      const value = arg.split("=").slice(1).join("=").trim()
      if (value) {
        options.csvFile = value
      }
    }
  }

  return options
}

const randomFrom = (values) => values[Math.floor(Math.random() * values.length)]

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const randomPhone = () => {
  const lead = randomFrom(["6", "7", "8", "9"])
  const rest = String(randomInt(0, 999_999_999)).padStart(9, "0")
  return `${lead}${rest}`
}

const pickGender = () => randomFrom(GENDERS)

const pickDepartment = () => randomFrom(DEPARTMENTS)

const pickAcademicYear = () => randomFrom(ACADEMIC_YEARS)

const splitCsvLine = (line) => {
  const values = []
  let currentValue = ""
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (character === "," && !insideQuotes) {
      values.push(currentValue.trim())
      currentValue = ""
      continue
    }

    currentValue += character
  }

  values.push(currentValue.trim())
  return values
}

const parseCsv = (csvPath) => {
  const raw = fs.readFileSync(csvPath, "utf8")
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return []
  }

<<<<<<< Updated upstream
  const headerValues = splitCsvLine(lines[0]).map((value) => value.toLowerCase())
  const hasHeader = headerValues.includes("name") && headerValues.includes("email")
=======
  const headerValues = splitCsvLine(lines[0]).map((value) =>
    value.toLowerCase(),
  )
  const hasHeader =
    headerValues.includes("name") && headerValues.includes("email")
>>>>>>> Stashed changes
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .map((line) => {
      const values = splitCsvLine(line)

      if (hasHeader) {
        const row = Object.fromEntries(
          headerValues.map((header, index) => [header, values[index] || ""]),
        )

        return {
          name: (row.name || "").trim(),
          email: (row.email || "").trim(),
        }
      }

      return {
        name: (values[0] || "").trim(),
        email: (values[1] || "").trim(),
      }
    })
    .filter((row) => row.email && row.name)
}

const hashPassword = async () => bcrypt.hash(DEFAULT_PASSWORD, 10)

const sanitizeStudentIdBase = (name, email) => {
  const source = email?.split("@")[0] || name || "student"
  const base = source.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  return base.slice(0, 12) || "STUDENT"
}

const generateUniqueStudentId = (name, email, existingStudentIds) => {
  const base = sanitizeStudentIdBase(name, email)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = String(randomInt(1000, 9999))
    const candidate = `${base}${suffix}`

    if (!existingStudentIds.has(candidate)) {
      existingStudentIds.add(candidate)
      return candidate
    }
  }

  const fallback = `${base}${generateId().slice(0, 8).toUpperCase()}`
  existingStudentIds.add(fallback)
  return fallback
}

const reserveRoom = (hostels, occupiedRooms, overflowNextRoomByHostel) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const hostel = randomFrom(hostels)
    const roomNumber = String(randomInt(ROOM_MIN, ROOM_MAX))
    const roomKey = `${hostel}|${roomNumber}`

    if (!occupiedRooms.has(roomKey)) {
      occupiedRooms.add(roomKey)
      return { hostel, roomNumber }
    }
  }

  for (const hostel of hostels) {
    const nextRoomNumber = overflowNextRoomByHostel.get(hostel) ?? ROOM_MAX + 1
    const roomNumber = String(nextRoomNumber)
    const roomKey = `${hostel}|${roomNumber}`

    overflowNextRoomByHostel.set(hostel, nextRoomNumber + 1)

    if (!occupiedRooms.has(roomKey)) {
      occupiedRooms.add(roomKey)
      return { hostel, roomNumber, overflow: true }
    }
  }

  throw new Error("Unable to allocate a free hostel-room combination")
}

const assignHostelAndRoom = (students) => {
  const occupiedRooms = new Set()
  const overflowNextRoomByHostel = new Map()
  let overflowAllocations = 0
  const groupedByGender = {
    male: students.filter((student) => student.gender === "male"),
    female: students.filter((student) => student.gender === "female"),
  }

  for (const [gender, group] of Object.entries(groupedByGender)) {
    const hostels = gender === "female" ? FEMALE_HOSTELS : MALE_HOSTELS

    for (let index = 0; index < group.length; index += 2) {
      const pair = group.slice(index, index + 2)
      const allocation = reserveRoom(
        hostels,
        occupiedRooms,
        overflowNextRoomByHostel,
      )

      if (allocation.overflow) {
        overflowAllocations += pair.length
      }

      for (const student of pair) {
        student.hostel = allocation.hostel
        student.roomNumber = allocation.roomNumber
      }
    }
  }

  if (overflowAllocations > 0) {
    console.warn(
      `Hostel base room range exhausted for ${overflowAllocations} students. Assigned overflow room numbers above ${ROOM_MAX}.`,
    )
  }
}

const buildStudentRecord = (row, existingStudentIds) => {
  const gender = pickGender()
<<<<<<< Updated upstream
  const studentId = generateUniqueStudentId(row.name, row.email, existingStudentIds)
=======
  const studentId = generateUniqueStudentId(
    row.name,
    row.email,
    existingStudentIds,
  )
>>>>>>> Stashed changes

  return {
    name: row.name,
    email: row.email,
    passwordHash: null,
    role: "student",
    gender,
    department: pickDepartment(),
    year: pickAcademicYear(),
    hostel: null,
    roomNumber: null,
    phoneNumber: randomPhone(),
    emergencyContact: `${row.name} (${gender === "female" ? "Mother" : "Father"}) - ${randomPhone()}`,
    studentId,
  }
}

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. The script expects backend/.env to define it.",
    )
  }

  const csvPath = path.isAbsolute(options.csvFile)
    ? options.csvFile
    : path.join(__dirname, options.csvFile)

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`)
  }

  const rows = parseCsv(csvPath)
  console.log(`Found ${rows.length} rows in ${path.basename(csvPath)}`)

  const existingUsers = await prisma.user.findMany({
    where: {
      email: {
        in: rows.map((row) => row.email),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      gender: true,
      department: true,
      year: true,
      hostel: true,
      roomNumber: true,
      phoneNumber: true,
      emergencyContact: true,
      studentId: true,
    },
  })

  const existingUsersByEmail = new Map(
    existingUsers.map((user) => [user.email, user]),
  )

  const existingStudentIds = new Set(
    (
      await prisma.user.findMany({
        where: {
          studentId: {
            not: null,
          },
        },
        select: {
          studentId: true,
        },
      })
    )
      .map((user) => user.studentId)
      .filter(Boolean),
  )

<<<<<<< Updated upstream
  const students = rows.map((row) => buildStudentRecord(row, existingStudentIds))
=======
  const students = rows.map((row) =>
    buildStudentRecord(row, existingStudentIds),
  )
>>>>>>> Stashed changes
  assignHostelAndRoom(students)

  const pwHash = await hashPassword()

  let inserted = 0
  let updated = 0

  for (const student of students) {
    try {
      const existing = existingUsersByEmail.get(student.email)

      if (existing) {
        const data = {
          name: student.name,
          gender: existing.gender || student.gender,
          department: existing.department || student.department,
          year: existing.year || student.year,
          hostel: existing.hostel || student.hostel,
          roomNumber: existing.roomNumber || student.roomNumber,
          phoneNumber: existing.phoneNumber || student.phoneNumber,
<<<<<<< Updated upstream
          emergencyContact: existing.emergencyContact || student.emergencyContact,
=======
          emergencyContact:
            existing.emergencyContact || student.emergencyContact,
>>>>>>> Stashed changes
          studentId: existing.studentId || student.studentId,
        }

        const hasChanges = Object.entries(data).some(
          ([key, value]) => existing[key] !== value,
        )

        if (hasChanges) {
          await prisma.user.update({
            where: { email: student.email },
            data,
          })
          updated += 1
        }
      } else {
        await prisma.user.create({
          data: {
            id: generateId(),
            name: student.name,
            email: student.email,
            passwordHash: pwHash,
            role: student.role,
            gender: student.gender,
            department: student.department,
            year: student.year,
            hostel: student.hostel,
            roomNumber: student.roomNumber,
            phoneNumber: student.phoneNumber,
            emergencyContact: student.emergencyContact,
            studentId: student.studentId,
          },
        })
        inserted += 1
      }
    } catch (err) {
      console.error(`Error processing ${student.email}:`, err.message || err)
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
