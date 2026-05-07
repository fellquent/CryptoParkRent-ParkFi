import { network } from "hardhat";
import { expect } from "chai";

describe("ParkFi", function () {
  const INITIAL_FEE = 250n; // 2.5% in basis points
  const ONE_HOUR = 3600;

  let connection;
  let ethers;
  let networkHelpers;
  let PRICE_PER_HOUR;

  before(async function () {
    connection = await network.create();
    ethers = connection.ethers;
    networkHelpers = connection.networkHelpers;
    PRICE_PER_HOUR = ethers.parseEther("0.01");
  });

  async function deployFixture({ ethers: e }) {
    const [owner, addr1, addr2, addr3] = await e.getSigners();
    const ParkFi = await e.getContractFactory("ParkFi");
    const parkfi = await ParkFi.deploy(INITIAL_FEE);
    return { parkfi, owner, addr1, addr2, addr3 };
  }

  async function createSpotFixture(conn) {
    const { parkfi, owner, addr1, addr2, addr3 } =
      await conn.networkHelpers.loadFixture(deployFixture);

    await parkfi.connect(addr1).createSpot(
      "Test Parking",
      "A test parking spot",
      50_000_000,
      30_000_000,
      PRICE_PER_HOUR,
      2
    );
    return { parkfi, owner, addr1, addr2, addr3 };
  }

  // ---------------------------------------------------------------------------
  // Deployment
  // ---------------------------------------------------------------------------

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      const { parkfi, owner } =
        await networkHelpers.loadFixture(deployFixture);
      expect(await parkfi.owner()).to.equal(owner.address);
    });

    it("should set the correct platform fee", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      expect(await parkfi.platformFeePercent()).to.equal(INITIAL_FEE);
    });

    it("should start with zero spots and bookings", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      expect(await parkfi.getTotalSpots()).to.equal(0n);
      expect(await parkfi.getTotalBookings()).to.equal(0n);
    });

    it("should revert if initial fee exceeds MAX_FEE", async function () {
      const ParkFi = await ethers.getContractFactory("ParkFi");
      await expect(ParkFi.deploy(1001)).to.be.revertedWith("Fee too high");
    });
  });

  // ---------------------------------------------------------------------------
  // Spot Management
  // ---------------------------------------------------------------------------

  describe("Spot Management", function () {
    it("should create a spot with correct data", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await parkfi
        .connect(addr1)
        .createSpot("Downtown Lot", "Near mall", 40_000_000, -74_000_000, PRICE_PER_HOUR, 3);

      const spot = await parkfi.getSpot(1);
      expect(spot.id).to.equal(1n);
      expect(spot.owner).to.equal(addr1.address);
      expect(spot.locationName).to.equal("Downtown Lot");
      expect(spot.description).to.equal("Near mall");
      expect(spot.latitudeE6).to.equal(40_000_000n);
      expect(spot.longitudeE6).to.equal(-74_000_000n);
      expect(spot.pricePerHour).to.equal(PRICE_PER_HOUR);
      expect(spot.isAvailable).to.equal(true);
      expect(spot.capacity).to.equal(3n);
      expect(spot.isActive).to.equal(true);
    });

    it("should emit SpotCreated event", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).createSpot("Lot A", "Desc", 10_000_000, 20_000_000, PRICE_PER_HOUR, 1)
      )
        .to.emit(parkfi, "SpotCreated")
        .withArgs(1, addr1.address, "Lot A", PRICE_PER_HOUR, 1);
    });

    it("should revert if pricePerHour is 0", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).createSpot("Lot", "Desc", 0, 0, 0, 1)
      ).to.be.revertedWith("Price must be > 0");
    });

    it("should revert if capacity is 0", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).createSpot("Lot", "Desc", 0, 0, PRICE_PER_HOUR, 0)
      ).to.be.revertedWith("Capacity must be > 0");
    });

    it("should revert if locationName is empty", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).createSpot("", "Desc", 0, 0, PRICE_PER_HOUR, 1)
      ).to.be.revertedWith("Empty location name");
    });

    it("should revert on invalid latitude", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).createSpot("Lot", "Desc", 91_000_000, 0, PRICE_PER_HOUR, 1)
      ).to.be.revertedWith("Invalid latitude");
    });

    it("should revert on invalid longitude", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).createSpot("Lot", "Desc", 0, 181_000_000, PRICE_PER_HOUR, 1)
      ).to.be.revertedWith("Invalid longitude");
    });

    it("should update a spot", async function () {
      const { parkfi, addr1 } = await createSpotFixture(connection);
      await parkfi
        .connect(addr1)
        .updateSpot(1, "Updated Name", "Updated Desc", 45_000_000, 25_000_000, PRICE_PER_HOUR * 2n, 5);

      const spot = await parkfi.getSpot(1);
      expect(spot.locationName).to.equal("Updated Name");
      expect(spot.pricePerHour).to.equal(PRICE_PER_HOUR * 2n);
      expect(spot.capacity).to.equal(5n);
    });

    it("should revert update by non-owner", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      await expect(
        parkfi.connect(addr2).updateSpot(1, "Hack", "Hack", 0, 0, PRICE_PER_HOUR, 1)
      ).to.be.revertedWith("Not spot owner");
    });

    it("should toggle availability", async function () {
      const { parkfi, addr1 } = await createSpotFixture(connection);

      await parkfi.connect(addr1).toggleSpotAvailability(1);
      let spot = await parkfi.getSpot(1);
      expect(spot.isAvailable).to.equal(false);

      await parkfi.connect(addr1).toggleSpotAvailability(1);
      spot = await parkfi.getSpot(1);
      expect(spot.isAvailable).to.equal(true);
    });

    it("should emit SpotAvailabilityToggled", async function () {
      const { parkfi, addr1 } = await createSpotFixture(connection);
      await expect(parkfi.connect(addr1).toggleSpotAvailability(1))
        .to.emit(parkfi, "SpotAvailabilityToggled")
        .withArgs(1, false);
    });

    it("should deactivate a spot", async function () {
      const { parkfi, addr1 } = await createSpotFixture(connection);
      await parkfi.connect(addr1).deactivateSpot(1);
      const spot = await parkfi.getSpot(1);
      expect(spot.isActive).to.equal(false);
      expect(spot.isAvailable).to.equal(false);
    });

    it("should revert deactivation by non-owner", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      await expect(
        parkfi.connect(addr2).deactivateSpot(1)
      ).to.be.revertedWith("Not spot owner");
    });

    it("should revert on non-existent spot", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      await expect(parkfi.getSpot(999)).to.be.revertedWith(
        "Spot does not exist"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Booking
  // ---------------------------------------------------------------------------

  describe("Booking", function () {
    it("should book a spot with correct payment", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + 2 * ONE_HOUR;
      const totalPrice = PRICE_PER_HOUR * 2n;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: totalPrice });

      const booking = await parkfi.getBooking(1);
      expect(booking.renter).to.equal(addr2.address);
      expect(booking.spotOwner).to.equal(addr1.address);
      expect(booking.totalPrice).to.equal(totalPrice);
      expect(booking.status).to.equal(0n); // Active
    });

    it("should emit BookingCreated event", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR })
      )
        .to.emit(parkfi, "BookingCreated")
        .withArgs(1, 1, addr2.address, start, end, PRICE_PER_HOUR);
    });

    it("should revert if payment is incorrect", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR / 2n })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("should revert if spot is not available", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      await parkfi.connect(addr1).toggleSpotAvailability(1);

      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR })
      ).to.be.revertedWith("Spot is not available");
    });

    it("should revert if spot is deactivated", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      await parkfi.connect(addr1).deactivateSpot(1);

      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR })
      ).to.be.revertedWith("Spot is deactivated");
    });

    it("should revert if booking start is in the past", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();

      await expect(
        parkfi.connect(addr2).bookSpot(1, now - ONE_HOUR, now, { value: PRICE_PER_HOUR })
      ).to.be.revertedWith("Start time in the past");
    });

    it("should revert if endTime <= startTime", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, start, { value: 0 })
      ).to.be.revertedWith("End must be after start");
    });

    it("should revert if renter books own spot", async function () {
      const { parkfi, addr1 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await expect(
        parkfi.connect(addr1).bookSpot(1, start, end, { value: PRICE_PER_HOUR })
      ).to.be.revertedWith("Cannot book own spot");
    });

    it("should revert if duration < 1 hour", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + 1800;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR / 2n })
      ).to.be.revertedWith("Minimum 1 hour booking");
    });

    it("should revert if duration is not whole hours", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + 5400;

      await expect(
        parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR })
      ).to.be.revertedWith("Duration must be in whole hours");
    });
  });

  // ---------------------------------------------------------------------------
  // Capacity and Overlap
  // ---------------------------------------------------------------------------

  describe("Capacity and Overlap", function () {
    it("should allow booking up to capacity", async function () {
      const { parkfi, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await parkfi.connect(addr3).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      expect(await parkfi.getTotalBookings()).to.equal(2n);
    });

    it("should revert when capacity is full", async function () {
      const { parkfi, owner, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await parkfi.connect(addr3).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      await expect(
        parkfi.connect(owner).bookSpot(1, start, end, { value: PRICE_PER_HOUR })
      ).to.be.revertedWith("Spot fully booked for this time");
    });

    it("should allow booking after prior booking ends", async function () {
      const { parkfi, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start1 = now + ONE_HOUR;
      const end1 = start1 + ONE_HOUR;
      const start2 = end1;
      const end2 = start2 + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start1, end1, { value: PRICE_PER_HOUR });
      await parkfi.connect(addr3).bookSpot(1, start1, end1, { value: PRICE_PER_HOUR });

      await parkfi.connect(addr2).bookSpot(1, start2, end2, { value: PRICE_PER_HOUR });
      expect(await parkfi.getTotalBookings()).to.equal(3n);
    });

    it("should allow booking after cancelled booking frees slot", async function () {
      const { parkfi, owner, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR * 2;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await parkfi.connect(addr3).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      await parkfi.connect(addr2).cancelBooking(1);

      await parkfi.connect(owner).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      expect(await parkfi.getTotalBookings()).to.equal(3n);
    });
  });

  // ---------------------------------------------------------------------------
  // Escrow and Payment Release
  // ---------------------------------------------------------------------------

  describe("Escrow and Payment Release", function () {
    it("should release payment after endTime", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      const ownerBalBefore = await ethers.provider.getBalance(addr1.address);

      await networkHelpers.time.increaseTo(end + 1);
      await parkfi.releasePayment(1);

      const booking = await parkfi.getBooking(1);
      expect(booking.status).to.equal(1n); // Completed

      const ownerBalAfter = await ethers.provider.getBalance(addr1.address);
      const fee = (PRICE_PER_HOUR * INITIAL_FEE) / 10000n;
      const expectedPayment = PRICE_PER_HOUR - fee;
      expect(ownerBalAfter - ownerBalBefore).to.equal(expectedPayment);
    });

    it("should revert release before endTime", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      await expect(parkfi.releasePayment(1)).to.be.revertedWith(
        "Booking period not ended"
      );
    });

    it("should not allow double release", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await networkHelpers.time.increaseTo(end + 1);

      await parkfi.releasePayment(1);
      await expect(parkfi.releasePayment(1)).to.be.revertedWith(
        "Booking is not active"
      );
    });

    it("should allow anyone to call releasePayment", async function () {
      const { parkfi, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await networkHelpers.time.increaseTo(end + 1);

      await expect(parkfi.connect(addr3).releasePayment(1)).to.not.be.revert(ethers);
    });

    it("should emit PaymentReleased with correct amounts", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await networkHelpers.time.increaseTo(end + 1);

      const fee = (PRICE_PER_HOUR * INITIAL_FEE) / 10000n;
      const ownerAmount = PRICE_PER_HOUR - fee;

      await expect(parkfi.releasePayment(1))
        .to.emit(parkfi, "PaymentReleased")
        .withArgs(1, addr1.address, ownerAmount, fee);
    });

    it("should accumulate platform fees", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await networkHelpers.time.increaseTo(end + 1);
      await parkfi.releasePayment(1);

      const fee = (PRICE_PER_HOUR * INITIAL_FEE) / 10000n;
      expect(await parkfi.accumulatedFees()).to.equal(fee);
    });
  });

  // ---------------------------------------------------------------------------
  // Booking Cancellation
  // ---------------------------------------------------------------------------

  describe("Booking Cancellation", function () {
    it("should refund renter on cancel before startTime", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR * 2;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      const balBefore = await ethers.provider.getBalance(addr2.address);
      const tx = await parkfi.connect(addr2).cancelBooking(1);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(addr2.address);

      expect(balAfter - balBefore + gasCost).to.equal(PRICE_PER_HOUR);

      const booking = await parkfi.getBooking(1);
      expect(booking.status).to.equal(2n); // Cancelled
    });

    it("should revert cancel after startTime", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await networkHelpers.time.increaseTo(start + 1);

      await expect(
        parkfi.connect(addr2).cancelBooking(1)
      ).to.be.revertedWith("Cannot cancel after start");
    });

    it("should revert if non-renter tries to cancel", async function () {
      const { parkfi, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR * 2;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      await expect(
        parkfi.connect(addr3).cancelBooking(1)
      ).to.be.revertedWith("Only renter can cancel");
    });

    it("should not allow cancelling already cancelled booking", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR * 2;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await parkfi.connect(addr2).cancelBooking(1);

      await expect(
        parkfi.connect(addr2).cancelBooking(1)
      ).to.be.revertedWith("Booking is not active");
    });

    it("should emit BookingCancelled", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR * 2;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      await expect(parkfi.connect(addr2).cancelBooking(1))
        .to.emit(parkfi, "BookingCancelled")
        .withArgs(1, addr2.address, PRICE_PER_HOUR);
    });
  });

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  describe("Admin", function () {
    it("should allow owner to set platform fee", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      await parkfi.setPlatformFee(500);
      expect(await parkfi.platformFeePercent()).to.equal(500n);
    });

    it("should emit PlatformFeeUpdated", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      await expect(parkfi.setPlatformFee(500))
        .to.emit(parkfi, "PlatformFeeUpdated")
        .withArgs(INITIAL_FEE, 500);
    });

    it("should revert if non-owner sets fee", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).setPlatformFee(500)
      ).to.be.revertedWithCustomError(parkfi, "OwnableUnauthorizedAccount");
    });

    it("should revert if fee exceeds MAX_FEE", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      await expect(parkfi.setPlatformFee(1001)).to.be.revertedWith(
        "Fee too high"
      );
    });

    it("should allow owner to withdraw accumulated fees", async function () {
      const { parkfi, owner, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await networkHelpers.time.increaseTo(end + 1);
      await parkfi.releasePayment(1);

      const fee = (PRICE_PER_HOUR * INITIAL_FEE) / 10000n;
      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await parkfi.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter - balBefore + gasCost).to.equal(fee);
      expect(await parkfi.accumulatedFees()).to.equal(0n);
    });

    it("should revert withdraw if no fees", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      await expect(parkfi.withdrawFees()).to.be.revertedWith(
        "No fees to withdraw"
      );
    });

    it("should revert if non-owner withdraws", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).withdrawFees()
      ).to.be.revertedWithCustomError(parkfi, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to pause and unpause", async function () {
      const { parkfi, owner, addr1 } =
        await networkHelpers.loadFixture(deployFixture);

      await parkfi.connect(owner).pause();

      await expect(
        parkfi.connect(addr1).createSpot("Lot", "Desc", 0, 0, PRICE_PER_HOUR, 1)
      ).to.be.revertedWithCustomError(parkfi, "EnforcedPause");

      await parkfi.connect(owner).unpause();

      await expect(
        parkfi.connect(addr1).createSpot("Lot", "Desc", 0, 0, PRICE_PER_HOUR, 1)
      ).to.not.be.revert(ethers);
    });

    it("should revert if non-owner pauses", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        parkfi.connect(addr1).pause()
      ).to.be.revertedWithCustomError(parkfi, "OwnableUnauthorizedAccount");
    });
  });

  // ---------------------------------------------------------------------------
  // View Functions
  // ---------------------------------------------------------------------------

  describe("View Functions", function () {
    it("should return all active spots", async function () {
      const { parkfi, addr1, addr2 } =
        await networkHelpers.loadFixture(deployFixture);

      await parkfi.connect(addr1).createSpot("A", "D", 10_000_000, 20_000_000, PRICE_PER_HOUR, 1);
      await parkfi.connect(addr2).createSpot("B", "D", 11_000_000, 21_000_000, PRICE_PER_HOUR, 1);
      await parkfi.connect(addr1).createSpot("C", "D", 12_000_000, 22_000_000, PRICE_PER_HOUR, 1);

      await parkfi.connect(addr1).deactivateSpot(3);

      const spots = await parkfi.getAllActiveSpots();
      expect(spots.length).to.equal(2);
    });

    it("should return spots by owner", async function () {
      const { parkfi, addr1, addr2 } =
        await networkHelpers.loadFixture(deployFixture);

      await parkfi.connect(addr1).createSpot("A", "D", 10_000_000, 20_000_000, PRICE_PER_HOUR, 1);
      await parkfi.connect(addr2).createSpot("B", "D", 11_000_000, 21_000_000, PRICE_PER_HOUR, 1);
      await parkfi.connect(addr1).createSpot("C", "D", 12_000_000, 22_000_000, PRICE_PER_HOUR, 1);

      const addr1Spots = await parkfi.getSpotsByOwner(addr1.address);
      expect(addr1Spots.length).to.equal(2);
    });

    it("should return bookings by renter", async function () {
      const { parkfi, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      const renterBookings = await parkfi.getBookingsByRenter(addr2.address);
      expect(renterBookings.length).to.equal(1);
      expect(renterBookings[0].renter).to.equal(addr2.address);
    });

    it("should return bookings for a spot", async function () {
      const { parkfi, addr2, addr3 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });
      await parkfi.connect(addr3).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      const spotBookings = await parkfi.getBookingsForSpot(1);
      expect(spotBookings.length).to.equal(2);
    });

    it("should return correct totals", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);

      await parkfi.connect(addr1).createSpot("A", "D", 0, 0, PRICE_PER_HOUR, 1);
      await parkfi.connect(addr1).createSpot("B", "D", 0, 0, PRICE_PER_HOUR, 1);

      expect(await parkfi.getTotalSpots()).to.equal(2n);
      expect(await parkfi.getTotalBookings()).to.equal(0n);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe("Edge Cases", function () {
    it("fee change should not affect existing bookings", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      const bookingBefore = await parkfi.getBooking(1);
      const feeBefore = bookingBefore.platformFee;

      await parkfi.setPlatformFee(900);

      await networkHelpers.time.increaseTo(end + 1);

      const balBefore = await ethers.provider.getBalance(addr1.address);
      await parkfi.releasePayment(1);
      const balAfter = await ethers.provider.getBalance(addr1.address);

      const expectedOwnerPayment = PRICE_PER_HOUR - feeBefore;
      expect(balAfter - balBefore).to.equal(expectedOwnerPayment);
    });

    it("deactivated spot bookings can still be released", async function () {
      const { parkfi, addr1, addr2 } = await createSpotFixture(connection);
      const now = await networkHelpers.time.latest();
      const start = now + ONE_HOUR;
      const end = start + ONE_HOUR;

      await parkfi.connect(addr2).bookSpot(1, start, end, { value: PRICE_PER_HOUR });

      await expect(
        parkfi.connect(addr1).deactivateSpot(1)
      ).to.be.revertedWith("Spot has active bookings");

      await networkHelpers.time.increaseTo(end + 1);
      await parkfi.releasePayment(1);

      await parkfi.connect(addr1).deactivateSpot(1);
      const spot = await parkfi.getSpot(1);
      expect(spot.isActive).to.equal(false);
    });

    it("should handle multiple spots by the same owner", async function () {
      const { parkfi, addr1 } =
        await networkHelpers.loadFixture(deployFixture);

      await parkfi.connect(addr1).createSpot("A", "D", 0, 0, PRICE_PER_HOUR, 1);
      await parkfi.connect(addr1).createSpot("B", "D", 1_000_000, 1_000_000, PRICE_PER_HOUR * 2n, 2);
      await parkfi.connect(addr1).createSpot("C", "D", 2_000_000, 2_000_000, PRICE_PER_HOUR * 3n, 3);

      const spots = await parkfi.getSpotsByOwner(addr1.address);
      expect(spots.length).to.equal(3);
      expect(spots[2].pricePerHour).to.equal(PRICE_PER_HOUR * 3n);
    });

    it("should revert on non-existent booking", async function () {
      const { parkfi } = await networkHelpers.loadFixture(deployFixture);
      await expect(parkfi.getBooking(999)).to.be.revertedWith(
        "Booking does not exist"
      );
    });
  });
});
