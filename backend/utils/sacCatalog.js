export const SAC_CLUB_ROOMS = [
  "Virtuosi",
  "Sarasva",
  "GeneticX",
  "Rangtarangni",
  "AMS",
]

export const SAC_EQUIPMENT = [
  "Table Tennis",
  "Tennis",
  "Carrom",
  "Billiards",
  "Cricket",
  "Squash",
  "Basketball",
  "Football",
]

const buildLookup = (items) =>
  new Map(items.map((item) => [String(item).trim().toLowerCase(), item]))

const clubRoomLookup = buildLookup(SAC_CLUB_ROOMS)
const equipmentLookup = buildLookup(SAC_EQUIPMENT)

const resolveCatalogItem = (value, lookup) => {
  if (typeof value !== "string") {
    return null
  }

  return lookup.get(value.trim().toLowerCase()) || null
}

export const resolveClubRoom = (value) =>
  resolveCatalogItem(value, clubRoomLookup)
export const resolveEquipment = (value) =>
  resolveCatalogItem(value, equipmentLookup)
