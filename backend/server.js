const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const cron = require("node-cron")
require("dotenv").config()

const { connectDatabase, disconnectDatabase, getDatabaseMode } = require("./config/database")
const { generateDailyPasskeys } = require("./utils/hashGenerator")
const { runLibraryVisitSimulation, runLibraryClosingSweep, LIBRARY_TIMEZONE } = require("./utils/libraryVisitSimulator")

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

const app = express()
const PORT = process.env.PORT || 5000
const DB_MODE = getDatabaseMode()
const ENABLE_LIBRARY_SIMULATION = String(process.env.ENABLE_LIBRARY_SIMULATION || "").toLowerCase() === "true"

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

if (ENABLE_LIBRARY_SIMULATION) {
  cron.schedule(
    "*/10 7-22 * * *",
    async () => {
      try {
        const result = await runLibraryVisitSimulation()
        if (!result?.skipped) {
          console.log(
            `Library simulation created ${result.createdCount} logs (${result.entryCount} entries, ${result.exitCount} exits) at hour ${result.localHour}.`,
          )
        }
      } catch (error) {
        console.error("Library simulation cron failed:", error)
      }
    },
    { timezone: LIBRARY_TIMEZONE },
  )

  cron.schedule(
    "0 23 * * *",
    async () => {
      try {
        const result = await runLibraryClosingSweep()
        if (!result?.skipped) {
          console.log(`Library closing sweep created ${result.createdCount} exit logs.`)
        }
      } catch (error) {
        console.error("Library closing sweep cron failed:", error)
      }
    },
    { timezone: LIBRARY_TIMEZONE },
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
