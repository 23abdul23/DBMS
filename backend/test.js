require("dotenv").config()

const { getPrismaClient, disconnectSQL } = require("./config/prisma")

const prisma = getPrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      id: {
        startsWith: "iit2024",
      },
    },
    take: 5,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  console.log("Users matching query:")
  console.table(users)
}

main()
  .catch((error) => {
    console.error("Prisma test query failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectSQL()
  })
