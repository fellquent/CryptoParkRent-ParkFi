// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

library SharedTypes {
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
        uint256 spotId;
        address renter;
        address spotOwner;
        uint256 startTime;
        uint256 endTime;
        uint256 totalPrice;
        uint256 platformFee;
        BookingStatus status;
    }
}