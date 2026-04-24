import { defineConfig } from "prisma/config"
import { config as loadDotEnv } from "dotenv"
import path from "path"

loadDotEnv({ path: path.resolve(process.cwd(), ".env") })

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/aegis?schema=public",
  },
})