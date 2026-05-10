function toBigIntField(value, fieldName) {
  if (value === "") {
    throw new Error(`${fieldName} is required.`);
  }

  try {
    return BigInt(value);
  } catch {
    throw new Error(`${fieldName} must be a whole number.`);
  }
}

async function waitForTransaction(tx, onStatus) {
  onStatus?.({
    hash: tx.hash,
    stage: "submitted"
  });

  const receipt = await tx.wait();

  onStatus?.({
    hash: tx.hash,
    receipt,
    stage: "confirmed"
  });

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}

export async function createParkingSpot(contract, form, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.createParkingSpot(
    form.locationName,
    form.description,
    toBigIntField(form.latitudeE6, "latitudeE6"),
    toBigIntField(form.longitudeE6, "longitudeE6"),
    toBigIntField(form.pricePerHour, "pricePerHour"),
    toBigIntField(form.capacity, "capacity")
  );

  return waitForTransaction(tx, options.onStatus);
}

export async function updateParkingSpot(contract, spotId, form, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.updateParkingSpot(
    toBigIntField(spotId, "spotId"),
    form.locationName,
    form.description,
    toBigIntField(form.pricePerHour, "pricePerHour"),
    toBigIntField(form.capacity, "capacity")
  );

  return waitForTransaction(tx, options.onStatus);
}

export async function setSpotAvailability(contract, spotId, isAvailable, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.setSpotAvailability(
    toBigIntField(spotId, "spotId"),
    isAvailable
  );

  return waitForTransaction(tx, options.onStatus);
}

export async function deactivateParkingSpot(contract, spotId, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.deactivateSpot(toBigIntField(spotId, "spotId"));

  return waitForTransaction(tx, options.onStatus);
}
