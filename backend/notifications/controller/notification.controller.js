import { savePushToken } from "../services/token.service.js"

async function savePushTokenController(req, res) {
  try {
    const { token, platform, deviceName } = req.body
    const authenticatedUserId = req.userId || req.user?.userId || req.user?.id

    console.log("[Notifications][token] Incoming save request", {
      authenticatedUserId,
      sessionId: req.sessionId,
      platform,
      deviceName,
      tokenPreview: token ? `${token.slice(0, 24)}...` : null,
    })

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Push token is required",
      })
    }

    if (!authenticatedUserId) {
      console.warn("[Notifications][token] Missing authenticated user id")
      return res.status(401).json({
        success: false,
        message: "Authenticated user is required to save push token",
      })
    }

    await savePushToken({
      userId: authenticatedUserId,
      token,
      platform,
      deviceName,
    })

    console.log("[Notifications][token] Push token saved successfully", {
      userId: authenticatedUserId,
      tokenPreview: `${token.slice(0, 24)}...`,
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
