CREATE TABLE "sac_room_sessions" (
  "id" VARCHAR(24) NOT NULL,
  "room_name" VARCHAR(100) NOT NULL,
  "opened_by_user_id" VARCHAR(24) NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sac_room_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sac_room_sessions_opened_by_user_id_fkey"
    FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "sac_room_presences" (
  "id" VARCHAR(24) NOT NULL,
  "session_id" VARCHAR(24) NOT NULL,
  "user_id" VARCHAR(24) NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),

  CONSTRAINT "sac_room_presences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sac_room_presences_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sac_room_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sac_room_presences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "sac_equipment_checkouts" (
  "id" VARCHAR(24) NOT NULL,
  "equipment_name" VARCHAR(100) NOT NULL,
  "user_id" VARCHAR(24) NOT NULL,
  "checked_out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returned_at" TIMESTAMP(3),

  CONSTRAINT "sac_equipment_checkouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sac_equipment_checkouts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sac_room_sessions_room_name_closed_at_idx"
  ON "sac_room_sessions"("room_name", "closed_at");

CREATE INDEX "sac_room_sessions_opened_at_idx"
  ON "sac_room_sessions"("opened_at" DESC);

CREATE INDEX "sac_room_sessions_last_activity_at_idx"
  ON "sac_room_sessions"("last_activity_at" DESC);

CREATE INDEX "sac_room_presences_session_id_left_at_idx"
  ON "sac_room_presences"("session_id", "left_at");

CREATE INDEX "sac_room_presences_user_id_left_at_idx"
  ON "sac_room_presences"("user_id", "left_at");

CREATE INDEX "sac_room_presences_joined_at_idx"
  ON "sac_room_presences"("joined_at" DESC);

CREATE INDEX "sac_equipment_checkouts_equipment_name_returned_at_idx"
  ON "sac_equipment_checkouts"("equipment_name", "returned_at");

CREATE INDEX "sac_equipment_checkouts_user_id_returned_at_idx"
  ON "sac_equipment_checkouts"("user_id", "returned_at");

CREATE INDEX "sac_equipment_checkouts_checked_out_at_idx"
  ON "sac_equipment_checkouts"("checked_out_at" DESC);
