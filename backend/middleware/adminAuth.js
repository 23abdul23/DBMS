const adminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" })
    }

    if (req.user.role !== "admin" && req.user.role !== "security") {
      return res.status(403).json({ message: "Admin access required" })
    }

    next()
  } catch (error) {
    console.error("Admin auth error:", error)
    res.status(500).json({ message: "Server error in admin authentication" })
  }
}

module.exports = adminAuth
