import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const SLOT_DURATION = 15 * 60;

function nextAlignedTimestamp(timestamp, offsetSeconds = 3600) {
  const target = timestamp + offsetSeconds;

  return Math.ceil(target / SLOT_DURATION) * SLOT_DURATION;
}

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
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 2);

    expect(await nft.ownerOf(1)).to.equal(spotOwner.address);

    const spot = await registry.getParkingSpot(1);
    expect(spot.vehicleSize).to.equal(2n);
  });

  it("rejects invalid vehicle sizes", async function () {
    const { registry, spotOwner } = await deployFixture();

    await expect(
      registry
        .connect(spotOwner)
        .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 0)
    ).to.be.revertedWith("Invalid vehicle size");

    await expect(
      registry
        .connect(spotOwner)
        .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 6)
    ).to.be.revertedWith("Invalid vehicle size");
  });

  it("stores future bookings and activates ERC-4907 usage at start time", async function () {
    const { bookingManager, nft, registry, renter, spotOwner } =
      await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 1);

    const latestBlock = await ethers.provider.getBlock("latest");
    const startTime = BigInt(nextAlignedTimestamp(latestBlock.timestamp));
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

  it("allows payment release after start while blocking overlaps until end", async function () {
    const { bookingManager, registry, renter, spotOwner } = await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 1000, 1);

    const latestBlock = await ethers.provider.getBlock("latest");
    const startTime = BigInt(nextAlignedTimestamp(latestBlock.timestamp));
    const endTime = startTime + 7200n;

    await bookingManager
      .connect(renter)
      .bookSpot(1, startTime, endTime, { value: 2000n });

    await expect(bookingManager.releasePayment(1)).to.be.revertedWith(
      "Booking not started"
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(startTime)]);
    await ethers.provider.send("evm_mine");

    await bookingManager.releasePayment(1);

    const paidBooking = await bookingManager.bookings(1);
    expect(paidBooking.status).to.equal(2n);

    await expect(
      bookingManager
        .connect(renter)
        .bookSpot(1, startTime + 900n, startTime + 3600n, { value: 750n })
    ).to.be.revertedWith("Time slot unavailable");
  });

  it("supports 15-minute prorated bookings", async function () {
    const { bookingManager, registry, renter, spotOwner } = await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 4000, 1);

    const latestBlock = await ethers.provider.getBlock("latest");
    const startTime = BigInt(nextAlignedTimestamp(latestBlock.timestamp));
    const endTime = startTime + 900n;

    await bookingManager
      .connect(renter)
      .bookSpot(1, startTime, endTime, { value: 1000n });

    const booking = await bookingManager.bookings(1);
    expect(booking.totalPrice).to.equal(1000n);
  });

  it("rejects unaligned 15-minute bookings", async function () {
    const { bookingManager, registry, renter, spotOwner } = await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 4000, 1);

    const latestBlock = await ethers.provider.getBlock("latest");
    const startTime = BigInt(nextAlignedTimestamp(latestBlock.timestamp)) + 60n;
    const endTime = startTime + 900n;

    await expect(
      bookingManager
        .connect(renter)
        .bookSpot(1, startTime, endTime, { value: 1000n })
    ).to.be.revertedWith("Start not aligned");
  });

  it("rejects incorrect prorated payment", async function () {
    const { bookingManager, registry, renter, spotOwner } = await deployFixture();

    await registry
      .connect(spotOwner)
      .createParkingSpot("Lot A", "Covered", 48500000, 17100000, 4000, 1);

    const latestBlock = await ethers.provider.getBlock("latest");
    const startTime = BigInt(nextAlignedTimestamp(latestBlock.timestamp));
    const endTime = startTime + 1800n;

    await expect(
      bookingManager
        .connect(renter)
        .bookSpot(1, startTime, endTime, { value: 1000n })
    ).to.be.revertedWith("Incorrect payment");
  });
});
