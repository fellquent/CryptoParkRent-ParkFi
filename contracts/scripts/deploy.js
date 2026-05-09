import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();

  const [deployer] = await ethers.getSigners();

  console.log(`Deploying to network: ${network.name}`);
  console.log(`Deploying contracts with account: ${deployer.address}`);

  const nft = await ethers.deployContract("ParkingPermitNFT", [
    deployer.address,
    "https://example.com/"
  ]);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log(`ParkingPermitNFT deployed to: ${nftAddress}`);

  const registry = await ethers.deployContract("ParkingRegistry", [
    nftAddress,
    deployer.address
  ]);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`ParkingRegistry deployed to: ${registryAddress}`);

  const booking = await ethers.deployContract("BookingManager", [
    registryAddress,
    nftAddress,
    deployer.address
  ]);
  await booking.waitForDeployment();
  const bookingAddress = await booking.getAddress();
  console.log(`BookingManager deployed to: ${bookingAddress}`);

  const registryTx = await nft.setRegistry(registryAddress);
  await registryTx.wait();

  const bookingManagerTx = await nft.setBookingManager(bookingAddress);
  await bookingManagerTx.wait();

  console.log("ParkingPermitNFT connected to registry and BookingManager");
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Registry:", registryAddress);
  console.log("NFT:", nftAddress);
  console.log("Booking:", bookingAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
