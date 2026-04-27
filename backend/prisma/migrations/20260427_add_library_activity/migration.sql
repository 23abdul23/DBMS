CREATE TYPE "LogAction_new" AS ENUM (
  'entry',
  'exit',
  'scan_attempt',
  'without_outpass',
  'outpass_request',
  'outpass_generated',
  'outpass_used',
  'outpass_long_visit',
  'outpass_status_changed',
  'passkey_validated',
  'emergency_status_updated',
  'user_status_updated',
  'emergency_alert',
  'sac_room_opened',
  'sac_room_joined',
  'sac_room_left',
  'sac_equipment_taken',
  'sac_equipment_returned',
  'library_seat_taken',
  'library_seat_released'
);

ALTER TABLE "logs"
  ALTER COLUMN "action" TYPE "LogAction_new"
  USING ("action"::text::"LogAction_new");

ALTER TYPE "LogAction" RENAME TO "LogAction_old";
ALTER TYPE "LogAction_new" RENAME TO "LogAction";
DROP TYPE "LogAction_old";

CREATE TABLE "library_seat_sessions" (
  "id" VARCHAR(24) NOT NULL,
  "user_id" VARCHAR(24) NOT NULL,
  "seat_number" INTEGER NOT NULL,
  "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),
  "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_seat_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_seat_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "library_seat_sessions_user_id_left_at_idx"
  ON "library_seat_sessions"("user_id", "left_at");

CREATE INDEX "library_seat_sessions_seat_number_left_at_idx"
  ON "library_seat_sessions"("seat_number", "left_at");

CREATE INDEX "library_seat_sessions_entered_at_idx"
  ON "library_seat_sessions"("entered_at" DESC);

CREATE INDEX "library_seat_sessions_last_activity_at_idx"
  ON "library_seat_sessions"("last_activity_at" DESC);

CREATE UNIQUE INDEX "library_seat_sessions_active_user_idx"
  ON "library_seat_sessions"("user_id")
  WHERE "left_at" IS NULL;

CREATE UNIQUE INDEX "library_seat_sessions_active_seat_idx"
  ON "library_seat_sessions"("seat_number")
  WHERE "left_at" IS NULL;
