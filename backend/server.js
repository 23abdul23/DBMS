import dotenv from "dotenv"

dotenv.config()

const [
  { default: express },
  { default: cors },
  { default: helmet },
  { default: rateLimit },
  { default: cron },
  databaseModule,
  passwordOtpModule,
  campusActivitySimulationModule,
  campusActivityRulesModule,
  prismaModule,
  outpassLifecycleModule,
  authRoutesModule,
  outpassRoutesModule,
  emergencyRoutesModule,
  adminRoutesModule,
  securityRoutesModule,
  studentRoutesModule,
  wardenRoutesModule,
  forgotRoutesModule,
  sacRoutesModule,
  locationRoutesModule,
  libraryRoutesModule,
  securityAdminRoutesModule,
  notificationRoutesModule,

  eventBusModule,
  notificationQueueModule,
] = await Promise.all([
  import("express"),
  import("cors"),
  import("helmet"),
  import("express-rate-limit"),
  import("node-cron"),
  import("./config/database.js"),
  import("./utils/passwordOtp.js"),
  import("./utils/campusActivitySimulation.js"),
  import("./utils/campusActivityRules.js"),
  import("./config/prisma.js"),
  import("./utils/outpassLifecycle.js"),
  import("./routes/authRoutes.js"),
  import("./routes/outpassRoutes.js"),
  import("./routes/emergencyRoutes.js"),
  import("./routes/adminRoutes.js"),
  import("./routes/securityRoutes.js"),
  import("./routes/studentRoutes.js"),
  import("./routes/wardenRoutes.js"),
  import("./routes/forgotRoute.js"),
  import("./routes/sacRoutes.js"),
  import("./routes/locationRoutes.js"),
  import("./routes/libraryRoutes.js"),
  import("./routes/securityAdminRoutes.js"),
  import("./notifications/routes/notifications.js"),

  import("./notifications/events/eventBus.js"),
  import("./notifications/queues/notification.queue.js"),
])

const { connectDatabase, disconnectDatabase, getDatabaseMode } = databaseModule
const { cleanupExpiredPasswordOtps } = passwordOtpModule
const { runCampusActivitySimulation, runCampusClosingSweep } =
  campusActivitySimulationModule
const { CAMPUS_TIMEZONE } = campusActivityRulesModule
const { getPrismaClient } = prismaModule
const { expireOldOutpasses } = outpassLifecycleModule
const authRoutes = authRoutesModule.default
const outpassRoutes = outpassRoutesModule.default
const emergencyRoutes = emergencyRoutesModule.default
const adminRoutes = adminRoutesModule.default
const securityRoutes = securityRoutesModule.default
const studentRoutes = studentRoutesModule.default
const wardenRoutes = wardenRoutesModule.default
const forgotRoutes = forgotRoutesModule.default
const sacRoutes = sacRoutesModule.default
const locationRoutes = locationRoutesModule.default
const libraryRoutes = libraryRoutesModule.default
const securityAdminRoutes = securityAdminRoutesModule.default
const notificationRoutes = notificationRoutesModule.default
const { eventBus } = eventBusModule
const { notificationQueue } = notificationQueueModule

const app = express()
const PORT = process.env.PORT || 5000
const API_BASE_URL = process.API_BASE_URL
const DB_MODE = getDatabaseMode()
const prisma = getPrismaClient()
const ENABLE_CAMPUS_SIMULATION =
  String(process.env.ENABLE_CAMPUS_SIMULATION || "").toLowerCase() === "true" ||
  String(process.env.ENABLE_LIBRARY_SIMULATION || "").toLowerCase() === "true"

// Security middleware
app.use(helmet())

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow mobile apps, Postman, curl (no origin)
      if (!origin) {
        return callback(null, true)
      }

      // Allow browser frontend if needed
      const allowedOrigins = [API_BASE_URL]

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      // Allow mobile API access
      return callback(null, true)
    },
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Events
eventBus.on("OUTPASS_APPROVED", async (payload) => {
  await notificationQueue.add("send-notification", payload)
})

eventBus.on("OUTPASS_REJECTED", async (payload) => {
  await notificationQueue.add("send-notification", payload)
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/outpass", outpassRoutes)
app.use("/api/outpass/warden", wardenRoutes)
app.use("/api/emergency", emergencyRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/security", securityRoutes)
app.use("/api/security-admin", securityAdminRoutes)
app.use("/api/student", studentRoutes)
app.use("/api/warden", wardenRoutes)
app.use("/api/forgot", forgotRoutes)
app.use("/api/sac", sacRoutes)
app.use("/api/locations", locationRoutes)
app.use("/api/library", libraryRoutes)
app.use("/api/notifications", notificationRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Aegis ID Backend is running",
    databaseMode: DB_MODE,
    timestamp: new Date().toISOString(),
  })
})

if (app._router && app._router.stack) {
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log("Route:", r.route.path)
    }
  })
}
cron.schedule("*/5 * * * *", async () => {
  try {
    const result = await cleanupExpiredPasswordOtps()
    if (result?.count) {
      console.log(`Cleaned up ${result.count} expired password OTP record(s)`)
    }
  } catch (error) {
    console.error("Password OTP cleanup failed:", error)
  }
})

cron.schedule(
  "0 2 * * *",
  async () => {
    try {
      const expiredCount = await expireOldOutpasses(prisma)
      if (expiredCount > 0) {
        console.log(
          `Nightly outpass expiry marked ${expiredCount} outpass(es) as expired.`,
        )
      }
    } catch (error) {
      console.error("Nightly outpass expiry cron failed:", error)
    }
  },
  { timezone: CAMPUS_TIMEZONE },
)

if (ENABLE_CAMPUS_SIMULATION) {
  cron.schedule(
    "*/59 * * * *",
    async () => {
      try {
        const result = await runCampusActivitySimulation()
        if (!result?.skipped) {
          console.log(
            `Campus simulation profile=${result.profile} internalMoves=${result.internalMoves} outpassRequests=${result.outpassRequests} departures=${result.gateDepartures} returns=${result.gateReturns}.`,
          )
        }
      } catch (error) {
        console.error("Campus simulation cron failed:", error)
      }
    },
    { timezone: CAMPUS_TIMEZONE },
  )

  cron.schedule(
    "0 23 * * *",
    async () => {
      try {
        const result = await runCampusClosingSweep()
        if (!result?.skipped) {
          console.log(
            `Campus closing sweep settled ${result.settledCount} student(s) back to hostels.`,
          )
        }
      } catch (error) {
        console.error("Campus closing sweep cron failed:", error)
      }
    },
    { timezone: CAMPUS_TIMEZONE },
  )
}

// Error handling middleware (keep this above 404 handler)
app.use((err, req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  })
})

// 404 handler (only once, at the very end)
app.all("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down server...`)
  await disconnectDatabase()
  process.exit(0)
}

const startServer = async () => {
  try {
    const { mode } = await connectDatabase()
    app.listen(PORT, () => {
      console.log(`🚀 Aegis ID Backend running on port ${PORT}`)
      console.log(`🗄️ Database mode: ${mode}`)
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

startServer()

export default app
