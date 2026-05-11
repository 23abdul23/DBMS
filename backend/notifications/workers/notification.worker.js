import { Worker } from "bullmq"
const { createNotification } = require("../services/notification.service")

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
