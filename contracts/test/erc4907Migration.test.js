import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("ERC-4907 migration", function () {
  async function deployFixture() {
    const [owner, spotOwner, renter] = await ethers.getSigners();

    const NFTFactory = await ethers.getContractFactory("ParkingPermitNFT");
    const nft = await NFTFactory.deploy(owner.address, "https://example.com/");
    await nft.waitForDeployment();

    const RegistryFactory = await ethers.getContractFactory("ParkingRegistry");
    const registry = await RegistryFactory.deploy(
      await nft.getAddress(),
      owner.address
    );
    await registry.waitForDeployment();

    const BookingFactory = await ethers.getContractFactory("BookingManager");
    const bookingManager = await BookingFactory.deploy(
      await registry.getAddress(),
      await nft.getAddress(),
      owner.address
    );
    await bookingManager.waitForDeployment();

    await nft.connect(owner).setRegistry(await registry.getAddress());
    await nft.connect(owner).setBookingManager(await bookingManager.getAddress());

    return { bookingManager, nft, registry, renter, spotOwner };
  }

  it("mints a spot NFT when a parking spot is created", async function () {
    const { nft, registry, spotOwner } = await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 1);

    expect(await nft.ownerOf(1)).to.equal(spotOwner.address);
  });

  it("stores future bookings and activates ERC-4907 usage at start time", async function () {
    const { bookingManager, nft, registry, renter, spotOwner } =
      await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 1);

    const latestBlock = await ethers.provider.getBlock("latest");
    const startTime = BigInt(latestBlock.timestamp + 3600);
    const endTime = startTime + 7200n;

    await bookingManager
      .connect(renter)
      .bookSpot(1, startTime, endTime, { value: 2000n });

    const reservedBooking = await bookingManager.bookings(1);
    expect(reservedBooking.status).to.equal(0n);
    expect(await nft.userOf(1)).to.equal(ethers.ZeroAddress);

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(startTime)]);
    await ethers.provider.send("evm_mine");

    await bookingManager.connect(renter).activateBooking(1);

    const activeBooking = await bookingManager.bookings(1);
    expect(activeBooking.status).to.equal(1n);
    expect(await nft.userOf(1)).to.equal(renter.address);
    expect(await nft.userExpires(1)).to.equal(endTime);
  });
});
