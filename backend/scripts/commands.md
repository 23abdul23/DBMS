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

Clear a whole table:

`node backend/scripts/clear_table.js users --force`

Replace `users` with one of:

`users`, `emergencies`, `emergency_media`, `emergency_contact_calls`, `outpasses`, `outpass_audit_trail`, `passkeys`, `locations`, `logs`

Note:

`backend/scripts/ingest_to_db_guards.js` stores the assigned guard post in the existing `users.hostel` field because the current Prisma schema does not have a dedicated `securityPost` column.
