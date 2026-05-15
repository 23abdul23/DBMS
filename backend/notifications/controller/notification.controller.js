import { savePushToken } from "../services/token.service.js"

async function savePushTokenController(req, res) {
  try {
    const { token, platform, deviceName } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Push token is required",
      })
    }

    await savePushToken({
      userId: req.user.userId,
      token,
      platform,
      deviceName,
    })

    res.json({
      success: true,
      message: "Push token saved successfully",
    })
  } catch (error) {
    console.error("Error saving push token:", error)
    res.status(500).json({
      success: false,
      message: "Error saving push token",
    })
  }
}

export { savePushTokenController }
