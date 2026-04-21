import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.POSTGRES_URL || "postgresql://postgres:postgres@db:5432/aegis?schema=public",
  },
})