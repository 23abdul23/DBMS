# Aegis Notification System — Detailed Scalable Implementation Plan

Based on your current project structure and Prisma schema.

This plan is designed to:

- work with your current route-based backend
- gradually introduce service-controller architecture
- support Expo push notifications now
- support Socket.IO, email, broadcasts later
- scale cleanly for Library, SAC, News, Emergency systems
- avoid large refactors during current development

---

# 1. CURRENT PROJECT STRUCTURE

Your current architecture already provides a strong foundation.

## Frontend

```text
frontend/
├── screens/
├── navigation/
├── context/
├── services/
├── components/
├── utils/
```

## Backend

```text
backend/
├── routes/
├── middleware/
├── utils/
├── prisma/
├── config/
```

---

# 2. FINAL GOAL

Build a centralized platform-wide notification infrastructure.

NOT:

```text
Outpass routes directly send notifications
```

BUT:

```text
Modules emit events
      ↓
Notification system reacts
      ↓
Push / Socket / Email
```

This is the key architectural decision.

---

# 3. NEW BACKEND STRUCTURE

Add ONLY this new module.

```text
backend/
├── notifications/
│
│   ├── controllers/
│   │    └── notification.controller.js
│   │
│   ├── services/
│   │    ├── notification.service.js
│   │    ├── push.service.js
│   │    ├── notificationTemplate.service.js
│   │    └── token.service.js
│   │
│   ├── events/
│   │    └── eventBus.js
│   │
│   ├── constants/
│   │    ├── notificationTypes.js
│   │    └── notificationPriorities.js
│   │
│   ├── templates/
│   │    ├── outpass.template.js
│   │    ├── library.template.js
│   │    └── emergency.template.js
│   │
│   ├── queues/
│   │    └── notification.queue.js
│   │
│   ├── workers/
│   │    └── notification.worker.js
│   │
│   └── routes/
│        └── notification.routes.js
```

---

# 4. PRISMA SCHEMA CHANGES

Add these models to your EXISTING schema.

---

## NotificationType Enum

```prisma
enum NotificationType {
  OUTPASS
  LIBRARY
  SAC
  EMERGENCY
  NEWS
  SYSTEM
}
```

---

## NotificationPriority Enum

```prisma
enum NotificationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

---

## Notification Model

```prisma
model Notification {
  id          String   @id @default(cuid())

  userId      String   @map("user_id") @db.VarChar(24)

  title       String
  message     String

  type        NotificationType
  priority    NotificationPriority @default(NORMAL)

  entityId    String?  @map("entity_id")
  entityType  String?  @map("entity_type")

  isRead      Boolean  @default(false)

  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([createdAt(sort: Desc)])

  @@map("notifications")
}
```

---

## PushToken Model

```prisma
model PushToken {
  id          String   @id @default(cuid())

  userId      String   @map("user_id") @db.VarChar(24)

  token       String   @unique

  platform    String

  deviceName  String?  @map("device_name")

  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])

  @@map("push_tokens")
}
```

---

## NotificationPreference Model

```prisma
model NotificationPreference {
  id                  String @id @default(cuid())

  userId              String @unique @map("user_id") @db.VarChar(24)

  pushEnabled         Boolean @default(true)

  outpassEnabled      Boolean @default(true)
  libraryEnabled      Boolean @default(true)
  emergencyEnabled    Boolean @default(true)
  newsEnabled         Boolean @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preferences")
}
```

---

## Add Relations To Existing User Model

```prisma
notifications             Notification[]
pushTokens                PushToken[]
notificationPreference    NotificationPreference?
```

---

# 5. RUN MIGRATION

```bash
npx prisma migrate dev --name add_notifications
```

---

# 6. INSTALL REQUIRED PACKAGES

## Backend

```bash
npm install expo-server-sdk bullmq ioredis
```

## Frontend

```bash
npx expo install expo-notifications expo-device expo-constants
```

---

# 7. EVENT BUS

## notifications/events/eventBus.js

```js
const EventEmitter = require("events")

