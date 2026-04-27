const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { getPrismaClient } = require("../config/prisma")
const { authenticate } = require("../middleware/auth")
const { generateId } = require("../utils/hashGenerator")
const { userSelect, userSelectWithPassword, serializeUser } = require("../utils/userProfiles")

const prisma = getPrismaClient()
const router = express.Router()

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

const normalizeRole = (value, fallback = "student") => {
  if (!value) {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (roleValues.has(normalized)) {
    return normalized
  }
  if (normalized === "sac_admin" || normalized === "library_admin") {
    return "admin"
  }
  return fallback
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

const buildRoleProfileCreateData = ({ role, studentId, guardId, hostel, roomNumber, year, department, securityPost }) => {
  if (role === "student" && studentId && department && year && hostel) {
    return {
      studentProfile: {
        create: {
          studentId,
          department,
          year,
          hostel,
          roomNumber: roomNumber || null,
        },
      },
    }
  }

  if (role === "warden" && hostel) {
    return {
      wardenProfile: {
        create: {
          hostel,
        },
      },
    }
  }

  if (role === "security" && guardId && securityPost) {
    return {
      securityProfile: {
        create: {
          guardId,
          securityPost,
        },
      },
    }
  }

  return {}
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
      securityPost,
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
    const normalizedStudentId = normalizeText(studentId)
    const normalizedGuardId = normalizeText(guardId)
    const normalizedHostel = normalizeText(hostel)
    const normalizedSecurityPost = normalizeText(securityPost || hostel)
    const normalizedRoomNumber = normalizeText(roomNumber)
    const normalizedPhoneNumber = normalizeText(phoneNumber)
    const normalizedEmergencyContact = normalizeText(emergencyContact)
    const normalizedGender = normalizeGender(gender)
    const normalizedYear = normalizeYear(year)
    const normalizedDepartment = normalizeDepartment(department)

    if (normalizedRole === "student" && (!normalizedStudentId || !normalizedDepartment || !normalizedYear || !normalizedHostel)) {
      return res.status(400).json({ message: "Student registration requires student ID, department, year, and hostel" })
    }

    if (normalizedRole === "warden" && !normalizedHostel) {
      return res.status(400).json({ message: "Warden registration requires an assigned hostel" })
    }

    if (normalizedRole === "security" && (!normalizedGuardId || !normalizedSecurityPost)) {
      return res.status(400).json({ message: "Security registration requires guard ID and security post" })
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          normalizedStudentId ? { studentId: normalizedStudentId } : null,
          normalizedGuardId ? { guardId: normalizedGuardId } : null,
          normalizedStudentId ? { studentProfile: { is: { studentId: normalizedStudentId } } } : null,
          normalizedGuardId ? { securityProfile: { is: { guardId: normalizedGuardId } } } : null,
          normalizedRole === "warden" && normalizedHostel ? { wardenProfile: { is: { hostel: normalizedHostel } } } : null,
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
        studentId: normalizedStudentId,
        guardId: normalizedGuardId,
        hostel: normalizedRole === "security" ? normalizedSecurityPost : normalizedHostel,
        roomNumber: normalizedRoomNumber,
        phoneNumber: normalizedPhoneNumber,
        emergencyContact: normalizedEmergencyContact,
        gender: normalizedGender,
        year: normalizedYear,
        department: normalizedDepartment,
        role: normalizedRole,
        ...buildRoleProfileCreateData({
          role: normalizedRole,
          studentId: normalizedStudentId,
          guardId: normalizedGuardId,
          hostel: normalizedHostel,
          roomNumber: normalizedRoomNumber,
          year: normalizedYear,
          department: normalizedDepartment,
          securityPost: normalizedSecurityPost,
        }),
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
      select: userSelectWithPassword,
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
      securityPost,
      roomNumber,
      year,
      department,
      gender,
    } = req.body
    const normalizedName = normalizeText(name)
    const normalizedPhoneNumber = normalizeText(phoneNumber)
    const normalizedEmail = normalizeText(email)
    const normalizedStudentId = normalizeText(studentId)
    const normalizedGuardId = normalizeText(guardId)
    const normalizedEmergencyContact = normalizeText(emergencyContact)
    const normalizedHostel = normalizeText(hostel)
    const normalizedSecurityPost = normalizeText(securityPost || hostel)
    const normalizedRoomNumber = normalizeText(roomNumber)
    const normalizedYear = normalizeYear(year)
    const normalizedDepartment = normalizeDepartment(department)
    const normalizedGender = normalizeGender(gender)
    const currentRole = req.user.role

    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userSelect,
    })

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" })
    }

    const currentWardenHostel = existingUser.wardenProfile?.hostel || existingUser.hostel
    const hasRequestedWardenHostelChange =
      currentRole === "warden" && normalizedHostel && normalizedHostel !== currentWardenHostel

    if (hasRequestedWardenHostelChange) {
      const conflictingWarden = await prisma.wardenProfile.findUnique({
        where: { hostel: normalizedHostel },
        select: { userId: true },
      })

      if (conflictingWarden && conflictingWarden.userId !== req.user.userId) {
        return res.status(400).json({ message: "This hostel is already assigned to another warden" })
      }
    }

    const updateData = {
      name: normalizedName,
      phoneNumber: normalizedPhoneNumber,
      email: normalizedEmail,
      studentId: normalizedStudentId,
      guardId: normalizedGuardId,
      emergencyContact: normalizedEmergencyContact,
      roomNumber: normalizedRoomNumber,
      year: normalizedYear,
      department: normalizedDepartment,
      gender: normalizedGender,
      ...(currentRole === "student" || currentRole === "security"
        ? {
            hostel: currentRole === "security" ? normalizedSecurityPost : normalizedHostel,
          }
        : {}),
      ...(currentRole === "student" &&
      (normalizedStudentId || normalizedDepartment || normalizedYear || normalizedHostel || normalizedRoomNumber)
        ? {
            studentProfile: {
              upsert: {
                create: {
                  studentId: normalizedStudentId,
                  department: normalizedDepartment,
                  year: normalizedYear,
                  hostel: normalizedHostel,
                  roomNumber: normalizedRoomNumber || null,
                },
                update: {
                  studentId: normalizedStudentId,
                  department: normalizedDepartment,
                  year: normalizedYear,
                  hostel: normalizedHostel,
                  roomNumber: normalizedRoomNumber || null,
                },
              },
            },
          }
        : {}),
      ...(currentRole === "warden" && hasRequestedWardenHostelChange
        ? {
            hostel: normalizedHostel,
            wardenProfile: {
              upsert: {
                create: {
                  hostel: normalizedHostel,
                },
                update: {
                  hostel: normalizedHostel,
                },
              },
            },
          }
        : {}),
      ...(currentRole === "security" && (normalizedGuardId || normalizedSecurityPost)
        ? {
            securityProfile: {
              upsert: {
                create: {
                  guardId: normalizedGuardId,
                  securityPost: normalizedSecurityPost,
                },
                update: {
                  guardId: normalizedGuardId,
                  securityPost: normalizedSecurityPost,
                },
              },
            },
          }
        : {}),
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: userSelect,
    })

    res.json({ message: "Profile updated successfully", user: serializeUser(user) })
  } catch (error) {
    console.error("Profile update error:", error)

    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : String(error.meta?.target || "")

      if (target.includes("hostel")) {
        return res.status(400).json({ message: "This hostel is already assigned to another warden" })
      }

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
