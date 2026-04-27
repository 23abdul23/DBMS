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
  USING (
    CASE
      WHEN "action"::text = 'passkey_validated' THEN 'entry'
      ELSE "action"::text
    END
  )::"LogAction_new";

ALTER TYPE "LogAction" RENAME TO "LogAction_old";
ALTER TYPE "LogAction_new" RENAME TO "LogAction";
DROP TYPE "LogAction_old";

DROP TABLE IF EXISTS "passkeys";
