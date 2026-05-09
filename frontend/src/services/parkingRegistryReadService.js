export async function getParkingRegistryOwner(contract) {
  return contract.owner();
}

export async function getParkingRegistryPaused(contract) {
  return contract.paused();
}

export async function getParkingSpot(contract, spotId) {
  return contract.getParkingSpot(spotId);
}

export async function getOwnerSpots(contract, ownerAddress) {
  return contract.getOwnerSpots(ownerAddress);
}

export async function getAllActiveSpots(contract) {
  return contract.getAllActiveSpots();
}

export async function getTotalSpots(contract) {
  return contract.getTotalSpots();
}
