Run from the repository root:

`node backend/scripts/ingest_to_db_students.js`

Optional preview without writing:

`node backend/scripts/ingest_to_db_students.js --dry-run`

Ingest wardens:

`node backend/scripts/ingest_to_db_wardens.js`

Optional preview without writing:

`node backend/scripts/ingest_to_db_wardens.js --dry-run`

Ingest guards:

`node backend/scripts/ingest_to_db_guards.js`

Optional preview without writing:

`node backend/scripts/ingest_to_db_guards.js --dry-run`

Backfill profile tables from existing `users` rows:

`node backend/scripts/backfill_user_profiles.js`

Optional preview without writing:

`node backend/scripts/backfill_user_profiles.js --dry-run`

Regenerate Prisma client, push schema, and backfill profiles:

`node backend/scripts/sync_profile_schema.js`

Skip backfill:

`node backend/scripts/sync_profile_schema.js --skip-backfill`

Clear a whole table:

`node backend/scripts/clear_table.js users --force`

Replace `users` with one of:

`users`, `student_profiles`, `warden_profiles`, `security_profiles`, `emergencies`, `emergency_media`, `emergency_contact_calls`, `outpasses`, `outpass_audit_trail`, `locations`, `logs`

Note:

The ingestion scripts now populate the new profile tables as well as the legacy role-specific columns on `users` during the migration period.

Seed complete development dummy data (includes role ingestions + scenario data for outpass, security logs, SAC, and library):

`node backend/scripts/seed_dev_dummy_data.js`

Dry-run preview:

`node backend/scripts/seed_dev_dummy_data.js --dry-run`
