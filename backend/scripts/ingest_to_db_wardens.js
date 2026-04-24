const crypto = require("crypto");
const path = require("path");
const { createRequire } = require("module");

const backendRoot = path.resolve(__dirname, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));

backendRequire("dotenv").config({ path: path.join(backendRoot, ".env") });

const bcrypt = backendRequire("bcryptjs");
const { getPrismaClient, disconnectSQL } = require(path.join(backendRoot, "config", "prisma"));
const { generateId } = require(path.join(backendRoot, "utils", "hashGenerator"));

const prisma = getPrismaClient();

const DEFAULT_PASSWORD = "123456";

const HOSTEL_WARDENS = [
  { hostel: "BH 1", emailLocalPart: "bh1Warden", gender: "male" },
  { hostel: "BH 2", emailLocalPart: "bh2Warden", gender: "male" },
  { hostel: "BH 3", emailLocalPart: "bh3Warden", gender: "male" },
  { hostel: "BH 4", emailLocalPart: "bh4Warden", gender: "male" },
  { hostel: "BH 5", emailLocalPart: "bh5Warden", gender: "male" },
  { hostel: "GH 1", emailLocalPart: "gh1Warden", gender: "female" },
  { hostel: "GH 2", emailLocalPart: "gh2Warden", gender: "female" },
  { hostel: "GH 3", emailLocalPart: "gh3Warden", gender: "female" },
];

const MALE_FIRST_NAMES = ["Ajay", "Amit", "Anil", "Deepak", "Dinesh", "Mahesh", "Rajesh", "Sanjay", "Suresh", "Vijay"];
const FEMALE_FIRST_NAMES = ["Anita", "Archana", "Kundu", "Meena", "Neelam", "Pooja", "Sarita", "Seema", "Shalini", "Sunita"];
const LAST_NAMES = ["Agarwal", "Das", "Gupta", "Jain", "Mishra", "Pandey", "Rao", "Sharma", "Singh", "Verma"];

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
  const firstName = useMother
    ? pickFromList(seed, "emergency-first-name", FEMALE_FIRST_NAMES)
    : pickFromList(seed, "emergency-first-name", MALE_FIRST_NAMES);
  const lastName = pickFromList(seed, "emergency-last-name", LAST_NAMES);
  const relation = useMother ? "Mother" : "Father";

  return `${firstName} ${lastName} (${relation}) - ${generatePhone(seed, "emergency-phone")}`;
};

const createWardenPayload = ({ hostel, emailLocalPart, gender }) => {
  const seed = `warden:${hostel}`;
  const firstName =
    gender === "female"
      ? pickFromList(seed, "first-name", FEMALE_FIRST_NAMES)
      : pickFromList(seed, "first-name", MALE_FIRST_NAMES);
  const lastName = pickFromList(seed, "last-name", LAST_NAMES);

  return {
    hostel,
    email: `${emailLocalPart}@iiita.ac.in`,
    name: `${firstName} ${lastName}`,
    gender,
    role: "warden",
    phoneNumber: generatePhone(seed, "primary-phone"),
    emergencyContact: generateEmergencyContact(seed),
  };
};

const buildWardens = () => HOSTEL_WARDENS.map(createWardenPayload);

const attachExistingStatus = async (wardens) => {
  const emails = wardens.map((warden) => warden.email);
  const hostels = wardens.map((warden) => warden.hostel);

  const existingWardens = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emails } },
        {
          role: "warden",
          hostel: { in: hostels },
        },
      ],
    },
    select: {
      email: true,
      hostel: true,
      role: true,
    },
  });

  const existingEmails = new Set(existingWardens.map((warden) => warden.email).filter(Boolean));
  const existingHostels = new Set(
    existingWardens.filter((warden) => warden.role === "warden").map((warden) => warden.hostel).filter(Boolean),
  );

  return wardens.map((warden) => ({
    ...warden,
    exists: existingEmails.has(warden.email) || existingHostels.has(warden.hostel),
  }));
};

const hashPassword = async () => bcrypt.hash(DEFAULT_PASSWORD, 10);

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. The script expects backend/.env to define it.");
  }

  const wardens = await attachExistingStatus(buildWardens());
  const wardensToInsert = wardens.filter((warden) => !warden.exists);
  const skippedCount = wardens.length - wardensToInsert.length;

  console.log("Warden ingestion started");
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`);
  console.log(`Wardens generated: ${wardens.length}`);
  console.log(`Wardens pending insert: ${wardensToInsert.length}`);

  for (const warden of wardens) {
    console.log(`- ${warden.hostel} | ${warden.gender} | ${warden.email} | ${warden.exists ? "skip" : "insert"}`);
  }

  if (options.dryRun || wardensToInsert.length === 0) {
    console.log(`\nSummary: inserted=0, skipped=${skippedCount}, total=${wardens.length}`);
    return;
  }

  const rows = await Promise.all(
    wardensToInsert.map(async (warden) => ({
      id: generateId(),
      name: warden.name,
      email: warden.email,
      passwordHash: await hashPassword(),
      role: warden.role,
      gender: warden.gender,
      hostel: warden.hostel,
      phoneNumber: warden.phoneNumber,
      emergencyContact: warden.emergencyContact,
    })),
  );

  const result = await prisma.user.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const insertedWardens = await prisma.user.findMany({
    where: {
      email: {
        in: wardensToInsert.map((warden) => warden.email),
      },
    },
    select: {
      id: true,
      email: true,
    },
  })

  const wardenMap = new Map(wardensToInsert.map((warden) => [warden.email, warden]))
  const wardenProfileRows = insertedWardens
    .map((user) => {
      const warden = wardenMap.get(user.email)
      if (!warden) {
        return null
      }

      return {
        userId: user.id,
        hostel: warden.hostel,
      }
    })
    .filter(Boolean)

  if (wardenProfileRows.length > 0) {
    await prisma.wardenProfile.createMany({
      data: wardenProfileRows,
      skipDuplicates: true,
    })
  }

  const duplicateConflicts = rows.length - result.count;

  console.log(`\nSummary: inserted=${result.count}, skipped=${skippedCount + duplicateConflicts}, total=${wardens.length}`);
};

run()
  .catch((error) => {
    console.error("\nWarden ingestion failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectSQL().catch(() => null);
  });
