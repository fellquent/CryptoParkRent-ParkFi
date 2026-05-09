import { Contract, isAddress } from "ethers";
import parkingPermitNftArtifact from "./artifacts/ParkingPermitNFT.json";

export function getParkingPermitNftAbi() {
  return parkingPermitNftArtifact.abi;
}

export function createParkingPermitNftContract(address, runner) {
  if (!isAddress(address)) {
    throw new Error(`Invalid ParkingPermitNFT address: ${address}`);
  }

  return new Contract(address, getParkingPermitNftAbi(), runner);
}