class AppEventBus extends EventEmitter {}

const eventBus = new AppEventBus()

module.exports = eventBus
```

---

# 8. NOTIFICATION CONSTANTS

## notificationTypes.js

```js
module.exports = {
  OUTPASS_APPROVED: "OUTPASS_APPROVED",
  OUTPASS_REJECTED: "OUTPASS_REJECTED",
  OUTPASS_CREATED: "OUTPASS_CREATED",

  LIBRARY_REMINDER: "LIBRARY_REMINDER",

  EMERGENCY_ALERT: "EMERGENCY_ALERT",
}
```

---

## notificationPriorities.js

```js
module.exports = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}
```

---

# 9. NOTIFICATION TEMPLATES

## templates/outpass.template.js

```js
function outpassApprovedTemplate(outpass) {
  return {
    title: "Outpass Approved",
    message: `Your outpass to ${outpass.destination} was approved.`,
  }
}

function outpassRejectedTemplate(outpass) {
  return {
    title: "Outpass Rejected",
    message: `Your outpass request was rejected.`,
  }
}

module.exports = {
  outpassApprovedTemplate,
  outpassRejectedTemplate,
}
```

---

# 10. EXPO PUSH SERVICE

## services/push.service.js

```js
const { Expo } = require("expo-server-sdk")

const expo = new Expo()

async function sendPushNotification({ token, title, body, data = {} }) {
  if (!Expo.isExpoPushToken(token)) {
    return
  }

  const messages = [
    {
      to: token,
      sound: "default",
      title,
      body,
      data,
    },
  ]

  await expo.sendPushNotificationsAsync(messages)
}

module.exports = {
  sendPushNotification,
}
```

---

# 11. TOKEN SERVICE

## services/token.service.js

```js
const prisma = require("../../config/prisma")

async function savePushToken({ userId, token, platform, deviceName }) {
  return prisma.pushToken.upsert({
    where: {
      token,
    },
    update: {
      isActive: true,
    },
    create: {
      userId,
      token,
      platform,
      deviceName,
    },
  })
}

module.exports = {
  savePushToken,
}
```

---

# 12. NOTIFICATION SERVICE

## services/notification.service.js

```js
const prisma = require("../../config/prisma")

const { sendPushNotification } = require("./push.service")

async function createNotification({
  userId,
  title,
  message,
  type,
  priority,
  entityId,
  entityType,
}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      priority,
      entityId,
      entityType,
    },
  })

  const tokens = await prisma.pushToken.findMany({
    where: {
      userId,
      isActive: true,
    },
  })

  await Promise.all(
    tokens.map((token) =>
      sendPushNotification({
        token: token.token,
        title,
        body: message,
        data: {
          notificationId: notification.id,
          entityId,
          entityType,
        },
      }),
    ),
  )

  return notification
}

module.exports = {
  createNotification,
}
```

---

# 13. QUEUE LAYER

## queues/notification.queue.js

```js
const { Queue } = require("bullmq")

const notificationQueue = new Queue("notifications", {
  connection: {
    host: "localhost",
    port: 6379,
  },
})

module.exports = notificationQueue
```

---

# 14. WORKER

## workers/notification.worker.js

```js
const { Worker } = require("bullmq")

const { createNotification } = require("../services/notification.service")

const worker = new Worker(
  "notifications",
  async (job) => {
    await createNotification(job.data)
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
    },
  },
)

module.exports = worker
```

---

# 15. CONNECT EVENT BUS TO QUEUE

## server.js

```js
const eventBus = require("./notifications/events/eventBus")

const notificationQueue = require("./notifications/queues/notification.queue")

eventBus.on("OUTPASS_APPROVED", async (payload) => {
  await notificationQueue.add("send-notification", payload)
})
```

---

# 16. CONNECT WITH EXISTING ROUTES

Inside:

```text
routes/outpassRoutes.js
```

After approving outpass:

```js
const eventBus = require("../notifications/events/eventBus")

