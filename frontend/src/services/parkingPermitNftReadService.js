export async function getParkingPermitNftOwner(contract) {
  return contract.owner();
}

export async function getParkingPermitNftName(contract) {
  return contract.name();
}

export async function getParkingPermitNftSymbol(contract) {
  return contract.symbol();
}

export async function getParkingPermitBookingManager(contract) {
  return contract.bookingManager();
}

export async function getParkingPermitRegistry(contract) {
  return contract.registry();
}

export async function getSpotUser(contract, tokenId) {
  return contract.userOf(tokenId);
}

export async function getSpotUserExpires(contract, tokenId) {
  return contract.userExpires(tokenId);
}

export async function getSpotTokenUri(contract, tokenId) {
  return contract.tokenURI(tokenId);
}

export async function getTokenOwner(contract, tokenId) {
  return contract.ownerOf(tokenId);
}

export async function getTokenBalance(contract, ownerAddress) {
  return contract.balanceOf(ownerAddress);
}

export async function getApprovedAddress(contract, tokenId) {
  return contract.getApproved(tokenId);
}

export async function getOperatorApproval(contract, ownerAddress, operatorAddress) {
  return contract.isApprovedForAll(ownerAddress, operatorAddress);
}

export async function getSupportsInterface(contract, interfaceId) {
  return contract.supportsInterface(interfaceId);
}
