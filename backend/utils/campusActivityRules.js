const CAMPUS_TIMEZONE = "Asia/Kolkata"
const SAC_CLOSE_HOUR = 22
const SAC_CLOSE_MINUTE = 30
const SAC_CLOSE_LABEL = "10:30 PM"

const LIB_CLOSE_HOUR = 23
const LIB_CLOSE_MINUTE = 30
const LIB_CLOSE_LABEL = "11:30 PM"
const DEFAULT_LIBRARY_LIMIT = 60

const getLibraryLimit = () => {
  const parsed = Number.parseInt(process.env.LIBRARY_LIMIT, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIBRARY_LIMIT
}

const getLocalizedTimeParts = (
  value = new Date(),
  timeZone = CAMPUS_TIMEZONE,
) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value)

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value || 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 0),
  }
}

const getLocalizedMinutes = (
  value = new Date(),
  timeZone = CAMPUS_TIMEZONE,
) => {
  const { hour, minute } = getLocalizedTimeParts(value, timeZone)
  return hour * 60 + minute
}

const isSacOpenAt = (value = new Date(), timeZone = CAMPUS_TIMEZONE) =>
  getLocalizedMinutes(value, timeZone) < SAC_CLOSE_HOUR * 60 + SAC_CLOSE_MINUTE

const isLibOpenAt = (value = new Date(), timeZone = CAMPUS_TIMEZONE) =>
  getLocalizedMinutes(value, timeZone) < LIB_CLOSE_HOUR * 60 + LIB_CLOSE_MINUTE

module.exports = {
  CAMPUS_TIMEZONE,
  SAC_CLOSE_HOUR,
  SAC_CLOSE_MINUTE,
  SAC_CLOSE_LABEL,
  LIB_CLOSE_LABEL,
  DEFAULT_LIBRARY_LIMIT,
  getLibraryLimit,
  getLocalizedMinutes,
  isSacOpenAt,
  isLibOpenAt,
}
