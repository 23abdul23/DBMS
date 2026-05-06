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
const DEFAULT_BATCH_SIZE = 200
const DEFAULT_EXISTS_CHECK_CHUNK_SIZE = 100
const ROOM_MIN = 500
const ROOM_MAX = 900

const MALE_HOSTELS = ["BH 1", "BH 2", "BH 3", "BH 4", "BH 5"]
const FEMALE_HOSTELS = ["GH 1", "GH 2", "GH 3"]

const BRANCH_CONFIG = {
  IT: {
    department: "IT",
    emailPrefix: "iit",
    rollRanges: [
      [1, 300],
      [500, 550],
    ],
  },
  "IT-BI": {
    department: "IT_BI",
    emailPrefix: "iib",
    rollRanges: [
      [1, 50],
      [500, 520],
    ],
  },
  ECE: {
    department: "Electronics",
    emailPrefix: "iec",
    rollRanges: [[1, 230]],
  },
}

const BATCH_YEAR_TO_ACADEMIC_YEAR = {
  2023: "THIRD_YEAR",
  2024: "SECOND_YEAR",
  2025: "FIRST_YEAR",
}

const MALE_FIRST_NAMES = [
  "Aarav",
  "Aditya",
  "Akash",
  "Aman",
  "Aniket",
  "Arjun",
  "Ayush",
  "Dev",
  "Harsh",
  "Karan",
  "Krishna",
  "Manav",
  "Mohit",
  "Nikhil",
  "Pranav",
  "Rahul",
  "Rohan",
  "Sahil",
  "Shivam",
  "Utkarsh",
  "Varun",
  "Vivek",
  "Yash",
]

const FEMALE_FIRST_NAMES = [
  "Aditi",
  "Ananya",
  "Anika",
  "Diya",
  "Ishita",
  "Kavya",
  "Khushi",
  "Mehak",
  "Muskan",
  "Navya",
  "Neha",
  "Niharika",
  "Pallavi",
  "Priya",
  "Riya",
  "Saanvi",
  "Shreya",
  "Simran",
  "Sneha",
  "Tanvi",
  "Trisha",
]

const LAST_NAMES = [
  "Agarwal",
  "Bansal",
  "Chaturvedi",
  "Das",
  "Dubey",
  "Gupta",
  "Jain",
  "Joshi",
  "Kashyap",
  "Kulkarni",
  "Mehta",
  "Mishra",
  "Pandey",
  "Patel",
  "Rao",
  "Reddy",
  "Shah",
  "Sharma",
  "Singh",
  "Sinha",
  "Srivastava",
  "Tiwari",
  "Verma",
  "Yadav",
]

const MALE_PARENT_NAMES = [
  "Ajay",
  "Amit",
  "Anil",
  "Deepak",
  "Dinesh",
  "Mahesh",
  "Manoj",
  "Naresh",
  "Pankaj",
  "Pradeep",
  "Rajeev",
  "Rajesh",
  "Rakesh",
  "Ramesh",
  "Sandeep",
  "Sanjay",
  "Suresh",
  "Vijay",
  "Vinod",
]

const FEMALE_PARENT_NAMES = [
  "Anita",
  "Archana",
  "Kavita",
  "Meena",
  "Neelam",
  "Pooja",
  "Preeti",
  "Rekha",
  "Sarita",
  "Seema",
  "Shalini",
  "Sunita",
  "Sushma",
  "Usha",
  "Vandana",
]

const parseCliArgs = (argv) => {
  const options = {
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    existsCheckChunkSize: DEFAULT_EXISTS_CHECK_CHUNK_SIZE,
  }

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg.startsWith("--batch-size=")) {
      const value = Number.parseInt(arg.split("=")[1], 10)
      if (Number.isFinite(value) && value > 0) {
        options.batchSize = value
      }
    }

    if (arg.startsWith("--exists-check-chunk-size=")) {
      const value = Number.parseInt(arg.split("=")[1], 10)
      if (Number.isFinite(value) && value > 0) {
        options.existsCheckChunkSize = value
      }
    }
  }

  return options
}

