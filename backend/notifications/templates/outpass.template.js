function outpassApprovedTemplate(outpass) {
  return {
    title: "Outpass Approved",
    message: `Your outpass to ${outpass.destination} was approved.`,
  }
}

function outpassRejectedTemplate(outpass) {
  return {
    title: "Outpass Rejected",
    message: `Your outpass request was rejected.`,
  }
}

function outpassCancelledTemplate(outpass) {
  return {
    title: "Outpass Cancelled",
    message: `Your outpass was cancelled.`,
  }
}
export { outpassApprovedTemplate, outpassRejectedTemplate }
