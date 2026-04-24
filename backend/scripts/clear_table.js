const path = require("path");
const { createRequire } = require("module");

const backendRoot = path.resolve(__dirname, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));

backendRequire("dotenv").config({ path: path.join(backendRoot, ".env") });

const { getPrismaClient, disconnectSQL } = require(path.join(backendRoot, "config", "prisma"));

const prisma = getPrismaClient();

const TABLE_MAP = {
  users: "users",
  user: "users",
  emergencies: "emergencies",
  emergency: "emergencies",
  emergency_media: "emergency_media",
  emergencymedia: "emergency_media",
  emergency_contact_calls: "emergency_contact_calls",
  emergencycontactcalls: "emergency_contact_calls",
  student_profiles: "student_profiles",
  studentprofile: "student_profiles",
  warden_profiles: "warden_profiles",
  wardenprofile: "warden_profiles",
  security_profiles: "security_profiles",
  securityprofile: "security_profiles",
  outpasses: "outpasses",
  outpass: "outpasses",
  outpass_audit_trail: "outpass_audit_trail",
  outpassaudittrail: "outpass_audit_trail",
  passkeys: "passkeys",
  passkey: "passkeys",
  locations: "locations",
  location: "locations",
  logs: "logs",
  log: "logs",
};

const VALID_TABLES = [...new Set(Object.values(TABLE_MAP))].sort();

const parseCliArgs = (argv) => {
  const options = {
    table: null,
    force: false,
  };

  for (const arg of argv) {
    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (!options.table && !arg.startsWith("--")) {
      options.table = arg;
    }
  }

  return options;
};

const normalizeTableName = (input) => {
  if (!input) {
    return null;
  }

  return TABLE_MAP[String(input).trim().toLowerCase()] || null;
};

const printUsage = () => {
  console.log("Usage:");
  console.log("  node backend/scripts/clear_table.js <table_name> --force");
  console.log("");
  console.log("Allowed tables:");
  for (const tableName of VALID_TABLES) {
    console.log(`- ${tableName}`);
  }
};

const clearTable = async (tableName) => {
  const quotedTableName = `"public"."${tableName}"`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTableName} RESTART IDENTITY CASCADE`);
};

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2));
  const tableName = normalizeTableName(options.table);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. The script expects backend/.env to define it.");
  }

  if (!tableName) {
    console.error("A valid table name is required.\n");
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!options.force) {
    console.error("Refusing to clear data without --force.\n");
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`Clearing table: ${tableName}`);
  await clearTable(tableName);
  console.log(`Table cleared successfully: ${tableName}`);
};

run()
  .catch((error) => {
    console.error("\nTable clear failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null);
  });
