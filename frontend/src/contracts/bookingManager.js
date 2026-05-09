import { Contract, isAddress } from "ethers";
import bookingManagerArtifact from "./artifacts/BookingManager.json";
import { BOOKING_MANAGER_ADDRESS, validateBookingManagerConfig } from "../config/contracts";

export function getBookingManagerAbi() {
  return bookingManagerArtifact.abi;
}

export function createBookingManagerContract(runner) {
  validateBookingManagerConfig();

  if (!isAddress(BOOKING_MANAGER_ADDRESS)) {
    throw new Error(`Invalid BookingManager address: ${BOOKING_MANAGER_ADDRESS}`);
  }

  return new Contract(BOOKING_MANAGER_ADDRESS, getBookingManagerAbi(), runner);
}
