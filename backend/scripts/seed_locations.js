import { getPrismaClient } from "../config/prisma.js"
import { generateId } from "../utils/hashGenerator.js"

const prisma = getPrismaClient()

/**
 * Seed Campus Locations
 * Populates database with 20 default campus locations across 4 categories:
 * - Exit Gates (4)
 * - Campus Buildings (8)
 * - Hostels (8)
 */

const LOCATIONS = [
  // Exit Gates (4)
  {
    name: "Gate 1",
    type: "EXIT_GATE",
    code: "GATE-1",
    description: "Campus exit gate 1",
    latitude: 28.5353,
    longitude: 77.19,
  },
  {
    name: "Gate 2",
    type: "EXIT_GATE",
    code: "GATE-2",
    description: "Campus exit gate 2",
    latitude: 28.5342,
    longitude: 77.185,
  },
  {
    name: "Gate 3 (Main Gate)",
    type: "EXIT_GATE",
    code: "GATE-3-MAIN",
    description: "Main campus entrance and exit gate",
    latitude: 28.5358,
    longitude: 77.195,
  },
  {
    name: "Gate 4",
    type: "EXIT_GATE",
    code: "GATE-4",
    description: "Campus exit gate 4",
    latitude: 28.537,
    longitude: 77.19,
  },

  // Campus Buildings (8)
  {
    name: "Library",
    type: "CAMPUS_BUILDING",
    code: "LIBRARY",
    description: "Central library and study area",
    latitude: 28.536,
    longitude: 77.191,
  },
  {
    name: "SAC",
    type: "CAMPUS_BUILDING",
    code: "SAC",
    description: "Student Activity Center",
    latitude: 28.5365,
    longitude: 77.1915,
  },
  {
    name: "Auditorium",
    type: "CAMPUS_BUILDING",
    code: "AUDITORIUM",
    description: "Main auditorium and event hall",
    latitude: 28.5355,
    longitude: 77.1935,
  },
  {
    name: "CC1",
    type: "CAMPUS_BUILDING",
    code: "CC1",
    description: "Computer Center 1",
    latitude: 28.5355,
    longitude: 77.1905,
  },
  {
    name: "CC2",
    type: "CAMPUS_BUILDING",
    code: "CC2",
    description: "Computer Center 2",
    latitude: 28.535,
    longitude: 77.1895,
  },
  {
    name: "CC3",
    type: "CAMPUS_BUILDING",
    code: "CC3",
    description: "Computer Center 3",
    latitude: 28.534,
    longitude: 77.192,
  },
  {
    name: "AAA",
    type: "CAMPUS_BUILDING",
    code: "AAA",
    description: "Academic and Administrative Area",
    latitude: 28.5345,
    longitude: 77.1925,
  },
  {
    name: "Lecture Theatre",
    type: "CAMPUS_BUILDING",
    code: "LECTURE-THEATRE",
    description: "Lecture theatre complex",
    latitude: 28.537,
    longitude: 77.193,
  },

  // Hostels (8)
  {
    name: "BH 1",
    type: "HOSTEL",
    code: "BH-1",
    description: "Boys Hostel 1",
    latitude: 28.533,
    longitude: 77.188,
  },
  {
    name: "BH 2",
    type: "HOSTEL",
    code: "BH-2",
    description: "Boys Hostel 2",
    latitude: 28.5325,
    longitude: 77.1875,
  },
  {
    name: "BH 3",
    type: "HOSTEL",
    code: "BH-3",
    description: "Boys Hostel 3",
    latitude: 28.532,
    longitude: 77.187,
  },
  {
    name: "BH 4",
    type: "HOSTEL",
    code: "BH-4",
    description: "Boys Hostel 4",
    latitude: 28.5315,
    longitude: 77.1865,
  },
  {
    name: "BH 5",
    type: "HOSTEL",
    code: "BH-5",
    description: "Boys Hostel 5",
    latitude: 28.531,
    longitude: 77.186,
  },
  {
    name: "GH 1",
    type: "HOSTEL",
    code: "GH-1",
    description: "Girls Hostel 1",
    latitude: 28.5375,
    longitude: 77.188,
  },
  {
    name: "GH 2",
    type: "HOSTEL",
    code: "GH-2",
    description: "Girls Hostel 2",
    latitude: 28.538,
    longitude: 77.1875,
  },
  {
    name: "GH 3",
    type: "HOSTEL",
    code: "GH-3",
    description: "Girls Hostel 3",
    latitude: 28.5385,
    longitude: 77.187,
  },
]

async function seedLocations() {
  try {
    console.log("🌱 Starting location seeding...")

    // Check if locations already exist
    const existingCount = await prisma.location.count()
    if (existingCount > 0) {
      console.log(
        `⚠️  ${existingCount} locations already exist. Skipping seed.`,
      )
      console.log("To reseed, delete existing locations or reset the database.")
      return
    }

    const created = []

    for (const locationData of LOCATIONS) {
      const location = await prisma.location.create({
        data: {
          id: generateId(),
          name: locationData.name,
          type: locationData.type,
          code: locationData.code,
          description: locationData.description,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          hash: Buffer.from(`${locationData.name}${Date.now()}`)
            .toString("hex")
            .slice(0, 64),
          isActive: true,
          qrGenerationCount: 0,
          qrDownloadCount: 0,
        },
      })

      created.push({
        name: location.name,
        type: location.type,
        id: location.id,
      })

      console.log(`✓ Created: ${location.name} (${location.type})`)
    }

    console.log(`\n✅ Successfully seeded ${created.length} locations\n`)
    console.log("Summary:")
    const byType = created.reduce((acc, loc) => {
      acc[loc.type] = (acc[loc.type] || 0) + 1
      return acc
    }, {})

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })
  } catch (error) {
    console.error("❌ Seed error:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed
seedLocations().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
