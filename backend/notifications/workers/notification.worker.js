import { Worker } from "bullmq"
import { createNotification } from "../services/notification.service.js"

const worker = new Worker(
  "notifications",
  async (job) => {
    await createNotification(job.data)
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
    },
  },
)

export { worker }
