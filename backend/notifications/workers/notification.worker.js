import { Worker } from "bullmq"
import { createNotification } from "../services/notification.service.js"

const worker = new Worker(
  "notifications",
  async (job) => {
    console.log(`[Worker] Processing notification job ${job.id}...`)
    try {
      const result = await createNotification(job.data)
      console.log(`[Worker] Notification job ${job.id} completed successfully`)
      return result
    } catch (error) {
      console.error(`[Worker] Error processing job ${job.id}:`, error.message)
      throw error
    }
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
    },
  },
)

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`)
})

worker.on("failed", (job, error) => {
  console.error(`[Worker] Job ${job.id} failed:`, error.message)
})

worker.on("error", (error) => {
  console.error("[Worker] Worker error:", error)
})

const shutdown = async (signal) => {
  console.log(`[Worker] ${signal} received. Shutting down worker...`)
  await worker.close()
  console.log("[Worker] Worker closed gracefully")
  process.exit(0)
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

console.log("[Worker] 🚀 Notification worker started and listening for jobs...")
console.log("[Worker] Queue: 'notifications' | Redis: localhost:6379")

export { worker }
