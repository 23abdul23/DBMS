const profileSelect = {
  studentProfile: {
    select: {
      userId: true,
      studentId: true,
      department: true,
      year: true,
      hostel: true,
      roomNumber: true,
    },
  },
  wardenProfile: {
    select: {
      userId: true,
      hostel: true,
    },
  },
  securityProfile: {
    select: {
      userId: true,
      guardId: true,
      securityPost: true,
    },
  },
}

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
  ...profileSelect,
}

const userSelectWithPassword = {
  ...userSelect,
  passwordHash: true,
}

const getStudentProfile = (user) => user?.studentProfile || null
const getWardenProfile = (user) => user?.wardenProfile || null
const getSecurityProfile = (user) => user?.securityProfile || null

const getUserStudentId = (user) => getStudentProfile(user)?.studentId || user?.studentId || null
const getUserGuardId = (user) => getSecurityProfile(user)?.guardId || user?.guardId || null
const getUserDepartment = (user) => getStudentProfile(user)?.department || user?.department || null
const getUserYear = (user) => getStudentProfile(user)?.year || user?.year || null
const getUserRoomNumber = (user) => getStudentProfile(user)?.roomNumber || user?.roomNumber || null

const getUserHostel = (user) => {
  if (!user) {
    return null
  }

  if (user.role === "student") {
    return getStudentProfile(user)?.hostel || user.hostel || null
  }

  if (user.role === "warden") {
    return getWardenProfile(user)?.hostel || user.hostel || null
  }

  if (user.role === "security") {
    return getSecurityProfile(user)?.securityPost || user.hostel || null
  }

  return user.hostel || null
}

const getUserSecurityPost = (user) => {
  if (!user) {
    return null
  }

  return getSecurityProfile(user)?.securityPost || (user.role === "security" ? user.hostel || null : null)
}

const serializeUser = (user) => {
  if (!user) {
    return null
  }

  const hostel = getUserHostel(user)
  const securityPost = getUserSecurityPost(user)

  return {
    id: user.id,
    _id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gender: user.gender,
    department: getUserDepartment(user),
    year: getUserYear(user),
    hostel,
    roomNumber: getUserRoomNumber(user),
    phoneNumber: user.phoneNumber,
    emergencyContact: user.emergencyContact,
    profilePhoto: user.profilePhoto,
    studentId: getUserStudentId(user),
    guardId: getUserGuardId(user),
    securityPost,
    location: securityPost,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

module.exports = {
  profileSelect,
  userSelect,
  userSelectWithPassword,
  serializeUser,
  getUserHostel,
  getUserStudentId,
  getUserGuardId,
  getUserDepartment,
  getUserYear,
  getUserRoomNumber,
  getUserSecurityPost,
}
