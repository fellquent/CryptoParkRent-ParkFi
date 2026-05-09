import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();

  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account: ${deployer.address}`
  );

  //
  // 1. Deploy ParkingRegistry
  //
  const registry = await ethers.deployContract(
    "ParkingRegistry",
    [deployer.address]
  );

  await registry.waitForDeployment();

  const registryAddress =
    await registry.getAddress();

  console.log(`ParkingRegistry deployed to: ${registryAddress}`);

  //
  // 2. Deploy ParkingPermitNFT
  //
  const nft = await ethers.deployContract("ParkingPermitNFT", [
    deployer.address,
    "https://example.com/"
  ]);

  await nft.waitForDeployment();

  const nftAddress = await nft.getAddress();

  console.log(`ParkingPermitNFT deployed to: ${nftAddress}`);

  //
  // 3. Deploy BookingManager
  //
  const booking = await ethers.deployContract("BookingManager", [
    registryAddress,
    nftAddress,
    deployer.address
  ]);

  await booking.waitForDeployment();

  const bookingAddress = await booking.getAddress();

  console.log(`BookingManager deployed to: ${bookingAddress}`);

  //
  // 4. Connect NFT to BookingManager
  //
  const tx = await nft.setBookingManager(bookingAddress);

  await tx.wait();

  console.log("BookingManager connected to NFT contract");

  console.log("\\n=== DEPLOYMENT COMPLETE ===");
  console.log("Registry:", registryAddress);
  console.log("NFT:", nftAddress);
  console.log("Booking:", bookingAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
