// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ParkFi is Ownable, ReentrancyGuard, Pausable {
    enum BookingStatus {
        Active,
        Completed,
        Cancelled
    }

    struct ParkingSpot {
        uint256 id;
        address owner;
        string locationName;
        string description;
        int256 latitudeE6;
        int256 longitudeE6;
        uint256 pricePerHour;
        bool isAvailable;
        uint256 capacity;
        bool isActive;
    }

    struct Booking {
        uint256 id;
        uint256 parkingSpotId;
        address renter;
        address spotOwner;
        uint256 startTime;
        uint256 endTime;
        uint256 totalPrice;
        uint256 platformFee;
        BookingStatus status;
    }

    uint256 private _nextSpotId;
    uint256 private _nextBookingId;

    uint256 public platformFeePercent;
    uint256 public constant MAX_FEE = 1000;
    uint256 public accumulatedFees;

    mapping(uint256 => ParkingSpot) public parkingSpots;
    mapping(uint256 => Booking) public bookings;

    mapping(address => uint256[]) private _ownerSpotIds;
    mapping(address => uint256[]) private _renterBookingIds;
    mapping(address => uint256[]) private _ownerBookingIds;
    mapping(uint256 => uint256[]) private _spotBookingIds;

    uint256[] private _allSpotIds;

    event SpotCreated(
        uint256 indexed spotId,
        address indexed owner,
        string locationName,
        uint256 pricePerHour,
        uint256 capacity
    );
    event SpotUpdated(uint256 indexed spotId);
    event SpotAvailabilityToggled(uint256 indexed spotId, bool isAvailable);
    event SpotDeactivated(uint256 indexed spotId);

    event BookingCreated(
        uint256 indexed bookingId,
        uint256 indexed spotId,
        address indexed renter,
        uint256 startTime,
        uint256 endTime,
        uint256 totalPrice
    );
    event PaymentReleased(
        uint256 indexed bookingId,
        address indexed spotOwner,
        uint256 ownerAmount,
        uint256 platformFee
    );
    event BookingCancelled(
        uint256 indexed bookingId,
        address indexed renter,
        uint256 refundAmount
    );

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    modifier onlySpotOwner(uint256 spotId) {
        require(parkingSpots[spotId].owner == msg.sender, "Not spot owner");
        _;
    }

    modifier spotExists(uint256 spotId) {
        require(spotId > 0 && spotId < _nextSpotId, "Spot does not exist");
        _;
    }

    modifier bookingExists(uint256 bookingId) {
        require(
            bookingId > 0 && bookingId < _nextBookingId,
            "Booking does not exist"
        );
        _;
    }

    constructor(uint256 _platformFeePercent) Ownable(msg.sender) {
        require(_platformFeePercent <= MAX_FEE, "Fee too high");
        platformFeePercent = _platformFeePercent;
        _nextSpotId = 1;
        _nextBookingId = 1;
    }

    // -------------------------------------------------------------------------
    // Parking Spot Management
    // -------------------------------------------------------------------------

    function createSpot(
        string calldata locationName,
        string calldata description,
        int256 latitudeE6,
        int256 longitudeE6,
        uint256 pricePerHour,
        uint256 capacity
    ) external whenNotPaused returns (uint256 spotId) {
        require(bytes(locationName).length > 0, "Empty location name");
        require(pricePerHour > 0, "Price must be > 0");
        require(capacity > 0, "Capacity must be > 0");
        require(
            latitudeE6 >= -90_000_000 && latitudeE6 <= 90_000_000,
            "Invalid latitude"
        );
        require(
            longitudeE6 >= -180_000_000 && longitudeE6 <= 180_000_000,
            "Invalid longitude"
        );

        spotId = _nextSpotId++;

        parkingSpots[spotId] = ParkingSpot({
            id: spotId,
            owner: msg.sender,
            locationName: locationName,
            description: description,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            pricePerHour: pricePerHour,
            isAvailable: true,
            capacity: capacity,
            isActive: true
        });

        _ownerSpotIds[msg.sender].push(spotId);
        _allSpotIds.push(spotId);

        emit SpotCreated(
            spotId,
            msg.sender,
            locationName,
            pricePerHour,
            capacity
        );
    }

    function updateSpot(
        uint256 spotId,
        string calldata locationName,
        string calldata description,
        int256 latitudeE6,
        int256 longitudeE6,
        uint256 pricePerHour,
        uint256 capacity
    ) external spotExists(spotId) onlySpotOwner(spotId) whenNotPaused {
        require(parkingSpots[spotId].isActive, "Spot is deactivated");
        require(bytes(locationName).length > 0, "Empty location name");
        require(pricePerHour > 0, "Price must be > 0");
        require(capacity > 0, "Capacity must be > 0");
        require(
            latitudeE6 >= -90_000_000 && latitudeE6 <= 90_000_000,
            "Invalid latitude"
        );
        require(
            longitudeE6 >= -180_000_000 && longitudeE6 <= 180_000_000,
            "Invalid longitude"
        );

        ParkingSpot storage spot = parkingSpots[spotId];
        spot.locationName = locationName;
        spot.description = description;
        spot.latitudeE6 = latitudeE6;
        spot.longitudeE6 = longitudeE6;
        spot.pricePerHour = pricePerHour;
        spot.capacity = capacity;

        emit SpotUpdated(spotId);
    }

    function toggleSpotAvailability(
        uint256 spotId
    ) external spotExists(spotId) onlySpotOwner(spotId) whenNotPaused {
        require(parkingSpots[spotId].isActive, "Spot is deactivated");

        parkingSpots[spotId].isAvailable = !parkingSpots[spotId].isAvailable;

        emit SpotAvailabilityToggled(
            spotId,
            parkingSpots[spotId].isAvailable
        );
    }

    function deactivateSpot(
        uint256 spotId
    ) external spotExists(spotId) onlySpotOwner(spotId) whenNotPaused {
        require(parkingSpots[spotId].isActive, "Spot already deactivated");

        uint256[] storage spotBookings = _spotBookingIds[spotId];
        for (uint256 i = 0; i < spotBookings.length; i++) {
            require(
                bookings[spotBookings[i]].status != BookingStatus.Active,
                "Spot has active bookings"
            );
        }

        parkingSpots[spotId].isActive = false;
        parkingSpots[spotId].isAvailable = false;

        emit SpotDeactivated(spotId);
    }

    // -------------------------------------------------------------------------
    // Booking
    // -------------------------------------------------------------------------

    function bookSpot(
        uint256 spotId,
        uint256 startTime,
        uint256 endTime
    )
        external
        payable
        spotExists(spotId)
        whenNotPaused
        nonReentrant
        returns (uint256 bookingId)
    {
        ParkingSpot storage spot = parkingSpots[spotId];

        require(spot.isActive, "Spot is deactivated");
        require(spot.isAvailable, "Spot is not available");
        require(msg.sender != spot.owner, "Cannot book own spot");
        require(startTime >= block.timestamp, "Start time in the past");
        require(endTime > startTime, "End must be after start");

        uint256 duration = endTime - startTime;
        require(duration >= 3600, "Minimum 1 hour booking");
        require(duration % 3600 == 0, "Duration must be in whole hours");

        uint256 totalPrice = (duration * spot.pricePerHour) / 3600;
        require(msg.value == totalPrice, "Incorrect payment amount");

        uint256 overlapping = _getActiveOverlappingBookings(
            spotId,
            startTime,
            endTime
        );
        require(overlapping < spot.capacity, "Spot fully booked for this time");

        uint256 fee = (totalPrice * platformFeePercent) / 10000;

        bookingId = _nextBookingId++;

        bookings[bookingId] = Booking({
            id: bookingId,
            parkingSpotId: spotId,
            renter: msg.sender,
            spotOwner: spot.owner,
            startTime: startTime,
            endTime: endTime,
            totalPrice: totalPrice,
            platformFee: fee,
            status: BookingStatus.Active
        });

        _renterBookingIds[msg.sender].push(bookingId);
        _ownerBookingIds[spot.owner].push(bookingId);
        _spotBookingIds[spotId].push(bookingId);

        emit BookingCreated(
            bookingId,
            spotId,
            msg.sender,
            startTime,
            endTime,
            totalPrice
        );
    }

    function releasePayment(
        uint256 bookingId
    ) external bookingExists(bookingId) nonReentrant whenNotPaused {
        Booking storage booking = bookings[bookingId];

        require(
            booking.status == BookingStatus.Active,
            "Booking is not active"
        );
        require(
            block.timestamp >= booking.endTime,
            "Booking period not ended"
        );

        booking.status = BookingStatus.Completed;

        uint256 ownerAmount = booking.totalPrice - booking.platformFee;
        accumulatedFees += booking.platformFee;

        (bool success, ) = payable(booking.spotOwner).call{value: ownerAmount}(
            ""
        );
        require(success, "Payment transfer failed");

        emit PaymentReleased(
            bookingId,
            booking.spotOwner,
            ownerAmount,
            booking.platformFee
        );
    }

    function cancelBooking(
        uint256 bookingId
    ) external bookingExists(bookingId) nonReentrant whenNotPaused {
        Booking storage booking = bookings[bookingId];

        require(
            booking.status == BookingStatus.Active,
            "Booking is not active"
        );
        require(msg.sender == booking.renter, "Only renter can cancel");
        require(
            block.timestamp < booking.startTime,
            "Cannot cancel after start"
        );

        booking.status = BookingStatus.Cancelled;

        (bool success, ) = payable(booking.renter).call{
            value: booking.totalPrice
        }("");
        require(success, "Refund transfer failed");

        emit BookingCancelled(bookingId, booking.renter, booking.totalPrice);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setPlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= MAX_FEE, "Fee too high");

        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFeePercent;

        emit PlatformFeeUpdated(oldFee, newFeePercent);
    }

    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");

        accumulatedFees = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FeesWithdrawn(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function getSpot(
        uint256 spotId
    ) external view spotExists(spotId) returns (ParkingSpot memory) {
        return parkingSpots[spotId];
    }

    function getBooking(
        uint256 bookingId
    ) external view bookingExists(bookingId) returns (Booking memory) {
        return bookings[bookingId];
    }

    function getAllActiveSpots()
        external
        view
        returns (ParkingSpot[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < _allSpotIds.length; i++) {
            ParkingSpot storage s = parkingSpots[_allSpotIds[i]];
            if (s.isActive && s.isAvailable) {
                count++;
            }
        }

        ParkingSpot[] memory result = new ParkingSpot[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _allSpotIds.length; i++) {
            ParkingSpot storage s = parkingSpots[_allSpotIds[i]];
            if (s.isActive && s.isAvailable) {
                result[idx++] = s;
            }
        }

        return result;
    }

    function getSpotsByOwner(
        address spotOwner
    ) external view returns (ParkingSpot[] memory) {
        uint256[] storage ids = _ownerSpotIds[spotOwner];
        ParkingSpot[] memory result = new ParkingSpot[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = parkingSpots[ids[i]];
        }
        return result;
    }

    function getBookingsByRenter(
        address renter
    ) external view returns (Booking[] memory) {
        uint256[] storage ids = _renterBookingIds[renter];
        Booking[] memory result = new Booking[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = bookings[ids[i]];
        }
        return result;
    }

    function getBookingsBySpotOwner(
        address spotOwner
    ) external view returns (Booking[] memory) {
        uint256[] storage ids = _ownerBookingIds[spotOwner];
        Booking[] memory result = new Booking[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = bookings[ids[i]];
        }
        return result;
    }

    function getBookingsForSpot(
        uint256 spotId
    ) external view spotExists(spotId) returns (Booking[] memory) {
        uint256[] storage ids = _spotBookingIds[spotId];
        Booking[] memory result = new Booking[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = bookings[ids[i]];
        }
        return result;
    }

    function getTotalSpots() external view returns (uint256) {
        return _nextSpotId - 1;
    }

    function getTotalBookings() external view returns (uint256) {
        return _nextBookingId - 1;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _getActiveOverlappingBookings(
        uint256 spotId,
        uint256 startTime,
        uint256 endTime
    ) internal view returns (uint256 count) {
        uint256[] storage spotBookings = _spotBookingIds[spotId];
        for (uint256 i = 0; i < spotBookings.length; i++) {
            Booking storage b = bookings[spotBookings[i]];
            if (b.status == BookingStatus.Active) {
                if (startTime < b.endTime && endTime > b.startTime) {
                    count++;
                }
            }
        }
    }
}
