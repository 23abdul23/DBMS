const path = require("path");
const { execFileSync } = require("child_process");

const backendRoot = path.resolve(__dirname, "..");

const parseCliArgs = (argv) => ({
  skipBackfill: argv.includes("--skip-backfill"),
});

const runCommand = (command, args) => {
  console.log(`\n> ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: backendRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
};

const run = () => {
  const options = parseCliArgs(process.argv.slice(2));

  runCommand("npm", ["run", "prisma:generate"]);
  runCommand("npm", ["run", "prisma:push"]);

  if (!options.skipBackfill) {
    runCommand("node", ["scripts/backfill_user_profiles.js"]);
  }

  console.log("\nProfile schema sync complete");
};

try {
  run();
} catch (error) {
  console.error("\nProfile schema sync failed");
  console.error(error.message || error);
  process.exitCode = 1;
}
