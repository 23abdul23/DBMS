const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const cron = require("node-cron")
require("dotenv").config()

const { connectDatabase, disconnectDatabase, getDatabaseMode } = require("./config/database")
const { generateDailyPasskeys } = require("./utils/hashGenerator")
const { cleanupExpiredPasswordOtps } = require("./utils/passwordOtp")
const {
  runCampusActivitySimulation,
  runCampusClosingSweep,
  CAMPUS_TIMEZONE,
} = require("./utils/campusActivitySimulation")

// Import routes
const authRoutes = require("./routes/authRoutes")
const passkeyRoutes = require("./routes/passkeyRoutes")
const outpassRoutes = require("./routes/outpassRoutes")
const emergencyRoutes = require("./routes/emergencyRoutes")
const adminRoutes = require("./routes/adminRoutes")
const securityRoutes = require("./routes/securityRoutes")
const studentRoutes = require("./routes/studentRoutes")
const wardenRoutes = require("./routes/wardenRoutes")
const forgotRoutes = require("./routes/forgotRoute")
const sacRoutes = require("./routes/sacRoutes")

const app = express()
const PORT = process.env.PORT || 5000
const DB_MODE = getDatabaseMode()
const ENABLE_CAMPUS_SIMULATION =
  String(process.env.ENABLE_CAMPUS_SIMULATION || "").toLowerCase() === "true" ||
  String(process.env.ENABLE_LIBRARY_SIMULATION || "").toLowerCase() === "true"

// Security middleware
app.use(helmet())

const allowedOrigins = [
  process.env.FRONTEND_URL || 
  "http://localhost:3000", 
  "http://172.19.13.123:3000",
  "http://localhost:8081", // Expo web dev
]

app.use(cors({
  origin: function (origin, callback) {
    // Allow mobile apps, Postman, curl (no origin)
    if (!origin) {
      return callback(null, true);
    }

    // Allow browser frontend if needed
    const allowedOrigins = [
      "http://localhost:3000"
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow mobile API access
    return callback(null, true);
  },
  credentials: true
}));app.use(cors());


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/passkey", passkeyRoutes)
app.use("/api/outpass", outpassRoutes)
app.use("/api/outpass/warden", wardenRoutes)
app.use("/api/emergency", emergencyRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/security", securityRoutes)
app.use("/api/student", studentRoutes)
app.use("/api/warden", wardenRoutes)
app.use("/api/forgot", forgotRoutes)
app.use("/api/sac", sacRoutes)

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



// Daily passkey generation cron job (runs at midnight)
cron.schedule("0 0 * * *", async () => {
  console.log("Generating daily passkeys...")
  try {
    await generateDailyPasskeys()
    console.log("Daily passkeys generated successfully")
  } catch (error) {
    console.error("Error generating daily passkeys:", error)
  }
})

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

if (ENABLE_CAMPUS_SIMULATION) {
  cron.schedule(
    "*/40 * * * *",
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
          console.log(`Campus closing sweep settled ${result.settledCount} student(s) back to hostels.`)
        }
      } catch (error) {
        console.error("Campus closing sweep cron failed:", error)
      }
    },
    { timezone: CAMPUS_TIMEZONE },
  )
}

// Error handling middleware (keep this above 404 handler)
app.use((err, req, res, next) => {
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

module.exports = app
