// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IParkingRegistry.sol";
import "./ParkingPermitNFT.sol";
import "./SharedTypes.sol";

contract BookingManager is Ownable, ReentrancyGuard, Pausable {
    IParkingRegistry public immutable registry;
    ParkingPermitNFT public immutable permitNFT;

    uint256 private _nextBookingId = 1;

    uint256 public platformFeeBps = 500;
    uint256 public accumulatedFees;

    mapping(uint256 => SharedTypes.Booking) public bookings;
    mapping(uint256 => uint256[]) private _spotBookings;

    event SpotBooked(
        uint256 indexed bookingId,
        uint256 indexed spotId,
        address indexed renter
    );

    event BookingActivated(
        uint256 indexed bookingId,
        uint256 indexed spotId
    );

    event BookingCancelled(uint256 indexed bookingId);
    event PaymentReleased(uint256 indexed bookingId);

    constructor(
        address registryAddress,
        address nftAddress,
        address initialOwner
    ) Ownable(initialOwner) {
        require(registryAddress != address(0), "Invalid registry address");
        require(nftAddress != address(0), "Invalid NFT address");

        registry = IParkingRegistry(registryAddress);
        permitNFT = ParkingPermitNFT(nftAddress);
    }

    function bookSpot(
        uint256 spotId,
        uint256 startTime,
        uint256 endTime
    ) external payable nonReentrant whenNotPaused {
        require(startTime >= block.timestamp, "Start must be present or future");
        require(endTime > startTime, "Invalid time range");

        SharedTypes.ParkingSpot memory spot = registry.getParkingSpot(spotId);

        require(spot.isActive, "Spot inactive");
        require(spot.isAvailable, "Spot unavailable");
        require(!_hasOverlap(spotId, startTime, endTime), "Time slot unavailable");

        uint256 durationHours = (endTime - startTime) / 1 hours;
        require(durationHours > 0, "Minimum 1 hour");

        uint256 totalPrice = durationHours * spot.pricePerHour;
        require(msg.value == totalPrice, "Incorrect payment");

        uint256 fee = (totalPrice * platformFeeBps) / 10000;
        uint256 bookingId = _nextBookingId++;

        bookings[bookingId] = SharedTypes.Booking({
            id: bookingId,
            spotId: spotId,
            renter: msg.sender,
            spotOwner: spot.owner,
            startTime: startTime,
            endTime: endTime,
            totalPrice: totalPrice,
            platformFee: fee,
            status: SharedTypes.BookingStatus.Reserved
        });

        _spotBookings[spotId].push(bookingId);

        if (startTime == block.timestamp) {
            _activateBooking(bookingId);
        }

        emit SpotBooked(bookingId, spotId, msg.sender);
    }

    function activateBooking(uint256 bookingId) external whenNotPaused {
        _activateBooking(bookingId);
    }

    function cancelBooking(uint256 bookingId) external nonReentrant {
        SharedTypes.Booking storage booking = bookings[bookingId];

        require(
            booking.status == SharedTypes.BookingStatus.Reserved,
            "Booking not cancellable"
        );
        require(msg.sender == booking.renter, "Not renter");
        require(block.timestamp < booking.startTime, "Booking already started");

        booking.status = SharedTypes.BookingStatus.Cancelled;

        uint256 refund;
        uint256 timeUntilStart = booking.startTime - block.timestamp;

        if (timeUntilStart >= 24 hours) {
            refund = booking.totalPrice;
        } else if (timeUntilStart >= 1 hours) {
            refund = booking.totalPrice / 2;
        } else {
            refund = 0;
        }

        if (refund > 0) {
            (bool success, ) = payable(booking.renter).call{value: refund}("");
            require(success, "Refund failed");
        }

        emit BookingCancelled(bookingId);
    }

    function releasePayment(uint256 bookingId) external nonReentrant {
        SharedTypes.Booking storage booking = bookings[bookingId];

        require(
            booking.status == SharedTypes.BookingStatus.Reserved ||
                booking.status == SharedTypes.BookingStatus.Active,
            "Booking inactive"
        );
        require(block.timestamp >= booking.endTime, "Booking not finished");

        booking.status = SharedTypes.BookingStatus.Completed;

        if (permitNFT.userOf(booking.spotId) != address(0)) {
            permitNFT.setUser(booking.spotId, address(0), 0);
        }

        accumulatedFees += booking.platformFee;

        uint256 ownerAmount = booking.totalPrice - booking.platformFee;

        (bool success, ) = payable(booking.spotOwner).call{value: ownerAmount}("");
        require(success, "Payout failed");

        emit PaymentReleased(bookingId);
    }

    function withdrawFees(address payable to) external onlyOwner {
        uint256 amount = accumulatedFees;

        accumulatedFees = 0;

        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdraw failed");
    }

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");

        platformFeeBps = newFeeBps;
    }

    function getSpotBookings(
        uint256 spotId
    ) external view returns (uint256[] memory) {
        return _spotBookings[spotId];
    }

    function _hasOverlap(
        uint256 spotId,
        uint256 startTime,
        uint256 endTime
    ) internal view returns (bool) {
        uint256[] memory ids = _spotBookings[spotId];

        for (uint256 i = 0; i < ids.length; i++) {
            SharedTypes.Booking memory existing = bookings[ids[i]];

            if (
                existing.status == SharedTypes.BookingStatus.Cancelled ||
                existing.status == SharedTypes.BookingStatus.Completed
            ) {
                continue;
            }

            bool overlaps = startTime < existing.endTime &&
                endTime > existing.startTime;

            if (overlaps) {
                return true;
            }
        }

        return false;
    }

    function _activateBooking(uint256 bookingId) internal {
        SharedTypes.Booking storage booking = bookings[bookingId];

        require(
            booking.status == SharedTypes.BookingStatus.Reserved,
            "Booking not reservable"
        );
        require(block.timestamp >= booking.startTime, "Booking not started");
        require(block.timestamp < booking.endTime, "Booking expired");

        booking.status = SharedTypes.BookingStatus.Active;
        permitNFT.setUser(booking.spotId, booking.renter, uint64(booking.endTime));

        emit BookingActivated(bookingId, booking.spotId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
