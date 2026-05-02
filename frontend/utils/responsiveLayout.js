export const CONTENT_MAX_WIDTH = 1120

export const getThreeColumnCardWidth = (width) => {
  if (width < 480) {
    return "100%"
  }

  if (width < 900) {
    return "48.5%"
  }

  return "31.5%"
}

export const getTwoColumnCardWidth = (width) => {
  if (width < 640) {
    return "100%"
  }

  return "48.5%"
}
