const crypto = require("crypto");
const path = require("path");
const { createRequire } = require("module");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));

backendRequire("dotenv").config({ path: path.join(backendRoot, ".env") });

const bcrypt = backendRequire("bcryptjs");
const { getPrismaClient, disconnectSQL } = require(path.join(backendRoot, "config", "prisma"));
const { generateId } = require(path.join(backendRoot, "utils", "hashGenerator"));
const allLocations = require("./SecuityLocations.json");

const prisma = getPrismaClient();

const DEFAULT_PASSWORD = "123456";
const STARTING_GUARD_ID = 100;
const FEMALE_LOCATIONS = new Set(["GH 1", "GH 2", "GH 3"]);

const MALE_FIRST_NAMES = ["Aakash", "Aman", "Anil", "Arvind", "Deepak", "Mohan", "Naresh", "Pawan", "Rakesh", "Suresh"];
const FEMALE_FIRST_NAMES = ["Anita", "Kiran", "Meena", "Neetu", "Poonam", "Rekha", "Seema", "Shobha", "Sunita", "Usha"];
const LAST_NAMES = ["Chauhan", "Kumar", "Mishra", "Nayak", "Paswan", "Prasad", "Rathore", "Singh", "Thakur", "Yadav"];

const parseCliArgs = (argv) => ({
  dryRun: argv.includes("--dry-run"),
});

const seededNumber = (seed, label, modulo) => {
  const digest = crypto.createHash("sha256").update(`${seed}:${label}`).digest("hex");
  return Number.parseInt(digest.slice(0, 12), 16) % modulo;
};

const pickFromList = (seed, label, values) => values[seededNumber(seed, label, values.length)];

const generatePhone = (seed, label) => {
  const firstDigit = ["6", "7", "8", "9"][seededNumber(seed, `${label}:lead`, 4)];
  const body = String(seededNumber(seed, `${label}:body`, 1_000_000_000)).padStart(9, "0");
  return `${firstDigit}${body}`;
};

const generateEmergencyContact = (seed) => {
  const useMother = seededNumber(seed, "emergency-relation", 4) === 0;
  const source = useMother ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const relation = useMother ? "Mother" : "Father";

  return `${pickFromList(seed, "emergency-first-name", source)} ${pickFromList(
    seed,
    "emergency-last-name",
    LAST_NAMES,
  )} (${relation}) - ${generatePhone(seed, "emergency-phone")}`;
};

const getActiveLocations = () =>
  (allLocations.Locations || []).filter((location) => location && location !== "--select location--");

const buildGenderPlan = (location, count) => {
  if (FEMALE_LOCATIONS.has(location)) {
    return count === 2 ? ["male", "female"] : ["male", "female", "male"];
  }

  return Array.from({ length: count }, () => "male");
};

const buildGuards = () => {
  const guards = [];
  let nextGuardId = STARTING_GUARD_ID;

  for (const location of getActiveLocations()) {
    const count = 2 + seededNumber(location, "guard-count", 2);
    const genders = buildGenderPlan(location, count);

    genders.forEach((gender, index) => {
      const seed = `guard:${location}:${index}:${nextGuardId}`;
      const firstName =
        gender === "female"
          ? pickFromList(seed, "first-name", FEMALE_FIRST_NAMES)
          : pickFromList(seed, "first-name", MALE_FIRST_NAMES);
      const lastName = pickFromList(seed, "last-name", LAST_NAMES);
      const guardId = String(nextGuardId);

      guards.push({
        location,
        guardId,
        email: `guard${guardId}@iiita.ac.in`,
        name: `${firstName} ${lastName}`,
        gender,
        role: "security",
        phoneNumber: generatePhone(seed, "primary-phone"),
        emergencyContact: generateEmergencyContact(seed),
      });

      nextGuardId += 1;
    });
  }

  return guards;
};

const attachExistingStatus = async (guards) => {
  const emails = guards.map((guard) => guard.email);
  const guardIds = guards.map((guard) => guard.guardId);

  const existingGuards = await prisma.user.findMany({
    where: {
      OR: [{ email: { in: emails } }, { guardId: { in: guardIds } }],
    },
    select: {
      email: true,
      guardId: true,
    },
  });

  const existingEmails = new Set(existingGuards.map((guard) => guard.email).filter(Boolean));
  const existingGuardIds = new Set(existingGuards.map((guard) => guard.guardId).filter(Boolean));

  return guards.map((guard) => ({
    ...guard,
    exists: existingEmails.has(guard.email) || existingGuardIds.has(guard.guardId),
  }));
};

const hashPassword = async () => bcrypt.hash(DEFAULT_PASSWORD, 10);

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. The script expects backend/.env to define it.");
  }

  const guards = await attachExistingStatus(buildGuards());
  const guardsToInsert = guards.filter((guard) => !guard.exists);
  const skippedCount = guards.length - guardsToInsert.length;

  console.log("Guard ingestion started");
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`);
  console.log(`Guards generated: ${guards.length}`);
  console.log(`Guards pending insert: ${guardsToInsert.length}`);

  for (const guard of guards) {
    console.log(`- ${guard.location} | ${guard.guardId} | ${guard.gender} | ${guard.email} | ${guard.exists ? "skip" : "insert"}`);
  }

  if (options.dryRun || guardsToInsert.length === 0) {
    console.log(`\nSummary: inserted=0, skipped=${skippedCount}, total=${guards.length}`);
    return;
  }

  const rows = await Promise.all(
    guardsToInsert.map(async (guard) => ({
      id: generateId(),
      name: guard.name,
      email: guard.email,
      passwordHash: await hashPassword(),
      role: guard.role,
      gender: guard.gender,
      guardId: guard.guardId,
      // The current schema has no dedicated `securityPost` column, so the assigned post is kept in `hostel`.
      hostel: guard.location,
      phoneNumber: guard.phoneNumber,
      emergencyContact: guard.emergencyContact,
    })),
  );

  const result = await prisma.user.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const duplicateConflicts = rows.length - result.count;

  console.log(`\nSummary: inserted=${result.count}, skipped=${skippedCount + duplicateConflicts}, total=${guards.length}`);
};

run()
  .catch((error) => {
    console.error("\nGuard ingestion failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null);
  });
