export const BOOKING_MANAGER_ADDRESS =
  import.meta.env.VITE_BOOKING_MANAGER_ADDRESS;

export const EXPECTED_CHAIN_ID =
  import.meta.env.VITE_EXPECTED_CHAIN_ID || "31337";

export const EXPECTED_CHAIN_NAME =
  import.meta.env.VITE_EXPECTED_CHAIN_NAME ||
  (EXPECTED_CHAIN_ID === "31337" ? "Hardhat Local" : `Chain ${EXPECTED_CHAIN_ID}`);

export const EXPECTED_CHAIN_RPC_URL =
  import.meta.env.VITE_EXPECTED_CHAIN_RPC_URL ||
  (EXPECTED_CHAIN_ID === "31337" ? "http://127.0.0.1:8545" : "");

export const EXPECTED_CHAIN_CURRENCY =
  import.meta.env.VITE_EXPECTED_CHAIN_CURRENCY || "ETH";

export function validateBookingManagerConfig() {
  if (!BOOKING_MANAGER_ADDRESS) {
    throw new Error("Missing VITE_BOOKING_MANAGER_ADDRESS configuration.");
  }
}
