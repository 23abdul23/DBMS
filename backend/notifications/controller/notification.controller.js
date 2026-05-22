import {
  deactivatePushToken,
  savePushToken,
} from "../services/token.service.js"

async function savePushTokenController(req, res) {
  try {
    const {
      token,
      tokenType,
      platform,
      deviceId,
      deviceName,
      appVersion,
      buildNumber,
    } = req.body

    const pushToken = await savePushToken({
      userId: req.user.userId,
      token,
      tokenType,
      platform,
      deviceId,
      deviceName,
      appVersion,
      buildNumber,
    })

    console.log(
      `[Notifications] Registered ${pushToken.tokenType} token for user ${req.user.userId} on ${pushToken.platform} device ${pushToken.deviceId}`,
    )

    res.json({
      success: true,
      message: "Native push token saved successfully",
      data: {
        id: pushToken.id,
        platform: pushToken.platform,
        tokenType: pushToken.tokenType,
        deviceId: pushToken.deviceId,
        status: pushToken.status,
      },
    })
  } catch (error) {
    console.error("[Notifications] Error saving native push token:", error)
    res.status(400).json({
      success: false,
      message: error.message || "Error saving native push token",
    })
  }
}

async function deactivatePushTokenController(req, res) {
  try {
    const { deviceId, token, reason } = req.body

    const result = await deactivatePushToken({
      userId: req.user.userId,
      deviceId,
      token,
      reason: reason || "user_logout",
    })

    console.log(
      `[Notifications] Deactivated ${result.count} push token(s) for user ${req.user.userId}`,
    )

    res.json({
      success: true,
      message: "Push token deactivated successfully",
      count: result.count,
    })
  } catch (error) {
    console.error("[Notifications] Error deactivating push token:", error)
    res.status(400).json({
      success: false,
      message: error.message || "Error deactivating push token",
    })
  }
}

export { deactivatePushTokenController, savePushTokenController }
