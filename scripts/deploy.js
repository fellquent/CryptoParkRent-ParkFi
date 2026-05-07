import { network } from "hardhat";

async function main() {
  const initialFeePercent = 250; // 2.5%

  const { ethers } = await network.create();

  const parkfi = await ethers.deployContract("ParkFi", [initialFeePercent]);
  await parkfi.waitForDeployment();

  const address = await parkfi.getAddress();
  console.log(`ParkFi deployed to: ${address}`);
  console.log(`Platform fee: ${initialFeePercent / 100}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
