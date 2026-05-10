import { formatEther } from "ethers";

export function shortenAddress(address) {
  if (!address) {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenHash(hash) {
  if (!hash) {
    return "-";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function formatSpotStatus(status) {
  if (status === "available") {
    return "Available";
  }

  if (status === "reserved") {
    return "In use now";
  }

  return "Unavailable";
}

export function formatEthValue(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  try {
    return formatEther(value);
  } catch (error) {
    console.warn("Unable to format ETH value", { error, value });
    return fallback;
  }
}

export function formatEthAmount(value, fallback = "-") {
  const formattedValue = formatEthValue(value, fallback);

  if (formattedValue === fallback) {
    return fallback;
  }

  return `${formattedValue} ETH`;
}

export function formatPricePerHour(value, fallback = "-") {
  const formattedValue = formatEthValue(value, fallback);

  if (formattedValue === fallback) {
    return fallback;
  }

  return `${formattedValue} ETH / h`;
}
