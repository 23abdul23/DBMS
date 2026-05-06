import path from "path"
import { execFileSync } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, "..")

const parseCliArgs = (argv) => ({
  skipBackfill: argv.includes("--skip-backfill"),
})

const runCommand = (command, args) => {
  console.log(`\n> ${command} ${args.join(" ")}`)
  execFileSync(command, args, {
    cwd: backendRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
}

const run = () => {
  const options = parseCliArgs(process.argv.slice(2))

  runCommand("npm", ["run", "prisma:generate"])
  runCommand("npm", ["run", "prisma:push"])

  if (!options.skipBackfill) {
    runCommand("node", ["scripts/backfill_user_profiles.js"])
  }

  console.log("\nProfile schema sync complete")
}

try {
  run()
} catch (error) {
  console.error("\nProfile schema sync failed")
  console.error(error.message || error)
  process.exitCode = 1
}
