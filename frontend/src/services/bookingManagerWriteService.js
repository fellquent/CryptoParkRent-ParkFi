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

export async function bookSpot(contract, booking, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.bookSpot(
    BigInt(booking.spotId),
    BigInt(booking.startTime),
    BigInt(booking.endTime),
    {
      value: BigInt(booking.totalPrice)
    }
  );

  return waitForTransaction(tx, options.onStatus);
}

export async function cancelBooking(contract, bookingId, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.cancelBooking(BigInt(bookingId));

  return waitForTransaction(tx, options.onStatus);
}

export async function activateBooking(contract, bookingId, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.activateBooking(BigInt(bookingId));

  return waitForTransaction(tx, options.onStatus);
}

export async function releasePayment(contract, bookingId, options = {}) {
  options.onStatus?.({ stage: "wallet" });

  const tx = await contract.releasePayment(BigInt(bookingId));

  return waitForTransaction(tx, options.onStatus);
}
