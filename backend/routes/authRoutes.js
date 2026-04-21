const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { getPrismaClient } = require("../config/prisma")
const { authenticate } = require("../middleware/auth")
const { generateId } = require("../utils/hashGenerator")

const prisma = getPrismaClient()
const router = express.Router()

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  gender: true,
  department: true,
  year: true,
  hostel: true,
  roomNumber: true,
  phoneNumber: true,
  emergencyContact: true,
  profilePhoto: true,
  studentId: true,
  guardId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
}

const loginUserSelect = {
  ...userSelect,
  passwordHash: true,
}

const roleValues = new Set(["student", "warden", "security", "admin"])
const genderValues = new Set(["male", "female", "other"])
const departmentMap = {
  it: "IT",
  it_bi: "IT_BI",
  electronics: "Electronics",
}
// Maps user input variants to Prisma enum values (uppercase)
const yearMap = {
  1: "FIRST_YEAR",
  2: "SECOND_YEAR",
  3: "THIRD_YEAR",
  4: "FOURTH_YEAR",
  year1: "FIRST_YEAR",
  year2: "SECOND_YEAR",
  year3: "THIRD_YEAR",
  year4: "FOURTH_YEAR",
  year_1: "FIRST_YEAR",
  year_2: "SECOND_YEAR",
  year_3: "THIRD_YEAR",
  year_4: "FOURTH_YEAR",
  "1st year": "FIRST_YEAR",
  "2nd year": "SECOND_YEAR",
  "3rd year": "THIRD_YEAR",
  "4th year": "FOURTH_YEAR",
  first_year: "FIRST_YEAR",
  second_year: "SECOND_YEAR",
  third_year: "THIRD_YEAR",
  fourth_year: "FOURTH_YEAR",
  FIRST_YEAR: "FIRST_YEAR",
  SECOND_YEAR: "SECOND_YEAR",
  THIRD_YEAR: "THIRD_YEAR",
  FOURTH_YEAR: "FOURTH_YEAR",
}

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return undefined
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : undefined
}

const serializeUser = (user) => {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    _id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gender: user.gender,
    department: user.department,
    year: user.year,
    hostel: user.hostel,
    roomNumber: user.roomNumber,
    phoneNumber: user.phoneNumber,
    emergencyContact: user.emergencyContact,
    profilePhoto: user.profilePhoto,
    studentId: user.studentId,
    guardId: user.guardId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

const normalizeRole = (value, fallback = "student") => {
  if (!value) {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  return roleValues.has(normalized) ? normalized : fallback
}

const normalizeGender = (value) => {
  if (!value) {
    return undefined
  }

  const normalized = String(value).trim().toLowerCase()
  return genderValues.has(normalized) ? normalized : undefined
}

const normalizeDepartment = (value) => {
  if (!value) {
    return undefined
  }

  const normalized = String(value).trim().toLowerCase()
  return departmentMap[normalized] || undefined
}

const normalizeYear = (value) => {
  if (!value) {
    return undefined
  }

  const normalized = String(value).trim().toLowerCase()
  return yearMap[normalized] || undefined
}

const parseRequestedUser = (value) => {
  if (!value) {
    return null
  }

  if (typeof value === "object") {
    return value
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch (error) {
      return { id: value }
    }
  }

  return null
}

// Register new user
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      studentId,
      guardId,
      hostel,
      roomNumber,
      phoneNumber,
      emergencyContact,
      gender,
      year,
      department,
      role,
    } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const normalizedRole = normalizeRole(role)

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          studentId ? { studentId } : null,
          guardId ? { guardId } : null,
        ].filter(Boolean),
      },
    })

    if (existingUser) {
      return res.status(400).json({ message: "User with this email, student ID, or guard ID already exists" })
    }

    const newUser = await prisma.user.create({
      data: {
        id: generateId(),
        name: normalizeText(name),
        email: normalizeText(email),
        passwordHash,
        studentId: normalizeText(studentId),
        guardId: normalizeText(guardId),
        hostel: normalizeText(hostel),
        roomNumber: normalizeText(roomNumber),
        phoneNumber: normalizeText(phoneNumber),
        emergencyContact: normalizeText(emergencyContact),
        gender: normalizeGender(gender),
        year: normalizeYear(year),
        department: normalizeDepartment(department),
        role: normalizedRole,
      },
      select: userSelect,
    })

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE,
      },
    )

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: serializeUser(newUser),
    })
  } catch (error) {
    console.error("Registration error:", error)

    if (error.code === "P2002") {
      return res.status(400).json({ message: "A user with those details already exists" })
    }

    res.status(500).json({ message: "Server error during registration" })
  }
})

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    const normalizedRole = role ? normalizeRole(role, null) : null
    if (role && !normalizedRole) {
      return res.status(400).json({ message: "Invalid role" })
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        ...(normalizedRole ? { role: normalizedRole } : {}),
      },
      select: loginUserSelect,
    })

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials: user not found" })
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: "Account password is missing. Please reset your password." })
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatches) {
      return res.status(400).json({ message: "Invalid credentials: incorrect password" })
    }

    const refreshedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: user.isActive,
      },
      select: userSelect,
    })

    const token = jwt.sign(
      { userId: refreshedUser.id, role: refreshedUser.role },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE,
      },
    )

    res.json({
      message: "Login successful",
      token,
      user: serializeUser(refreshedUser),
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error during login" })
  }
})

// Get current user profile
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userSelect,
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ user: serializeUser(user) })
  } catch (error) {
    console.error("Profile fetch error:", error)
    res.status(500).json({ message: "Server error fetching profile" })
  }
})

// Update user profile
router.put("/profile", authenticate, async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      email,
      studentId,
      guardId,
      emergencyContact,
      hostel,
      roomNumber,
      year,
      department,
      gender,
    } = req.body

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        name: normalizeText(name),
        phoneNumber: normalizeText(phoneNumber),
        email: normalizeText(email),
        studentId: normalizeText(studentId),
        guardId: normalizeText(guardId),
        emergencyContact: normalizeText(emergencyContact),
        hostel: normalizeText(hostel),
        roomNumber: normalizeText(roomNumber),
        year: normalizeYear(year),
        department: normalizeDepartment(department),
        gender: normalizeGender(gender),
      },
      select: userSelect,
    })

    res.json({ message: "Profile updated successfully", user: serializeUser(user) })
  } catch (error) {
    console.error("Profile update error:", error)

    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email, student ID, or guard ID already exists" })
    }

    res.status(500).json({ message: "Server error updating profile" })
  }
})

router.get("/fetchProfile", async (req, res) => {
  try {
    const requestedUser = parseRequestedUser(req.query.user)
    const requestedUserId = requestedUser?.id || req.query.userId || req.query.id

    if (!requestedUserId) {
      return res.status(400).json({ message: "User id is required" })
    }

    const user = await prisma.user.findUnique({
      where: { id: requestedUserId },
      select: userSelect,
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (requestedUser?.role && requestedUser.role !== user.role) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ user: serializeUser(user) })
  } catch (error) {
    console.error("Profile fetch error:", error)
    res.status(500).json({ message: "Server error fetching profile" })
  }
})

module.exports = router
