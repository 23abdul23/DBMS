import { savePushToken } from "../services/token.service.js"

async function savePushTokenController(req, res) {
  const { token, platform, deviceName } = req.body

  await savePushToken({
    userId: req.user.userId,
    token,
    platform,
    deviceName,
  })

  res.json({
    success: true,
  })
}

export { savePushTokenController }