const seededNumber = (seed, label, modulo) => {
  if (!Number.isFinite(modulo) || modulo <= 0) {
    throw new Error(`Invalid modulo received for ${label}`)
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${seed}:${label}`)
    .digest("hex")
  return Number.parseInt(digest.slice(0, 12), 16) % modulo
}

const pickFromList = (seed, label, values) =>
  values[seededNumber(seed, label, values.length)]

const padRollNumber = (rollNumber) => String(rollNumber).padStart(3, "0")

const generateStudentEmail = ({ emailPrefix, batchYear, rollNumber }) =>
  `${emailPrefix}${batchYear}${padRollNumber(rollNumber)}@iiita.ac.in`

const generateStudentId = ({ emailPrefix, batchYear, rollNumber }) =>
  `${emailPrefix}${batchYear}${padRollNumber(rollNumber)}`

const generatePhone = (seed, label) => {
  const firstDigit = ["6", "7", "8", "9"][
    seededNumber(seed, `${label}:lead`, 4)
  ]
  const body = String(
    seededNumber(seed, `${label}:body`, 1_000_000_000),
  ).padStart(9, "0")
  return `${firstDigit}${body}`
}

const assignGender = (seed) =>
  seededNumber(seed, "gender", 5) === 0 ? "female" : "male"

const generateFullName = (seed, gender) => {
  const firstName =
    gender === "female"
      ? pickFromList(seed, "first-name", FEMALE_FIRST_NAMES)
      : pickFromList(seed, "first-name", MALE_FIRST_NAMES)
  const lastName = pickFromList(seed, "last-name", LAST_NAMES)

  return `${firstName} ${lastName}`
}

const generateEmergencyContact = (seed) => {
  const useMother = seededNumber(seed, "emergency-relation", 4) === 0
  const relation = useMother ? "Mother" : "Father"
  const firstName = useMother
    ? pickFromList(seed, "emergency-first-name", FEMALE_PARENT_NAMES)
    : pickFromList(seed, "emergency-first-name", MALE_PARENT_NAMES)
  const lastName = pickFromList(seed, "emergency-last-name", LAST_NAMES)
  const phoneNumber = generatePhone(seed, "emergency-phone")

  return `${firstName} ${lastName} (${relation}) - ${phoneNumber}`
}

const expandRollNumbers = (rollRanges) => {
  const rollNumbers = []

  for (const [start, end] of rollRanges) {
    for (let rollNumber = start; rollNumber <= end; rollNumber += 1) {
      rollNumbers.push(rollNumber)
    }
  }

  return rollNumbers
}

const createStudentPayload = ({ branch, batchYear, rollNumber, config }) => {
  const seed = `${branch}:${batchYear}:${rollNumber}`
  const email = generateStudentEmail({
    emailPrefix: config.emailPrefix,
    batchYear,
    rollNumber,
  })
  const studentId = generateStudentId({
    emailPrefix: config.emailPrefix,
    batchYear,
    rollNumber,
  })
  const gender = assignGender(seed)

  return {
    branch,
    batchYear,
    rollNumber,
    seed,
    name: generateFullName(seed, gender),
    email,
    studentId,
    phoneNumber: generatePhone(seed, "primary-phone"),
    emergencyContact: generateEmergencyContact(seed),
    gender,
    department: config.department,
    year: BATCH_YEAR_TO_ACADEMIC_YEAR[batchYear],
    role: "student",
  }
}

const buildStudentsForBranchAndBatch = (branch, batchYear, config) =>
  expandRollNumbers(config.rollRanges)
    .map((rollNumber) =>
      createStudentPayload({ branch, batchYear, rollNumber, config }),
    )
    .sort((left, right) => left.rollNumber - right.rollNumber)

const assignHostelAndRoom = (students, occupiedRoomKeys) => {
  const maleStudents = students.filter((student) => student.gender === "male")
  const femaleStudents = students.filter(
    (student) => student.gender === "female",
  )

  const assignGroup = (group, hostels, genderLabel) => {
    for (let index = 0; index < group.length; index += 2) {
      const pair = group.slice(index, index + 2)
      const roomSeed = `${group[index].branch}:${group[index].batchYear}:${genderLabel}:${pair
        .map((student) => student.rollNumber)
        .join("-")}`
      const allocation = reserveRoom(hostels, roomSeed, occupiedRoomKeys)

      for (const student of pair) {
        student.hostel = allocation.hostel
        student.roomNumber = allocation.roomNumber
      }

      if (pair.length === 1) {
        // Keep the final unmatched student in a single-occupancy room to preserve same-gender allocation.
        pair[0].allocationNote = "single-occupancy"
      }
    }
  }

  assignGroup(maleStudents, MALE_HOSTELS, "male")
  assignGroup(femaleStudents, FEMALE_HOSTELS, "female")

  return {
    maleStudents: maleStudents.length,
    femaleStudents: femaleStudents.length,
    singleOccupancy: [...maleStudents, ...femaleStudents].filter(
      (student) => student.allocationNote === "single-occupancy",
    ).length,
  }
}

const reserveRoom = (hostels, seed, occupiedRoomKeys) => {
  const totalRoomOptions = hostels.length * (ROOM_MAX - ROOM_MIN + 1)

  for (let attempt = 0; attempt < totalRoomOptions; attempt += 1) {
    const hostel = pickFromList(seed, `hostel:${attempt}`, hostels)
    const roomNumber = String(
      ROOM_MIN + seededNumber(seed, `room:${attempt}`, ROOM_MAX - ROOM_MIN + 1),
    )
    const roomKey = `${hostel}|${roomNumber}`

    if (!occupiedRoomKeys.has(roomKey)) {
      occupiedRoomKeys.add(roomKey)
      return { hostel, roomNumber }
    }
  }

  throw new Error(
    `Unable to allocate a free hostel-room combination for seed ${seed}`,
  )
}

const chunk = (values, size) => {
  const chunks = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

const hashPassword = async (password) => bcrypt.hash(password, 10)

const isTimeoutError = (error) =>
  error?.code === "P1008" || /timed out/i.test(error?.message || "")

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withRetry = async (label, task, maxAttempts = 4) => {
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error

      if (!isTimeoutError(error) || attempt === maxAttempts) {
        throw error
      }

      const delayMs = 400 * attempt
      console.warn(
        `${label} timed out on attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms...`,
      )
      await wait(delayMs)
    }
  }

  throw lastError
}

const mapWithConcurrency = async (values, concurrency, mapper) => {
  const results = new Array(values.length)
  let nextIndex = 0

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        results[currentIndex] = await mapper(values[currentIndex], currentIndex)
      }
    },
  )

  await Promise.all(workers)
  return results
}

const createInsertRows = async (students) =>
  mapWithConcurrency(students, 20, async (student) => ({
    id: generateId(),
    name: student.name,
    email: student.email,
    passwordHash: await hashPassword(DEFAULT_PASSWORD),
    role: student.role,
    gender: student.gender,
    department: student.department,
    year: student.year,
    hostel: student.hostel,
    roomNumber: student.roomNumber,
    phoneNumber: student.phoneNumber,
    emergencyContact: student.emergencyContact,
    studentId: student.studentId,
  }))

const createStudentProfileRows = (users, studentMap) =>
  users
    .map((user) => {
      const student = studentMap.get(user.email)
      if (!student) {
        return null
      }

      return {
        userId: user.id,
        studentId: student.studentId,
        department: student.department,
        year: student.year,
        hostel: student.hostel,
        roomNumber: student.roomNumber || null,
      }
    })
    .filter(Boolean)

const formatSummaryLine = ({
  branch,
  batchYear,
  total,
  inserted,
  skipped,
  maleStudents,
  femaleStudents,
  singleOccupancy,
}) =>
  `${branch} ${batchYear}: total=${total}, inserted=${inserted}, skipped=${skipped}, male=${maleStudents}, female=${femaleStudents}, singleRooms=${singleOccupancy}`

const buildAllStudents = () => {
  const occupiedRoomKeys = new Set()
  const records = []
  const summaries = []

  for (const [branch, config] of Object.entries(BRANCH_CONFIG)) {
    for (const batchYear of Object.keys(BATCH_YEAR_TO_ACADEMIC_YEAR).map(
      Number,
    )) {
      const students = buildStudentsForBranchAndBatch(branch, batchYear, config)
      const allocationStats = assignHostelAndRoom(students, occupiedRoomKeys)

      records.push(...students)
      summaries.push({
        branch,
        batchYear,
        total: students.length,
        inserted: 0,
        skipped: 0,
        ...allocationStats,
      })
    }
  }

  return { records, summaries }
}

const attachExistingStatus = async (students, existsCheckChunkSize) => {
  const existingEmails = new Set()
  const existingStudentIds = new Set()

  for (const studentChunk of chunk(students, existsCheckChunkSize)) {
    const emails = studentChunk.map((student) => student.email)
    const studentIds = studentChunk.map((student) => student.studentId)

    const existingUsers = await withRetry(
      `Existing-user check for ${studentChunk[0].branch} ${studentChunk[0].batchYear} (${studentChunk.length} students)`,
      () =>
        prisma.user.findMany({
          where: {
            OR: [{ email: { in: emails } }, { studentId: { in: studentIds } }],
          },
          select: {
            email: true,
            studentId: true,
          },
        }),
    )

    for (const user of existingUsers) {
      if (user.email) {
        existingEmails.add(user.email)
      }

      if (user.studentId) {
        existingStudentIds.add(user.studentId)
      }
    }
  }

  return students.map((student) => ({
    ...student,
    exists:
      existingEmails.has(student.email) ||
      existingStudentIds.has(student.studentId),
  }))
}

const logBatchSummaries = (summaries, title) => {
  console.log(`\n${title}`)
  for (const summary of summaries) {
    console.log(`- ${formatSummaryLine(summary)}`)
  }
}

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. The script expects backend/.env to define it.",
    )
  }

  const { records, summaries } = buildAllStudents()
  const studentsWithExistingStatus = await attachExistingStatus(
    records,
    options.existsCheckChunkSize,
  )

  const summaryMap = new Map(
    summaries.map((summary) => [
      `${summary.branch}:${summary.batchYear}`,
      summary,
    ]),
  )

  for (const student of studentsWithExistingStatus) {
    const summary = summaryMap.get(`${student.branch}:${student.batchYear}`)
    if (!summary) {
      continue
    }

    if (student.exists) {
      summary.skipped += 1
    }
  }

  const studentsToInsert = studentsWithExistingStatus.filter(
    (student) => !student.exists,
  )

  console.log("Student ingestion started")
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`)
  console.log(`Students generated: ${records.length}`)
  console.log(`Students pending insert: ${studentsToInsert.length}`)

  if (options.dryRun) {
    for (const student of studentsToInsert.slice(0, 5)) {
      console.log(
        `Preview: ${student.email} | ${student.studentId} | ${student.gender} | ${student.hostel} ${student.roomNumber}`,
      )
    }

    logBatchSummaries(summaries, "Per-batch summary")
    return
  }

  let insertedTotal = 0
  let duplicateConflicts = 0

  for (const summary of summaries) {
    const branchBatchStudents = studentsToInsert.filter(
      (student) =>
        student.branch === summary.branch &&
        student.batchYear === summary.batchYear,
    )

    for (const group of chunk(branchBatchStudents, options.batchSize)) {
      const rows = await createInsertRows(group)
      const result = await withRetry(
        `Insert batch for ${summary.branch} ${summary.batchYear} (${rows.length} rows)`,
        () =>
          prisma.user.createMany({
            data: rows,
            skipDuplicates: true,
          }),
      )

      const insertedUsers = await withRetry(
        `Fetch inserted users for ${summary.branch} ${summary.batchYear}`,
        () =>
          prisma.user.findMany({
            where: {
              email: {
                in: group.map((student) => student.email),
              },
            },
            select: {
              id: true,
              email: true,
            },
          }),
      )

      const studentMap = new Map(
        group.map((student) => [student.email, student]),
      )
      const studentProfileRows = createStudentProfileRows(
        insertedUsers,
        studentMap,
      )

      if (studentProfileRows.length > 0) {
        await withRetry(
          `Insert student profiles for ${summary.branch} ${summary.batchYear}`,
          () =>
            prisma.studentProfile.createMany({
              data: studentProfileRows,
              skipDuplicates: true,
            }),
        )
      }

      insertedTotal += result.count
      duplicateConflicts += rows.length - result.count
      summary.inserted += result.count
      summary.skipped += rows.length - result.count
    }
  }

  logBatchSummaries(summaries, "Per-batch summary")

  const skippedTotal = summaries.reduce(
    (sum, summary) => sum + summary.skipped,
    0,
  )

  console.log("\nFinal summary")
  console.log(`- inserted=${insertedTotal}`)
  console.log(`- skipped=${skippedTotal}`)
  console.log(`- total=${records.length}`)
  console.log(`- duplicateConflictsDuringInsert=${duplicateConflicts}`)
}

run()
  .catch((error) => {
    console.error("\nStudent ingestion failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
