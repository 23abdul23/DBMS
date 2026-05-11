import { Queue } from "bullmq"

const REDIS_HOST = process.env.REDIS_HOST || "localhost"
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

const notificationQueue = new Queue("notifications", {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
})

export { notificationQueue }