eventBus.emit("OUTPASS_APPROVED", {
  userId: outpass.userId,

  title: "Outpass Approved",

  message: "Your outpass was approved",

  type: "OUTPASS",

  priority: "HIGH",

  entityId: outpass.id,

  entityType: "OUTPASS",
})
```

---

# 17. FRONTEND STRUCTURE

Add:

```text
frontend/
├── notifications/
│   ├── notificationService.js
│   ├── NotificationProvider.js
│   ├── notificationNavigation.js
│   └── useNotifications.js
```

---

# 18. EXPO NOTIFICATION REGISTRATION

## frontend/notifications/notificationService.js

```js
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"

export async function registerForPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()

  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()

    finalStatus = status
  }

  if (finalStatus !== "granted") {
    return
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId,
    })
  ).data

  return token
}
```

---

# 19. NOTIFICATION PROVIDER

## NotificationProvider.js

```js
import { createContext, useEffect } from "react"

import * as Notifications from "expo-notifications"

export const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data

        console.log(data)
      },
    )

    return () => subscription.remove()
  }, [])

  return children
}
```

---

# 20. SAVE PUSH TOKEN AFTER LOGIN

Inside:

```text
context/AuthContext.js
```

Add:

```js
const token = await registerForPushNotifications()

await api.post("/notifications/token", {
  token,
  platform: Platform.OS,
})
```

---

# 21. NOTIFICATION ROUTES

## routes/notification.routes.js

```js
const router = require("express").Router()

const auth = require("../../middleware/auth")

const {
  savePushTokenController,
} = require("../controllers/notification.controller")

router.post("/token", auth, savePushTokenController)

module.exports = router
```

---

# 22. NOTIFICATION CONTROLLER

## controllers/notification.controller.js

```js
const { savePushToken } = require("../services/token.service")

async function savePushTokenController(req, res) {
  const { token, platform, deviceName } = req.body

  await savePushToken({
    userId: req.user.id,
    token,
    platform,
    deviceName,
  })

  res.json({
    success: true,
  })
}

module.exports = {
  savePushTokenController,
}
```

---

# 23. ADD NOTIFICATION SCREEN

Add:

```text
screens/NotificationsScreen.js
components/NotificationCard.js
```

---

# 24. RECOMMENDED NOTIFICATION API ROUTES

## Save Token

```text
POST /notifications/token
```

---

## Get Notifications

```text
GET /notifications
```

---

## Mark Read

```text
PATCH /notifications/:id/read
```

---

## Unread Count

```text
GET /notifications/unread-count
```

---

# 25. FUTURE SCALABILITY

This architecture already supports:

| Future Feature          | Supported |
| ----------------------- | --------- |
| Library reminders       | YES       |
| SAC event notifications | YES       |
| News alerts             | YES       |
| Emergency broadcasts    | YES       |
| Email notifications     | YES       |
| SMS notifications       | YES       |
| Topic subscriptions     | YES       |
| Socket.IO realtime      | YES       |
| Admin broadcasts        | YES       |

---

# 26. RECOMMENDED IMPLEMENTATION ORDER

## TODAY

Implement:

1. Prisma models
2. Expo registration
3. Push token saving
4. Notification service
5. EventBus
6. Outpass event emit

---

## NEXT

Add:

- BullMQ
- Redis
- workers

---

## LATER

Add:

- Socket.IO
- notification center
- broadcasts
- topic subscriptions

---

# 27. MOST IMPORTANT ARCHITECTURAL DECISION

GOOD:

```text
Routes emit events
```

BAD:

```text
Routes directly send notifications
```

That single design decision determines whether your system scales cleanly later.

---

# 28. FINAL ARCHITECTURE

```text
Modules
   ↓
Event Bus
   ↓
Notification Queue
   ↓
Workers
   ↓
Push / Socket / Email
   ↓
Frontend Notification Center
```

This architecture can scale from:

- 100 students
- to entire university ERP systems
