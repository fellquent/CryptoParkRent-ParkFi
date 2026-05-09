export async function getBookingManagerOwner(contract) {
  return contract.owner();
}

export async function getBookingManagerPaused(contract) {
  return contract.paused();
}

export async function getRegistryAddress(contract) {
  return contract.registry();
}

export async function getPermitNftAddress(contract) {
  return contract.permitNFT();
}

export async function getPlatformFeeBps(contract) {
  return contract.platformFeeBps();
}

export async function getAccumulatedFees(contract) {
  return contract.accumulatedFees();
}

export async function getBooking(contract, bookingId) {
  return contract.bookings(bookingId);
}

export async function getSpotBookings(contract, spotId) {
  return contract.getSpotBookings(spotId);
}
