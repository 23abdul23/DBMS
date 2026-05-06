const path = require("path")
const { createRequire } = require("module")

const backendRoot = path.resolve(__dirname, "..")
const backendRequire = createRequire(path.join(backendRoot, "package.json"))

backendRequire("dotenv").config({ path: path.join(backendRoot, ".env") })

const { getPrismaClient, disconnectSQL } = require(
  path.join(backendRoot, "config", "prisma"),
)

const prisma = getPrismaClient()

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

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ["student", "warden", "security"],
      },
    },
    select: {
      id: true,
      role: true,
      studentId: true,
      department: true,
      year: true,
      hostel: true,
      roomNumber: true,
      guardId: true,
    },
  })

  const studentRows = users
    .filter(
      (user) =>
        user.role === "student" &&
        user.studentId &&
        user.department &&
        user.year &&
        user.hostel,
    )
    .map((user) => ({
      userId: user.id,
      studentId: user.studentId,
      department: user.department,
      year: user.year,
      hostel: user.hostel,
      roomNumber: user.roomNumber || null,
    }))

  const wardenRows = users
    .filter((user) => user.role === "warden" && user.hostel)
    .map((user) => ({
      userId: user.id,
      hostel: user.hostel,
    }))

  const securityRows = users
    .filter((user) => user.role === "security" && user.guardId && user.hostel)
    .map((user) => ({
      userId: user.id,
      guardId: user.guardId,
      securityPost: user.hostel,
    }))

  console.log("User profile backfill started")
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`)
  console.log(`Student profiles to backfill: ${studentRows.length}`)
  console.log(`Warden profiles to backfill: ${wardenRows.length}`)
  console.log(`Security profiles to backfill: ${securityRows.length}`)

  if (options.dryRun) {
    return
  }

  const [studentResult, wardenResult, securityResult] =
    await prisma.$transaction([
      prisma.studentProfile.createMany({
        data: studentRows,
        skipDuplicates: true,
      }),
      prisma.wardenProfile.createMany({
        data: wardenRows,
        skipDuplicates: true,
      }),
      prisma.securityProfile.createMany({
        data: securityRows,
        skipDuplicates: true,
      }),
    ])

  console.log("\nBackfill summary")
  console.log(`- studentProfilesInserted=${studentResult.count}`)
  console.log(`- wardenProfilesInserted=${wardenResult.count}`)
  console.log(`- securityProfilesInserted=${securityResult.count}`)
}

run()
  .catch((error) => {
    console.error("\nUser profile backfill failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null)
  })
