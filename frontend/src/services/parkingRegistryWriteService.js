function toBigIntField(value, fieldName) {
  if (value === "") {
    throw new Error(`${fieldName} is required.`);
  }

  return BigInt(value);
}

export async function createParkingSpot(contract, form) {
  const tx = await contract.createParkingSpot(
    form.locationName,
    form.description,
    toBigIntField(form.latitudeE6, "latitudeE6"),
    toBigIntField(form.longitudeE6, "longitudeE6"),
    toBigIntField(form.pricePerHour, "pricePerHour"),
    toBigIntField(form.capacity, "capacity")
  );

  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}

export async function updateParkingSpot(contract, spotId, form) {
  const tx = await contract.updateParkingSpot(
    toBigIntField(spotId, "spotId"),
    form.locationName,
    form.description,
    toBigIntField(form.pricePerHour, "pricePerHour"),
    toBigIntField(form.capacity, "capacity")
  );

  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}

export async function setSpotAvailability(contract, spotId, isAvailable) {
  const tx = await contract.setSpotAvailability(
    toBigIntField(spotId, "spotId"),
    isAvailable
  );

  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}
