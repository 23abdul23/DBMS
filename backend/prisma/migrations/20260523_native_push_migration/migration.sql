CREATE TYPE "PushTokenType" AS ENUM ('FCM', 'APNS');
CREATE TYPE "PushPlatform" AS ENUM ('android', 'ios');
CREATE TYPE "PushTokenStatus" AS ENUM ('ACTIVE', 'INVALID', 'LOGGED_OUT', 'STALE');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'QUEUED',
  'SENDING',
  'RETRYING',
  'DELIVERED',
  'FAILED',
  'INVALID_TOKEN',
  'SKIPPED'
);

ALTER TABLE "notifications"
  ADD COLUMN "route_name" TEXT,
  ADD COLUMN "route_params" JSONB,
  ADD COLUMN "badge_count" INTEGER;

ALTER TABLE "push_tokens"
  ADD COLUMN "token_type" "PushTokenType",
  ADD COLUMN "device_id" VARCHAR(128),
  ADD COLUMN "app_version" VARCHAR(50),
  ADD COLUMN "build_number" VARCHAR(50),
  ADD COLUMN "status" "PushTokenStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "invalid_reason" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "last_registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "last_delivered_at" TIMESTAMP(3),
  ADD COLUMN "last_failure_at" TIMESTAMP(3);

UPDATE "push_tokens"
SET
  "token_type" = CASE
    WHEN LOWER(COALESCE("platform", 'android')) = 'ios' THEN 'APNS'::"PushTokenType"
    ELSE 'FCM'::"PushTokenType"
  END,
  "device_id" = CONCAT('legacy-', "id"),
  "status" = 'INVALID'::"PushTokenStatus",
  "is_active" = FALSE,
  "invalid_reason" = 'expo_push_token_deprecated',
  "last_registered_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "last_seen_at" = COALESCE("created_at", CURRENT_TIMESTAMP);

ALTER TABLE "push_tokens"
  ALTER COLUMN "token_type" SET NOT NULL,
  ALTER COLUMN "device_id" SET NOT NULL;

ALTER TABLE "push_tokens"
  ALTER COLUMN "platform" TYPE "PushPlatform"
  USING (
    CASE
      WHEN LOWER(COALESCE("platform", 'android')) = 'ios' THEN 'ios'::"PushPlatform"
      ELSE 'android'::"PushPlatform"
    END
  );

CREATE UNIQUE INDEX "push_tokens_device_id_key" ON "push_tokens"("device_id");
CREATE UNIQUE INDEX "push_tokens_single_active_user_idx"
  ON "push_tokens"("user_id")
  WHERE "is_active" = TRUE AND "status" = 'ACTIVE';
CREATE INDEX "push_tokens_user_id_is_active_status_idx"
  ON "push_tokens"("user_id", "is_active", "status");
CREATE INDEX "push_tokens_last_seen_at_idx"
  ON "push_tokens"("last_seen_at");

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "push_token_id" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "provider_message_id" TEXT,
  "failure_code" TEXT,
  "failure_reason" TEXT,
  "provider_response" JSONB,
  "next_retry_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_deliveries_push_token_id_fkey"
    FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "notification_deliveries_notification_id_status_idx"
  ON "notification_deliveries"("notification_id", "status");
CREATE INDEX "notification_deliveries_push_token_id_status_idx"
  ON "notification_deliveries"("push_token_id", "status");
CREATE INDEX "notification_deliveries_created_at_idx"
  ON "notification_deliveries"("created_at" DESC);
