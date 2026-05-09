import { Contract, isAddress } from "ethers";
import parkingRegistryArtifact from "./artifacts/ParkingRegistry.json";

export function getParkingRegistryAbi() {
  return parkingRegistryArtifact.abi;
}

export function createParkingRegistryContract(address, runner) {
  if (!isAddress(address)) {
    throw new Error(`Invalid ParkingRegistry address: ${address}`);
  }

  return new Contract(address, getParkingRegistryAbi(), runner);
}
