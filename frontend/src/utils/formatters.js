export function shortenAddress(address) {
  if (!address) {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatSpotStatus(status) {
  if (status === "available") {
    return "Available";
  }

  if (status === "reserved") {
    return "Currently reserved";
  }

  return "Unavailable";
}
