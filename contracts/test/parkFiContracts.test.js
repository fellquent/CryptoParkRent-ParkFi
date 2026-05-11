import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const SLOT_DURATION = 15 * 60;

function nextAlignedTimestamp(timestamp, offsetSeconds = 3600) {
  const target = timestamp + offsetSeconds;

  return Math.ceil(target / SLOT_DURATION) * SLOT_DURATION;
}

describe("ParkFi contracts", function () {
  async function deployFixture() {
    const [owner, spotOwner, renter, other] = await ethers.getSigners();

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

    return { bookingManager, nft, other, owner, registry, renter, spotOwner };
  }

  async function createSpot(registry, spotOwner, overrides = {}) {
    const values = {
      description: "Covered",
      latitudeE6: 48500000,
      locationName: "Lot A",
      longitudeE6: 17100000,
      pricePerHour: 1000,
      vehicleSize: 2,
      ...overrides
    };

    await registry
      .connect(spotOwner)
      .createParkingSpot(
        values.locationName,
        values.description,
        values.latitudeE6,
        values.longitudeE6,
        values.pricePerHour,
        values.vehicleSize
      );
  }

  it("mints a spot NFT when a parking spot is created", async function () {
    const { nft, registry, spotOwner } = await deployFixture();

    await createSpot(registry, spotOwner);

    expect(await nft.ownerOf(1)).to.equal(spotOwner.address);
    expect(await nft.balanceOf(spotOwner.address)).to.equal(1n);
    expect(await nft.tokenURI(1)).to.equal("https://example.com/1.json");

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

  it("updates spot details and availability for the spot owner", async function () {
    const { registry, spotOwner } = await deployFixture();

    await createSpot(registry, spotOwner);

    await registry
      .connect(spotOwner)
      .updateParkingSpot(1, "Garage B", "Underground", 2000, 5);

    let spot = await registry.getParkingSpot(1);
    expect(spot.locationName).to.equal("Garage B");
    expect(spot.description).to.equal("Underground");
    expect(spot.pricePerHour).to.equal(2000n);
    expect(spot.vehicleSize).to.equal(5n);

    await registry.connect(spotOwner).setSpotAvailability(1, false);

    spot = await registry.getParkingSpot(1);
    expect(spot.isAvailable).to.equal(false);
  });

  it("rejects unauthorized spot updates and deactivation", async function () {
    const { other, registry, spotOwner } = await deployFixture();

    await createSpot(registry, spotOwner);

    await expect(
      registry
        .connect(other)
        .updateParkingSpot(1, "Hack", "Nope", 2000, 2)
    ).to.be.revertedWith("Not owner");

    await expect(
      registry.connect(other).setSpotAvailability(1, false)
    ).to.be.revertedWith("Not owner");

    await expect(
      registry.connect(other).deactivateSpot(1)
    ).to.be.revertedWith("Unauthorized");
  });

  it("deactivates a spot and hides it from active spot listings", async function () {
    const { registry, spotOwner } = await deployFixture();

    await createSpot(registry, spotOwner);

    expect(await registry.getTotalSpots()).to.equal(1n);
    expect(await registry.getAllActiveSpots()).to.have.lengthOf(1);

    await registry.connect(spotOwner).deactivateSpot(1);

    const spot = await registry.getParkingSpot(1);
    expect(spot.isActive).to.equal(false);
    expect(await registry.getAllActiveSpots()).to.have.lengthOf(0);
  });

  it("keeps spot NFTs non-transferable after minting", async function () {
    const { nft, other, registry, spotOwner } = await deployFixture();

    await createSpot(registry, spotOwner);

    await expect(
      nft.connect(spotOwner).transferFrom(spotOwner.address, other.address, 1)
    ).to.be.revertedWith("Spot transfers disabled");
  });

  it("stores future bookings and activates ERC-4907 usage at start time", async function () {
    const { bookingManager, nft, registry, renter, spotOwner } =
      await deployFixture();

    await createSpot(registry, spotOwner, { vehicleSize: 1 });

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

    await createSpot(registry, spotOwner, { vehicleSize: 1 });

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

    await createSpot(registry, spotOwner, {
      pricePerHour: 4000,
      vehicleSize: 1
    });

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

    await createSpot(registry, spotOwner, {
      pricePerHour: 4000,
      vehicleSize: 1
    });

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

    await createSpot(registry, spotOwner, {
      pricePerHour: 4000,
      vehicleSize: 1
    });

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
