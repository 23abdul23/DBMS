require("dotenv").config()

const { getPrismaClient, disconnectSQL } = require("./config/prisma")

const prisma = getPrismaClient()

const args = process.argv.slice(2)

const exampleQueries = {
  basic: {
    description: "Preview a few users",
    sql: `SELECT id, name, email, role
FROM users
ORDER BY created_at DESC
LIMIT 5`,
  },
  joins: {
    description: "Join users with outpasses and their approvers",
    sql: `SELECT
    u.id AS user_id,
    u.name AS user_name,
    op.id AS outpass_id,
    op.status,
    op.created_at,
    a.name AS approved_by_name
FROM outpasses op
JOIN users u ON u.id = op.user_id
LEFT JOIN users a ON a.id = op.approved_by
ORDER BY op.created_at DESC
LIMIT 10`,
  },
  groupBy: {
    description: "Count outpasses by status",
    sql: `SELECT status, COUNT(*) AS total_outpasses
FROM outpasses
GROUP BY status
ORDER BY total_outpasses DESC`,
  },
  having: {
    description: "Find users with more than one outpass",
    sql: `SELECT
    u.id AS user_id,
    u.name AS user_name,
    COUNT(op.id) AS total_outpasses
FROM users u
JOIN outpasses op ON op.user_id = u.id
GROUP BY u.id, u.name
HAVING COUNT(op.id) > 1
ORDER BY total_outpasses DESC, u.name ASC`,
  },
  emergencies: {
    description: "Show emergency records with responder details",
    sql: `SELECT
    e.id,
    e.type,
    e.status,
    e.priority,
    o.name AS owner_name,
    r.name AS responder_name,
    e.created_at
FROM emergencies e
JOIN users o ON o.id = e.user_id
LEFT JOIN users r ON r.id = e.responded_by
ORDER BY e.created_at DESC
LIMIT 10`,
  },
}

const optionValue = args[0]
const sql = args.join(" ").trim()
const selectedExample = args[0] === "--example" ? args[1] : null

const isReadQuery = (statement) => {
  const normalized = statement
    .toLowerCase()
    .replace(/^\s*--.*$/gm, "")
    .trim()
  return /^(select|with|show|describe|explain)\b/.test(normalized)
}

const printUsage = () => {
  console.log("Usage:")
  console.log('  npm run sql -- "SELECT * FROM users LIMIT 5"')
  console.log("  npm run sql -- --list")
  console.log("  npm run sql -- --example basic")
  console.log("")
  console.log("Available examples:")
  for (const [name, example] of Object.entries(exampleQueries)) {
    console.log(`  ${name} - ${example.description}`)
  }
}

const runSql = async (statement) => {
  if (isReadQuery(statement)) {
    const rows = await prisma.$queryRawUnsafe(statement)
    console.log(`Returned ${rows.length} row(s)`)
    console.table(rows)
    return
  }

  const affected = await prisma.$executeRawUnsafe(statement)
  console.log(`Statement executed successfully. Rows affected: ${affected}`)
}

async function main() {
  if (!sql) {
    printUsage()
    return
  }

  if (optionValue === "--list") {
    printUsage()
    return
  }

  if (optionValue === "--example") {
    const example = exampleQueries[selectedExample]
    if (!example) {
      console.error(`Unknown example: ${selectedExample || "<missing>"}`)
      printUsage()
      process.exitCode = 1
      return
    }

    console.log(`Running example: ${selectedExample}`)
    console.log(example.sql)
    console.log("")
    await runSql(example.sql)
    return
  }

  await runSql(sql)
}

main()
  .catch((error) => {
    console.error("SQL runner failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL()
  })
