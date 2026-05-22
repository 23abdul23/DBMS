import { Worker } from "bullmq"
import {
  createNotification,
  processNotificationDelivery,
} from "../services/notification.service.js"

const REDIS_HOST = process.env.REDIS_HOST || "localhost"
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

const worker = new Worker(
  "notifications",
  async (job) => {
    console.log(`[Worker] Processing ${job.name} job ${job.id}...`)

    try {
      const result =
        job.name === "send-push-delivery"
          ? await processNotificationDelivery(job)
          : await createNotification(job.data)

      console.log(
        `[Worker] ${job.name} job ${job.id} completed with status ${result?.status || "ok"}`,
      )

      return result
    } catch (error) {
      console.error(
        `[Worker] Error processing ${job.name} job ${job.id}:`,
        error.message,
      )
      throw error
    }
  },
  {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
    },
  },
)

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} (${job.name}) completed`)
})

worker.on("failed", (job, error) => {
  console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, error.message)
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

console.log("[Worker] Notification worker started and listening for jobs...")
console.log(
  `[Worker] Queue: 'notifications' | Redis: ${REDIS_HOST}:${REDIS_PORT}`,
)

export { worker }
