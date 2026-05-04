require("dotenv").config()

const { getPrismaClient, disconnectSQL } = require("./config/prisma")

const prisma = getPrismaClient()

const sql = process.argv.slice(2).join(" ").trim()

const isReadQuery = (statement) => {
  const normalized = statement.toLowerCase().replace(/^\s*--.*$/gm, "").trim()
  return /^(select|with|show|describe|explain)\b/.test(normalized)
}

async function main() {
  if (!sql) {
    console.log('Usage: npm run sql -- "SELECT * FROM users LIMIT 5"')
    process.exitCode = 1
    return
  }

  if (isReadQuery(sql)) {
    const rows = await prisma.$queryRawUnsafe(sql)
    console.log(`Returned ${rows.length} row(s)`)
    console.table(rows)
    return
  }

  const affected = await prisma.$executeRawUnsafe(sql)
  console.log(`Statement executed successfully. Rows affected: ${affected}`)
}

main()
  .catch((error) => {
    console.error("SQL runner failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL()
  })