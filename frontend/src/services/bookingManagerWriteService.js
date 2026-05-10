export async function bookSpot(contract, booking) {
  const tx = await contract.bookSpot(
    BigInt(booking.spotId),
    BigInt(booking.startTime),
    BigInt(booking.endTime),
    {
      value: BigInt(booking.totalPrice)
    }
  );

  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}

export async function cancelBooking(contract, bookingId) {
  const tx = await contract.cancelBooking(BigInt(bookingId));
  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}

export async function releasePayment(contract, bookingId) {
  const tx = await contract.releasePayment(BigInt(bookingId));
  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    receipt,
    status: receipt.status
  };
}
