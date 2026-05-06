import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { spawn } from "child_process"
import { getPrismaClient, disconnectSQL } from "../config/prisma.js"
import { generateId } from "../utils/hashGenerator.js"
import { SAC_ADMIN_EMAIL, LIBRARY_ADMIN_EMAIL } from "../utils/adminScopes.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(backendRoot, ".env") })

const prisma = getPrismaClient()

const DEFAULT_PASSWORD = "123456"
const DEFAULT_STUDENT_EMAIL = "iit2023001@iiita.ac.in"
const DEFAULT_WARDEN_EMAIL = "warden.bh-1@iiita.ac.in"
const DEFAULT_SECURITY_EMAIL = "guard100@iiita.ac.in"

const parseCliArgs = (argv) => ({
  dryRun: argv.includes("--dry-run"),
  skipBootstrap: argv.includes("--skip-bootstrap"),
})

const runNodeScript = (scriptName, options) =>
  new Promise((resolve, reject) => {
    const args = [path.join(__dirname, scriptName)]

    if (options.dryRun) {
      args.push("--dry-run")
    }

    const child = spawn(process.execPath, args, {
      cwd: backendRoot,
      stdio: "inherit",
      env: process.env,
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${scriptName} failed with exit code ${code}`))
    })
  })

const subtractMinutes = (date, minutes) =>
  new Date(date.getTime() - minutes * 60 * 1000)

const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * 60 * 1000)

const buildAuditItems = ({
  outpassId,
  actorUserId,
  status,
  createdAt,
  rejectionReason = null,
}) => {
  const pendingAt = subtractMinutes(createdAt, 1)
  const items = [
    {
      id: generateId(),
      outpassId,
      status: "pending",
      changedBy: actorUserId,
      changedAt: pendingAt,
      remarks: "DEV_SEED: Request submitted",
    },
  ]

  if (status !== "pending") {
    items.push({
      id: generateId(),
      outpassId,
      status,
      changedBy: actorUserId,
      changedAt: createdAt,
      remarks:
        status === "rejected"
          ? `DEV_SEED: Rejected - ${rejectionReason || "Test rejection"}`
          : `DEV_SEED: Status set to ${status}`,
    })
  }

  return items
}

const createOutpassWithAudit = async ({
  userId,
  approvedById,
  reason,
  destination,
  outDate,
  expectedReturnDate,
  status,
  requestType = "regular",
  actualReturnDate = null,
  rejectionReason = null,
}) => {
  const outpass = await prisma.outpass.create({
    data: {
      id: generateId(),
      userId,
      reason,
      destination,
      outDate,
      expectedReturnDate,
      actualReturnDate,
      requestType,
      status,
      approvedById,
      rejectionReason,
      emergencyContactName: "Campus Test Contact",
      emergencyContactPhone: "9000000000",
      createdAt: subtractMinutes(outDate, 10),
      updatedAt: addMinutes(outDate, 5),
    },
  })

  const auditItems = buildAuditItems({
    outpassId: outpass.id,
    actorUserId: approvedById || userId,
    status,
    createdAt: addMinutes(outDate, 2),
    rejectionReason,
  })

  await prisma.outpassAuditTrail.createMany({ data: auditItems })

  return outpass
}

const createLog = async ({
  userId,
  action,
  location,
  createdAt,
  guardId = null,
  guardName = null,
  details = {},
  success = true,
}) =>
  prisma.log.create({
    data: {
      id: generateId(),
      userId,
      action,
      location,
      guardId,
      guardName,
      success,
      scanType: "manual",
      createdAt,
      details: {
        seedTag: "DEV_DUMMY_DATA",
        ...details,
      },
    },
  })

const seedScenarioData = async (accounts, options) => {
  const now = new Date()
  const student = accounts.student
  const backupStudent = accounts.studentsForHostel[1] || student
  const thirdStudent = accounts.studentsForHostel[2] || student
  const warden = accounts.warden
  const security = accounts.security
  const sacAdmin = accounts.sacAdmin
  const libraryAdmin = accounts.libraryAdmin

  console.log("\nSeeding outpass scenarios")

  if (!options.dryRun) {
    const pendingOutDate = addMinutes(now, 30)
    const approvedOutDate = subtractMinutes(now, 120)
    const returnedOutDate = subtractMinutes(now, 200)
    const expiredOutDate = subtractMinutes(now, 320)
    const rejectedOutDate = subtractMinutes(now, 260)

    await createOutpassWithAudit({
      userId: student.id,
      approvedById: warden.id,
      reason: "DEV_SEED: Pending city visit",
      destination: "Civil Lines",
      outDate: pendingOutDate,
      expectedReturnDate: addMinutes(pendingOutDate, 180),
      status: "pending",
    })

    const approvedOutpass = await createOutpassWithAudit({
      userId: backupStudent.id,
      approvedById: warden.id,
      reason: "DEV_SEED: Approved market visit",
      destination: "Naini Market",
      outDate: approvedOutDate,
      expectedReturnDate: addMinutes(now, 210),
      status: "approved",
    })

    const returnedOutpass = await createOutpassWithAudit({
      userId: thirdStudent.id,
      approvedById: warden.id,
      reason: "DEV_SEED: Returned stationery visit",
      destination: "Stationery Store",
      outDate: returnedOutDate,
      expectedReturnDate: subtractMinutes(now, 60),
      actualReturnDate: subtractMinutes(now, 30),
      status: "approved",
    })

    await createOutpassWithAudit({
      userId: student.id,
      approvedById: warden.id,
      reason: "DEV_SEED: Expired outing",
      destination: "City Bus Stand",
      outDate: expiredOutDate,
      expectedReturnDate: subtractMinutes(now, 140),
      status: "expired",
    })

    await createOutpassWithAudit({
      userId: backupStudent.id,
      approvedById: warden.id,
      reason: "DEV_SEED: Rejected long visit",
      destination: "Home",
      outDate: rejectedOutDate,
      expectedReturnDate: addMinutes(rejectedOutDate, 600),
      status: "rejected",
      requestType: "long_visit",
      rejectionReason: "DEV_SEED: Missing supporting details",
    })

    await createLog({
      userId: backupStudent.id,
      action: "exit",
      location: "Main Gate",
      createdAt: addMinutes(approvedOutDate, 5),
      guardId: security.guardId || null,
      guardName: security.name,
      details: {
        outpassId: approvedOutpass.id,
        message: "DEV_SEED: Student exited with approved outpass",
      },
    })

    await createLog({
      userId: thirdStudent.id,
      action: "exit",
      location: "Main Gate",
      createdAt: addMinutes(returnedOutDate, 5),
      guardId: security.guardId || null,
      guardName: security.name,
      details: {
        outpassId: returnedOutpass.id,
        message: "DEV_SEED: Student exited and later returned",
      },
    })

    await createLog({
      userId: thirdStudent.id,
      action: "entry",
      location: "Main Gate",
      createdAt: subtractMinutes(now, 30),
      guardId: security.guardId || null,
      guardName: security.name,
      details: {
        outpassId: returnedOutpass.id,
        message: "DEV_SEED: Student returned to campus",
      },
    })

    await createLog({
      userId: student.id,
      action: "without_outpass",
      location: "Main Gate",
      createdAt: subtractMinutes(now, 25),
      guardId: security.guardId || null,
      guardName: security.name,
      success: false,
      details: {
        reasonCode: "pending_approval",
        message: "DEV_SEED: Exit attempt blocked without approved outpass",
      },
    })

    console.log(
      "Outpass scenarios created: pending, approved, returned, expired, rejected",
    )
  } else {
    console.log("Dry run: outpass scenarios would be created")
  }

  console.log("\nSeeding SAC and Library activity")

  if (!options.dryRun) {
    const sacRoomSession = await prisma.sacRoomSession.create({
      data: {
        id: generateId(),
        roomName: "Virtuosi",
        openedByUserId: sacAdmin.id,
        openedAt: subtractMinutes(now, 80),
        lastActivityAt: subtractMinutes(now, 8),
      },
    })

    await prisma.sacRoomPresence.createMany({
      data: [
        {
          id: generateId(),
          sessionId: sacRoomSession.id,
          userId: student.id,
          joinedAt: subtractMinutes(now, 70),
          leftAt: null,
        },
        {
          id: generateId(),
          sessionId: sacRoomSession.id,
          userId: backupStudent.id,
          joinedAt: subtractMinutes(now, 60),
          leftAt: subtractMinutes(now, 15),
        },
      ],
    })

    await prisma.sacEquipmentCheckout.createMany({
      data: [
        {
          id: generateId(),
          equipmentName: "Table Tennis",
          userId: student.id,
          checkedOutAt: subtractMinutes(now, 50),
          returnedAt: null,
        },
        {
          id: generateId(),
          equipmentName: "Carrom",
          userId: backupStudent.id,
          checkedOutAt: subtractMinutes(now, 95),
          returnedAt: subtractMinutes(now, 40),
        },
      ],
    })

    await createLog({
      userId: sacAdmin.id,
      action: "sac_room_opened",
      location: "SAC",
      createdAt: subtractMinutes(now, 80),
      details: {
        roomName: "Virtuosi",
        description: "DEV_SEED: Room opened",
      },
    })

    await createLog({
      userId: student.id,
      action: "sac_room_joined",
      location: "SAC",
      createdAt: subtractMinutes(now, 70),
      details: {
        roomName: "Virtuosi",
        description: "DEV_SEED: Student joined room",
      },
    })

    await createLog({
      userId: backupStudent.id,
      action: "sac_room_left",
      location: "SAC",
      createdAt: subtractMinutes(now, 15),
      details: {
        roomName: "Virtuosi",
        description: "DEV_SEED: Student left room",
      },
    })

    await createLog({
      userId: student.id,
      action: "sac_equipment_taken",
      location: "SAC",
      createdAt: subtractMinutes(now, 50),
      details: {
        equipmentName: "Table Tennis",
        description: "DEV_SEED: Equipment taken",
      },
    })

    await createLog({
      userId: backupStudent.id,
      action: "sac_equipment_returned",
      location: "SAC",
      createdAt: subtractMinutes(now, 40),
      details: {
        equipmentName: "Carrom",
        description: "DEV_SEED: Equipment returned",
      },
    })

    await prisma.librarySeatSession.createMany({
      data: [
        {
          id: generateId(),
          userId: student.id,
          seatNumber: 11,
          enteredAt: subtractMinutes(now, 55),
          leftAt: null,
          lastActivityAt: subtractMinutes(now, 5),
        },
        {
          id: generateId(),
          userId: backupStudent.id,
          seatNumber: 12,
          enteredAt: subtractMinutes(now, 120),
          leftAt: subtractMinutes(now, 35),
          lastActivityAt: subtractMinutes(now, 35),
        },
      ],
    })

    await createLog({
      userId: student.id,
      action: "library_seat_taken",
      location: "Library",
      createdAt: subtractMinutes(now, 55),
      details: {
        seatNumber: 11,
        description: "DEV_SEED: Took the Token Number 11 seat",
      },
    })

    await createLog({
      userId: backupStudent.id,
      action: "library_seat_released",
      location: "Library",
      createdAt: subtractMinutes(now, 35),
      details: {
        seatNumber: 12,
        description: "DEV_SEED: Released the Token Number 12 seat",
      },
    })

    await createLog({
      userId: libraryAdmin.id,
      action: "library_seat_released",
      location: "Library",
      createdAt: subtractMinutes(now, 20),
      details: {
        seatNumber: 12,
        description: "DEV_SEED: Library admin verified seat release",
      },
    })

    console.log("SAC and Library scenarios created")
  } else {
    console.log("Dry run: SAC and Library scenarios would be created")
  }
}

const resolveAccounts = async () => {
  const [
    studentByEmail,
    wardenByEmail,
    securityByEmail,
    sacAdmin,
    libraryAdmin,
  ] = await Promise.all([
    prisma.user.findFirst({
      where: { email: DEFAULT_STUDENT_EMAIL, role: "student" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostel: true,
        guardId: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: DEFAULT_WARDEN_EMAIL, role: "warden" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostel: true,
        guardId: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: DEFAULT_SECURITY_EMAIL, role: "security" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostel: true,
        guardId: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: SAC_ADMIN_EMAIL, role: "admin" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostel: true,
        guardId: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: LIBRARY_ADMIN_EMAIL, role: "admin" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostel: true,
        guardId: true,
      },
    }),
  ])

  const student =
    studentByEmail ||
    (await prisma.user.findFirst({
      where: { role: "student" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostel: true,
        guardId: true,
      },
    }))

  if (
    !student ||
    !wardenByEmail ||
    !securityByEmail ||
    !sacAdmin ||
    !libraryAdmin
  ) {
    throw new Error(
      "Required dummy accounts are missing. Run ingest scripts first: students, wardens, guards, and activity admins.",
    )
  }

  const studentsForHostel = await prisma.user.findMany({
    where: {
      role: "student",
      hostel: wardenByEmail.hostel,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 12,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hostel: true,
      guardId: true,
    },
  })

  return {
    student,
    warden: wardenByEmail,
    security: securityByEmail,
    sacAdmin,
    libraryAdmin,
    studentsForHostel:
      studentsForHostel.length > 0 ? studentsForHostel : [student],
  }
}

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. The script expects backend/.env to define it.",
    )
  }

  console.log("Dev dummy data seed started")
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`)

  //   if (!options.skipBootstrap) {
  //     console.log("\nRunning bootstrap ingestion scripts")

  //     await runNodeScript("ingest_to_db_students.js", options)
  //     await runNodeScript("ingest_to_db_wardens.js", options)
  //     await runNodeScript("ingest_to_db_guards.js", options)
  //     await runNodeScript("ingest_to_db_activity_admins.js", options)
  //     await runNodeScript("backfill_user_profiles.js", options)
  //   }

  const accounts = await resolveAccounts()

  console.log("\nResolved quick-login accounts")
  console.log(`- student: ${accounts.student.email}`)
  console.log(`- warden: ${accounts.warden.email}`)
  console.log(`- security: ${accounts.security.email}`)
  console.log(`- sac_admin: ${accounts.sacAdmin.email}`)
  console.log(`- library_admin: ${accounts.libraryAdmin.email}`)
  console.log(`- default password: ${DEFAULT_PASSWORD}`)

  await seedScenarioData(accounts, options)

  console.log("\nDev dummy data seed completed")
}

run()
  .catch((error) => {
    console.error("\nDev dummy data seed failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
